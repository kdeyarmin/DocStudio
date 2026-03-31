import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from './supabase';
import { getAppUrl } from './site-url';
import { cache, clearSessionCache } from './cache';
import { logger } from './logger';
import { errorTracker } from './error-tracker';
import { clearLogin2FAState, hasVerifiedLogin2FA } from './login-2fa-state';
import { getFunctionAuthHeaders } from './function-auth';
import { normalizeEmail } from './validators';
import { queryClient } from './react-query';

type TwoFactorRequirementStatus = 'checking' | 'not_required' | 'verified' | 'challenge_required' | 'setup_required' | 'service_unavailable';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: Error | null;
  twoFactorRequirementStatus: TwoFactorRequirementStatus;
  impersonatedOrg: { id: string; name: string } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<Profile>) => Promise<string | void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markTwoFactorVerified: () => void;
  impersonateOrganization: (orgId: string, orgName: string) => Promise<void>;
  exitImpersonation: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [twoFactorRequirementStatus, setTwoFactorRequirementStatus] = useState<TwoFactorRequirementStatus>('checking');
  const currentUserIdRef = useRef<string | null>(null);
  const loadProfileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const loadProfileAbortRef = useRef<AbortController | null>(null);
  const loadProfileRequestIdRef = useRef(0);
  const [impersonatedOrg, setImpersonatedOrg] = useState<{ id: string; name: string } | null>(null);

  const lastLoginUpdatedRef = useRef<string | null>(null);

  const clearLoadProfileTimeout = useCallback(() => {
    if (loadProfileTimeoutRef.current) {
      clearTimeout(loadProfileTimeoutRef.current);
      loadProfileTimeoutRef.current = null;
    }
  }, []);

  const cancelPendingProfileLoad = useCallback(() => {
    loadProfileRequestIdRef.current += 1;
    if (loadProfileAbortRef.current) {
      loadProfileAbortRef.current.abort();
      loadProfileAbortRef.current = null;
    }
    clearLoadProfileTimeout();
  }, [clearLoadProfileTimeout]);

  const clearClientSessionState = useCallback(() => {
    cancelPendingProfileLoad();
    queryClient.clear();
    cache.clear();
    clearSessionCache();
    clearLogin2FAState();
  }, [cancelPendingProfileLoad]);

  const evaluateTwoFactorRequirement = useCallback(async (nextUserId: string, profileData: Profile | null) => {
    if (!mountedRef.current) return;

    if (!profileData) {
      setTwoFactorRequirementStatus('not_required');
      return;
    }

    // Don't reset to 'checking' here — the onAuthStateChange handler already
    // sets it for new sign-ins. Setting it here would cause ProtectedRoute to
    // flash a loading spinner whenever refreshProfile triggers a re-evaluation.
    try {
      const twoFaController = new AbortController();
      const twoFaTimeout = setTimeout(() => twoFaController.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-verify-status`,
          {
            method: 'POST',
            headers: await getFunctionAuthHeaders(),
            body: JSON.stringify({ user_id: nextUserId, purpose: 'login' }),
            signal: twoFaController.signal,
          }
        );
      } finally {
        clearTimeout(twoFaTimeout);
      }

      if (!response.ok) {
        throw new Error(`2FA policy check failed with status ${response.status}`);
      }

      const statusData = await response.json();

      if (!mountedRef.current || currentUserIdRef.current !== nextUserId) return;

      if (!statusData.required_for_purpose) {
        setTwoFactorRequirementStatus('not_required');
        return;
      }

      const hasVerifiedPhone = Boolean(statusData.user_has_phone && statusData.user_verified && profileData.two_factor_phone && profileData.two_factor_verified);

      if (!hasVerifiedPhone) {
        clearLogin2FAState();
        setTwoFactorRequirementStatus('setup_required');
        return;
      }

      setTwoFactorRequirementStatus(hasVerifiedLogin2FA(nextUserId) ? 'verified' : 'challenge_required');
    } catch (err) {
      logger.error('Failed to evaluate login 2FA requirement', err instanceof Error ? err : undefined);
      if (!mountedRef.current || currentUserIdRef.current !== nextUserId) return;

      // Fail closed only for users who have explicitly set up 2FA — their security
      // expectation must be honoured even when the policy service is unreachable.
      // Users without 2FA configured get fail-open so a service outage doesn't lock
      // out the entire user base.
      const userHas2FA = Boolean(profileData?.two_factor_phone && profileData?.two_factor_verified);
      setTwoFactorRequirementStatus(userHas2FA ? 'challenge_required' : 'not_required');
    }
  }, []);

  const loadProfile = useCallback(async (userId: string, isSignIn = false, evaluate2FA = true) => {
    if (loadProfileAbortRef.current) {
      loadProfileAbortRef.current.abort();
    }
    const requestId = loadProfileRequestIdRef.current + 1;
    loadProfileRequestIdRef.current = requestId;
    const controller = new AbortController();
    loadProfileAbortRef.current = controller;

    clearLoadProfileTimeout();
    loadProfileTimeoutRef.current = setTimeout(() => {
      loadProfileTimeoutRef.current = null;
      if (
        mountedRef.current &&
        !controller.signal.aborted &&
        requestId === loadProfileRequestIdRef.current &&
        currentUserIdRef.current === userId
      ) {
        setLoading(false);
      }
    }, 3000);

    try {
      const isStaleRequest = () =>
        controller.signal.aborted
        || requestId !== loadProfileRequestIdRef.current
        || currentUserIdRef.current !== userId;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, full_name, role, organization_id, specialty, phone, license_number, npi_number, password_change_required, is_super_admin, is_demo_account, is_also_provider, two_factor_phone, two_factor_verified, two_factor_exempt, last_login_at, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      clearLoadProfileTimeout();

      if (isStaleRequest() || !mountedRef.current) return;

      if (error || !data) {
        const loadErr = error ? new Error(error.message) : new Error('Profile not found');
        setProfile(null);
        setProfileError(loadErr);
        setTwoFactorRequirementStatus('not_required');
        setLoading(false);
        return;
      }

      if (data) {
        errorTracker.setUser(data.id, data.organization_id || null);
      }
      setProfile(data);
      setProfileError(null);
      setLoading(false);
      if (evaluate2FA) {
        void evaluateTwoFactorRequirement(userId, data);
      }

      if (isSignIn && lastLoginUpdatedRef.current !== userId) {
        lastLoginUpdatedRef.current = userId;
        const now = new Date().toISOString();
        void Promise.resolve(
          supabase
            .from('profiles')
            .update({ last_login_at: now })
            .eq('id', userId)
        ).then(({ error: loginErr }) => {
          if (!mountedRef.current || requestId !== loadProfileRequestIdRef.current || currentUserIdRef.current !== userId) return;
          if (!loginErr) {
            setProfile(prev => prev ? { ...prev, last_login_at: now } : prev);
          } else {
            logger.error('Failed to update last_login_at', undefined, { message: loginErr.message });
          }
        }, (err: unknown) => {
          logger.error('Unexpected error updating last_login_at', err instanceof Error ? err : undefined);
        });
      }
    } catch (err) {
      clearLoadProfileTimeout();
      if (controller.signal.aborted || requestId !== loadProfileRequestIdRef.current || currentUserIdRef.current !== userId) return;
      const e = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to load user profile', e);
      if (!mountedRef.current) return;
      setProfile(null);
      setProfileError(e);
      setTwoFactorRequirementStatus('not_required');
      setLoading(false);
    } finally {
      if (loadProfileAbortRef.current === controller) {
        loadProfileAbortRef.current = null;
      }
    }
  }, [clearLoadProfileTimeout, evaluateTwoFactorRequirement]);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mountedRef.current) return;
      if (error) {
        const msg = error.message;
        const errName = error.name ?? '';
        if (errName === 'AuthSessionMissingError' || msg.includes('session_not_found') || msg.includes('Session from session_id') || msg.includes('Auth session missing')) {
          logger.warn('Dead session detected on init, clearing local auth state');
          await supabase.auth.signOut({ scope: 'local' });
          clearClientSessionState();
          setUser(null);
          setProfile(null);
          setTwoFactorRequirementStatus('not_required');
        }
        setLoading(false);
        return;
      }

      if (session?.user) {
        const tokenBeingValidated = session.access_token;
        const { data: validated, error: validateError } = await supabase.auth.getUser(tokenBeingValidated);
        if (validateError || !validated.user) {
          // Before invalidating, check if the session was replaced by a new sign-in
          // while we were validating. Without this check, a slow getUser() call
          // for a stale token would destroy a fresh session from signInWithPassword.
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession && currentSession.access_token !== tokenBeingValidated) {
            // Session was replaced by a new sign-in — don't destroy it
            return;
          }

          const vMsg = validateError?.message || '';
          const vName = validateError?.name ?? '';
          const isDeadSession = vName === 'AuthSessionMissingError'
            || vMsg.includes('session_not_found')
            || vMsg.includes('Session from session_id')
            || vMsg.includes('Auth session missing')
            || vMsg.includes('invalid')
            || vMsg.includes('expired');
          if (isDeadSession) {
            logger.warn('Session invalid on server, clearing local auth state');
            await supabase.auth.signOut({ scope: 'local' });
            clearClientSessionState();
            if (mountedRef.current) {
              setUser(null);
              setProfile(null);
              setTwoFactorRequirementStatus('not_required');
              setLoading(false);
            }
            return;
          }

          logger.warn('getUser validation failed with non-fatal error, continuing with session', { message: vMsg });
        }
      }

      const sessionUser = session?.user ?? null;
      // If onAuthStateChange (INITIAL_SESSION) already set up this user,
      // skip the redundant loadProfile to avoid double network calls and
      // orphaned evaluateTwoFactorRequirement fetches.
      if (sessionUser && currentUserIdRef.current === sessionUser.id) {
        return;
      }
      currentUserIdRef.current = sessionUser?.id ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setTwoFactorRequirementStatus('not_required');
        setLoading(false);
      }
    }).catch((err) => {
      logger.error('Failed to get auth session', err instanceof Error ? err : undefined);
      if (mountedRef.current) {
        setTwoFactorRequirementStatus('not_required');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        try {
          const newUser = session?.user ?? null;
          const newUserId = newUser?.id ?? null;
          const previousUserId = currentUserIdRef.current;
          currentUserIdRef.current = newUserId;

          if (!mountedRef.current) return;

          const isNewSignIn = newUserId !== previousUserId && newUserId !== null;

          if (isNewSignIn) {
            setLoading(true);
            setProfile(null);
            setTwoFactorRequirementStatus('checking');
            setImpersonatedOrg(null);
            clearClientSessionState();
          }

          setUser(newUser);
          if (newUser && isNewSignIn) {
            await loadProfile(newUser.id, event === 'SIGNED_IN', true);
          } else if (!newUser) {
            if (mountedRef.current) {
              setProfile(null);
              setTwoFactorRequirementStatus('not_required');
              setLoading(false);
            }
            // Clear all session-scoped data on ANY sign-out — whether triggered
            // by the auth context's signOut() or by direct supabase.auth.signOut()
            // calls (e.g. TwoFactorGate cancel, PasswordRecoveryForm cancel).
            clearClientSessionState();
          }
        } catch (err) {
          logger.error('onAuthStateChange handler error', err instanceof Error ? err : undefined);
          if (mountedRef.current) {
            setTwoFactorRequirementStatus('not_required');
            setLoading(false);
          }
        }
      })();
    });

    return () => {
      mountedRef.current = false;
      cancelPendingProfileLoad();
      subscription.unsubscribe();
    };
  }, [cancelPendingProfileLoad, clearClientSessionState, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, userData: Partial<Profile>) => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo: getAppUrl(),
        data: {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          phone: userData.phone || '',
          npi_number: userData.npi_number || '',
          specialty: userData.specialty || '',
          license_number: userData.license_number || '',
          role: userData.role || 'provider'
        }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed: No user returned');

    if (data.session) {
      await new Promise(resolve => setTimeout(resolve, 300));

      const updateData: Partial<Profile> = {};
      if (userData.phone) updateData.phone = userData.phone;
      if (userData.npi_number) updateData.npi_number = userData.npi_number;
      if (userData.specialty) updateData.specialty = userData.specialty;
      if (userData.license_number) updateData.license_number = userData.license_number;
      if (userData.role) updateData.role = userData.role;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', data.user.id);
      }
    } else {
      return 'confirmation_required';
    }
  }, []);

  const signOut = useCallback(async () => {
    setImpersonatedOrg(null);
    clearClientSessionState();
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      const msg = error.message || '';
      const name = error?.name ?? '';
      const isDeadSession = name === 'AuthSessionMissingError'
        || msg.includes('session_not_found')
        || msg.includes('Auth session missing');
      if (!isDeadSession) {
        logger.warn('Sign out error (non-session)', error);
      }
    }
    window.location.href = `${getAppUrl()}/login`;
  }, [clearClientSessionState]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const impersonateOrganization = useCallback(async (orgId: string, orgName: string) => {
    if (!profile?.is_super_admin) return;
    const previousOrgId = profile.organization_id;

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      organization_id: previousOrgId,
      user_id: profile.id,
      action: 'impersonate_organization',
      resource_type: 'organization',
      resource_id: orgId,
      details: { target_org_name: orgName, previous_org_id: previousOrgId },
    });

    if (auditErr) {
      logger.error('Failed to log impersonation audit', undefined, { message: auditErr.message });
      void errorTracker.captureError({
        error_message: `Impersonation audit log failed: ${auditErr.message}`,
        error_type: 'runtime',
        severity: 'error',
        component_name: 'AuthProvider.impersonateOrganization',
        user_action_context: `super_admin impersonated org ${orgId}`,
      });
      throw new Error(`Impersonation cancelled: audit log failed — ${auditErr.message}`);
    }

    queryClient.clear();
    cache.clear();
    clearSessionCache();
    setImpersonatedOrg({ id: orgId, name: orgName });
    setProfile(prev => prev ? { ...prev, organization_id: orgId } : null);
  }, [profile]);

  const markTwoFactorVerified = useCallback(() => {
    setTwoFactorRequirementStatus('verified');
  }, []);

  const exitImpersonation = useCallback(() => {
    queryClient.clear();
    cache.clear();
    clearSessionCache();
    setImpersonatedOrg(null);
    if (user) {
      loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    profile,
    loading,
    profileError,
    twoFactorRequirementStatus,
    impersonatedOrg,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    markTwoFactorVerified,
    impersonateOrganization,
    exitImpersonation
  }), [user, profile, loading, profileError, twoFactorRequirementStatus, impersonatedOrg, signIn, signUp, signOut, refreshProfile, markTwoFactorVerified, impersonateOrganization, exitImpersonation]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
