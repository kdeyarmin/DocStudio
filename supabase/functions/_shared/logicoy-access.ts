import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type CallerProfile = {
  id: string;
  organization_id: string | null;
  role: string | null;
  is_super_admin: boolean | null;
  is_also_provider: boolean | null;
  permissions: Record<string, unknown> | null;
};

type CallerMembership = {
  id: string;
  role: string | null;
};

type LogicoyClinician = {
  id: string;
  user_id: string | null;
};

export type LogicoyCallerAccess = {
  membership: CallerMembership;
  profile: CallerProfile | null;
  canManageLogicoy: boolean;
  canUseEprescribing: boolean;
};

function hasPermission(profile: CallerProfile | null, permission: string): boolean {
  return Boolean(profile?.permissions && profile.permissions[permission] === true);
}

function normalizeRole(role: string | null | undefined): string {
  return String(role || "").trim().toLowerCase();
}

export async function getLogicoyCallerAccess(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<
  | { ok: true; access: LogicoyCallerAccess }
  | { ok: false; status: number; error: string }
> {
  const [membershipRes, profileRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, organization_id, role, is_super_admin, is_also_provider, permissions")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (membershipRes.error) {
    console.error("[logicoy-access] DB error fetching membership:", membershipRes.error.message);
    return { ok: false, status: 503, error: "Service temporarily unavailable" };
  }

  if (profileRes.error) {
    console.error("[logicoy-access] DB error fetching profile:", profileRes.error.message);
    return { ok: false, status: 503, error: "Service temporarily unavailable" };
  }

  const membership = membershipRes.data;
  const profile = profileRes.data;

  if (!membership) {
    return { ok: false, status: 403, error: "Access denied: not a member of this organization" };
  }

  const profileRole = normalizeRole(profile?.role);
  const membershipRole = normalizeRole(membership.role);
  const isSuperAdmin = profile?.is_super_admin === true || profileRole === "super_admin";
  const canManageLogicoy = isSuperAdmin
    || profileRole === "org_admin"
    || profileRole === "admin"
    || membershipRole === "owner"
    || hasPermission(profile, "manage_staff");

  const canUseEprescribing = canManageLogicoy
    || profileRole === "provider"
    || membershipRole === "provider"
    || (profileRole === "org_admin" && profile?.is_also_provider === true)
    || hasPermission(profile, "prescribe_medications");

  return {
    ok: true,
    access: {
      membership,
      profile,
      canManageLogicoy,
      canUseEprescribing,
    },
  };
}

export async function authorizeRequestedLogicoyClinician(
  supabase: SupabaseClient,
  organizationId: string,
  clinicianId: string,
  userId: string,
  access: LogicoyCallerAccess,
): Promise<
  | { ok: true; clinician: LogicoyClinician }
  | { ok: false; status: number; error: string }
> {
  const { data: clinician, error: clinicianErr } = await supabase
    .from("logicoy_clinicians")
    .select("id, user_id")
    .eq("id", clinicianId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (clinicianErr) {
    console.error("[logicoy-access] DB error fetching clinician:", clinicianErr.message);
    return { ok: false, status: 503, error: "Service temporarily unavailable" };
  }

  if (!clinician) {
    return { ok: false, status: 404, error: "Clinician not found for this organization" };
  }

  if (!access.canManageLogicoy && clinician.user_id !== userId) {
    return { ok: false, status: 403, error: "Access denied for the requested clinician" };
  }

  return { ok: true, clinician };
}

export async function getCallerLogicoyClinicianId(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { data: clinician } = await supabase
    .from("logicoy_clinicians")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  return clinician?.id ?? null;
}
