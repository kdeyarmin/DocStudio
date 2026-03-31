import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

export type AuthResult =
  | { user: User; token: string; error?: undefined }
  | { user?: undefined; token?: undefined; error: Response };

export type MembershipResult =
  | { membership: { id: string; role?: string | null }; error?: undefined }
  | { membership?: undefined; error: Response };

export type DraftAccessResult =
  | { draft: { id: string; organization_id: string }; error?: undefined }
  | { draft?: undefined; error: Response };

export type JobAccessResult =
  | { job: { id: string; draft_id: string | null; created_by: string | null }; error?: undefined }
  | { job?: undefined; error: Response };

export type AuthorizedJobAccessResult =
  | {
      jobIds: string[];
      draftIds: string[];
      organizationIds: string[];
      error?: undefined;
    }
  | { jobIds?: undefined; draftIds?: undefined; organizationIds?: undefined; error: Response };

export async function getAuthorizedOrganizationIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  if (await isSuperAdminUser(supabase, userId)) {
    const { data } = await supabase
      .from("organizations")
      .select("id");

    return (data ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  const authorized = new Set<string>();

  const { data: membershipRows } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  for (const row of membershipRows ?? []) {
    if (typeof row.organization_id === "string" && row.organization_id.length > 0) {
      authorized.add(row.organization_id);
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (typeof profile?.organization_id === "string" && profile.organization_id.length > 0) {
    authorized.add(profile.organization_id);
  }

  return [...authorized];
}

/**
 * Verify a shared secret passed as a Bearer token.
 * Returns null if the secret matches, or a Response describing the failure.
 */
export function requireSharedSecret(req: Request, configuredSecret: string): Response | null {
  if (!configuredSecret) {
    return jsonResponse({ error: "Shared secret is not configured" }, 503, req);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) {
    return jsonResponse({ error: "Missing authorization header" }, 401, req);
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (token !== configuredSecret) {
    return jsonResponse({ error: "Invalid shared secret" }, 401, req);
  }

  return null;
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAuth(req: Request, supabase: SupabaseClient): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) {
    return { error: jsonResponse({ error: "Missing authorization header" }, 401, req) };
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    return { error: jsonResponse({ error: "Missing authorization token" }, 401, req) };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: jsonResponse({ error: "Invalid or expired token" }, 401, req) };
  }

  return { user, token };
}

export async function isSuperAdminUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_super_admin, role")
    .eq("id", userId)
    .maybeSingle();

  return data?.is_super_admin === true || data?.role === "super_admin";
}

export type SuperAdminResult =
  | { ok: true; user: User }
  | { ok: false; error: Response };

type RequestIdentity =
  | { kind: "user"; user: User; token: string }
  | { kind: "service_role" }
  | { kind: "error"; error: Response };

/**
 * Determine the caller identity from the Authorization header.
 * Returns the authenticated user, a service-role marker, or an error response.
 */
export async function getRequestIdentity(
  req: Request,
  supabase: SupabaseClient,
): Promise<RequestIdentity> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) {
    return { kind: "error", error: jsonResponse({ error: "Missing authorization header" }, 401, req) };
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();

  // Detect service-role key usage
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) {
    return { kind: "service_role" };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { kind: "error", error: jsonResponse({ error: "Invalid or expired token" }, 401, req) };
  }

  return { kind: "user", user, token };
}

export async function verifySuperAdmin(
  req: Request,
  supabase: SupabaseClient,
): Promise<SuperAdminResult> {
  const identity = await getRequestIdentity(req, supabase);
  if (identity.kind === "error") {
    return { ok: false, error: identity.error };
  }
  if (identity.kind === "service_role") {
    return {
      ok: false,
      error: jsonResponse({ error: "Super admin access required" }, 403, req),
    };
  }

  if (!(await isSuperAdminUser(supabase, identity.user.id))) {
    return {
      ok: false,
      error: jsonResponse({ error: "Super admin access required" }, 403, req),
    };
  }

  return { ok: true, user: identity.user };
}

/** Alias kept for backward-compat with edge functions using the old name. */
export const requireSuperAdmin = verifySuperAdmin;

export async function verifyOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  req?: Request,
): Promise<MembershipResult> {
  if (await isSuperAdminUser(supabase, userId)) {
    return { membership: { id: userId, role: "super_admin" } };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.organization_id === organizationId) {
      return {
        membership: {
          id: userId,
          role: typeof profile.role === "string" ? profile.role : null,
        },
      };
    }

    return {
      error: jsonResponse({ error: "Not authorized for this organization" }, 403, req),
    };
  }

  return { membership: data };
}

