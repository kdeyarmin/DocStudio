const LOGIN_2FA_STATE_KEY = 'cm_login_2fa_state';

type Login2FAState = {
  pendingUserId: string | null;
  verifiedUserId: string | null;
  verifiedAt: string | null;
};

const VERIFIED_TTL_MS = 30 * 60 * 1000;

const EMPTY_STATE: Login2FAState = {
  pendingUserId: null,
  verifiedUserId: null,
  verifiedAt: null,
};

function createEmptyState(): Login2FAState {
  return { ...EMPTY_STATE };
}

function readState(): Login2FAState {
  if (typeof window === 'undefined') return createEmptyState();

  try {
    const raw = window.sessionStorage.getItem(LOGIN_2FA_STATE_KEY);
    if (!raw) return createEmptyState();

    const parsed = JSON.parse(raw) as Partial<Login2FAState>;
    return {
      pendingUserId: typeof parsed.pendingUserId === 'string' ? parsed.pendingUserId : null,
      verifiedUserId: typeof parsed.verifiedUserId === 'string' ? parsed.verifiedUserId : null,
      verifiedAt: typeof parsed.verifiedAt === 'string' ? parsed.verifiedAt : null,
    };
  } catch {
    try {
      window.sessionStorage.removeItem(LOGIN_2FA_STATE_KEY);
    } catch {
      // Ignore storage cleanup failures. The auth flow will fall back to empty state.
    }
    return createEmptyState();
  }
}

function writeState(state: Login2FAState) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(LOGIN_2FA_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures. The auth flow will still work in-memory.
  }
}

export function markLogin2FAPending(userId: string) {
  const current = readState();
  writeState({
    pendingUserId: userId,
    verifiedUserId: current.verifiedUserId === userId ? current.verifiedUserId : null,
    verifiedAt: current.verifiedUserId === userId ? current.verifiedAt : null,
  });
}

export function markLogin2FAVerified(userId: string) {
  writeState({
    pendingUserId: null,
    verifiedUserId: userId,
    verifiedAt: new Date().toISOString(),
  });
}

export function clearLogin2FAState() {
  writeState(EMPTY_STATE);
}

export function hasPendingLogin2FAChallenge(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readState().pendingUserId === userId;
}

export function hasVerifiedLogin2FA(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const state = readState();
  if (state.verifiedUserId !== userId || !state.verifiedAt) {
    return false;
  }

  const verifiedAtMs = Date.parse(state.verifiedAt);
  if (Number.isNaN(verifiedAtMs)) {
    clearLogin2FAState();
    return false;
  }

  if (Date.now() - verifiedAtMs > VERIFIED_TTL_MS) {
    clearLogin2FAState();
    return false;
  }

  return true;
}