export async function verifyDocStudioDraftAccess(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  req?: Request,
): Promise<DraftAccessResult> {
  const { data: draft, error } = await supabase
    .from("doc_studio_drafts")
    .select("id, organization_id")
    .eq("id", draftId)
    .maybeSingle();

  if (error || !draft?.organization_id) {
    return {
      error: jsonResponse({ error: "Draft not found" }, 404, req),
    };
  }

  const membershipResult = await verifyOrgMembership(
    supabase,
    userId,
    draft.organization_id,
    req,
  );

  if (membershipResult.error) {
    return { error: membershipResult.error };
  }

  return {
    draft: {
      id: draft.id,
      organization_id: draft.organization_id,
    },
  };
}

export async function verifyDocStudioJobAccess(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  req?: Request,
): Promise<JobAccessResult> {
  const { data: job, error } = await supabase
    .from("documentation_jobs")
    .select("id, draft_id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return {
      error: jsonResponse({ error: "Job not found" }, 404, req),
    };
  }

  if (await isSuperAdminUser(supabase, userId)) {
    return {
      job: {
        id: job.id,
        draft_id: job.draft_id ?? null,
        created_by: job.created_by ?? null,
      },
    };
  }

  if (job.draft_id) {
    const draftAccess = await verifyDocStudioDraftAccess(
      supabase,
      userId,
      job.draft_id,
      req,
    );

    if (draftAccess.error) {
      return { error: draftAccess.error };
    }

    return {
      job: {
        id: job.id,
        draft_id: job.draft_id,
        created_by: job.created_by ?? null,
      },
    };
  }

  if (job.created_by === userId) {
    return {
      job: {
        id: job.id,
        draft_id: null,
        created_by: job.created_by ?? null,
      },
    };
  }

  return {
    error: jsonResponse({ error: "Access denied" }, 403, req),
  };
}

export async function getAuthorizedDocStudioJobAccess(
  supabase: SupabaseClient,
  userId: string,
  req?: Request,
): Promise<AuthorizedJobAccessResult> {
  const isSuperAdmin = await isSuperAdminUser(supabase, userId);
  const organizationIds = await getAuthorizedOrganizationIds(supabase, userId);
  const draftIds = new Set<string>();
  const jobIds = new Set<string>();

  if (organizationIds.length > 0) {
    const { data: drafts, error: draftError } = await supabase
      .from("doc_studio_drafts")
      .select("id")
      .in("organization_id", organizationIds);

    if (draftError) {
      return {
        error: jsonResponse({ error: "Failed to resolve authorized drafts" }, 500, req),
      };
    }

    for (const draft of drafts ?? []) {
      if (typeof draft.id === "string" && draft.id.length > 0) {
        draftIds.add(draft.id);
      }
    }
  }

  const createdJobsQuery = supabase
    .from("documentation_jobs")
    .select("id");

  const { data: createdJobs, error: createdJobsError } = isSuperAdmin
    ? await createdJobsQuery
    : await createdJobsQuery.eq("created_by", userId);

  if (createdJobsError) {
    return {
      error: jsonResponse({ error: "Failed to resolve authorized jobs" }, 500, req),
    };
  }

  for (const job of createdJobs ?? []) {
    if (typeof job.id === "string" && job.id.length > 0) {
      jobIds.add(job.id);
    }
  }

  if (draftIds.size > 0) {
    const { data: draftJobs, error: draftJobsError } = await supabase
      .from("documentation_jobs")
      .select("id")
      .in("draft_id", [...draftIds]);

    if (draftJobsError) {
      return {
        error: jsonResponse({ error: "Failed to resolve draft jobs" }, 500, req),
      };
    }

    for (const job of draftJobs ?? []) {
      if (typeof job.id === "string" && job.id.length > 0) {
        jobIds.add(job.id);
      }
    }
  }

  return {
    jobIds: [...jobIds],
    draftIds: [...draftIds],
    organizationIds,
  };
}

// ── Higher-level auth helpers used by doc-studio edge functions ─────────

/**
 * Allow super-admin users or callers using a trusted internal token
 * (service-role key). Returns the authenticated user or an error Response.
 */
export async function requireSuperAdminOrTrustedToken(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const identity = await getRequestIdentity(req, supabase);

  if (identity.kind === "error") {
    return { error: identity.error };
  }

  // Service-role callers are trusted (internal function-to-function calls).
  if (identity.kind === "service_role") {
    // Synthesise a minimal user object so callers can use `.user.id`.
    const serviceUser = { id: "service-role" } as User;
    return { user: serviceUser, token: "" };
  }

  if (await isSuperAdminUser(supabase, identity.user.id)) {
    return { user: identity.user, token: identity.token };
  }

  return { error: jsonResponse({ error: "Forbidden: super-admin or trusted token required" }, 403, req) };
}

export type DraftAccessForRequestResult =
  | { ok: true; user: User; organizationId: string }
  | { ok: false; error: Response };

/**
 * Verify the caller can access a given draft and/or organization.
 * Accepts either a `draftId` (looks up its org), an `organizationId`, or both.
 */
export async function requireDocStudioDraftAccessForRequest(
  req: Request,
  supabase: SupabaseClient,
  options: { draftId?: string; organizationId?: string },
): Promise<DraftAccessForRequestResult> {
  const authResult = await requireAuth(req, supabase);
  if (authResult.error) return { ok: false, error: authResult.error };

  const userId = authResult.user.id;
  let organizationId = options.organizationId ?? null;

  // Resolve org from draft when only draftId is provided
  if (options.draftId) {
    const { data: draft } = await supabase
      .from("doc_studio_drafts")
      .select("organization_id")
      .eq("id", options.draftId)
      .maybeSingle();

    if (!draft) {
      return { ok: false, error: jsonResponse({ error: "Draft not found" }, 404, req) };
    }
    organizationId = draft.organization_id;
  }

  if (!organizationId) {
    return { ok: false, error: jsonResponse({ error: "Organization context required" }, 400, req) };
  }

  const membership = await verifyOrgMembership(supabase, userId, organizationId, req);
  if (membership.error) return { ok: false, error: membership.error };

  return { ok: true, user: authResult.user, organizationId };
}

export type InternalOrResourceAccessResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: Response };

/**
 * Allow internal callers (service-role) or users with draft access.
 */
export async function requireInternalOrDraftAccess(
  req: Request,
  supabase: SupabaseClient,
  draftId: string,
  organizationId?: string,
): Promise<InternalOrResourceAccessResult> {
  const identity = await getRequestIdentity(req, supabase);

  if (identity.kind === "error") {
    return { ok: false, error: identity.error };
  }

  // Resolve org from the draft
  const { data: draft } = await supabase
    .from("doc_studio_drafts")
    .select("organization_id")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) {
    return { ok: false, error: jsonResponse({ error: "Draft not found" }, 404, req) };
  }

  const resolvedOrgId = organizationId ?? draft.organization_id;

  // Service-role callers are trusted
  if (identity.kind === "service_role") {
    return { ok: true, organizationId: resolvedOrgId };
  }

  // Super admins pass
  if (await isSuperAdminUser(supabase, identity.user.id)) {
    return { ok: true, organizationId: resolvedOrgId };
  }

  // Regular users must have org membership
  const membership = await verifyOrgMembership(supabase, identity.user.id, resolvedOrgId, req);
  if (membership.error) return { ok: false, error: membership.error };

  return { ok: true, organizationId: resolvedOrgId };
}

export type DocStudioAuthContext =
  | { organizationId: string; userId: string }
  | { error: Response };

/**
 * Resolve the auth context (user + organization) for doc-studio operations.
 * When a draftId is provided, the organization is resolved from it.
 */
export async function requireDocStudioAuthContext(
  req: Request,
  supabase: SupabaseClient,
  options: { draftId?: string | null },
): Promise<DocStudioAuthContext> {
  const identity = await getRequestIdentity(req, supabase);

  if (identity.kind === "error") {
    return { error: identity.error };
  }

  if (identity.kind === "service_role") {
    // For internal calls, resolve org from draft if possible
    if (options.draftId) {
      const { data: draft } = await supabase
        .from("doc_studio_drafts")
        .select("organization_id")
        .eq("id", options.draftId)
        .maybeSingle();

      return draft
        ? { organizationId: draft.organization_id, userId: "service-role" }
        : { error: jsonResponse({ error: "Draft not found" }, 404, req) };
    }
    return { error: jsonResponse({ error: "Organization context required for service-role calls" }, 400, req) };
  }

  const userId = identity.user.id;

  if (options.draftId) {
    const { data: draft } = await supabase
      .from("doc_studio_drafts")
      .select("organization_id")
      .eq("id", options.draftId)
      .maybeSingle();

    if (!draft) {
      return { error: jsonResponse({ error: "Draft not found" }, 404, req) };
    }

    if (!(await isSuperAdminUser(supabase, userId))) {
      const membership = await verifyOrgMembership(supabase, userId, draft.organization_id, req);
      if (membership.error) return { error: membership.error };
    }

    return { organizationId: draft.organization_id, userId };
  }

  return { error: jsonResponse({ error: "draftId is required to resolve organization context" }, 400, req) };
}

/**
 * Allow internal callers (service-role) or users with access to the scene's
 * parent draft.
 */
export async function requireInternalOrSceneAccess(
  req: Request,
  supabase: SupabaseClient,
  sceneId: string,
): Promise<InternalOrResourceAccessResult> {
  const { data: scene } = await supabase
    .from("doc_studio_scenes")
    .select("draft_id")
    .eq("id", sceneId)
    .maybeSingle();

  if (!scene?.draft_id) {
    return { ok: false, error: jsonResponse({ error: "Scene not found" }, 404, req) };
  }

  return requireInternalOrDraftAccess(req, supabase, scene.draft_id);
}
