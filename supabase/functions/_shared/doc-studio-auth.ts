import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { verifyOrgMembership } from "./auth.ts";

/**
 * Extract the raw token from an Authorization header value.
 * Returns null when the header is missing or not a Bearer token.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) return null;
  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  return token || null;
}

/**
 * Check whether a bearer token matches one of the accepted callback secrets.
 * Accepts either a dedicated PLAYWRIGHT_CALLBACK_SECRET or the SUPABASE_ANON_KEY
 * as a fallback for environments that haven't configured a separate secret.
 */
export function isValidPlaywrightCallbackToken(
  token: string,
  callbackSecret: string | undefined,
  supabaseAnonKey: string | undefined,
): boolean {
  if (!token) return false;
  if (callbackSecret && token === callbackSecret) return true;
  if (supabaseAnonKey && token === supabaseAnonKey) return true;
  return false;
}

type JobOrgRow = {
  organization_id?: string | null;
  draft_id?: string | null;
};

type DraftOrgRow = {
  organization_id?: string | null;
};

type QueryResult = Promise<{ data: Record<string, unknown> | null; error: unknown }>;

type ChainableQuery = {
  eq(column: string, value: unknown): ChainableQuery;
  maybeSingle(): QueryResult;
};

export type TableLikeClient = {
  from(table: string): {
    select(columns: string): ChainableQuery;
  };
};

export type MembershipVerifier = (
  userId: string,
  organizationId: string,
  req?: Request,
) => Promise<{ allowed: boolean; status?: number }>;

export function createDocStudioAccessResolver(
  client: TableLikeClient,
  verifyMembership: MembershipVerifier,
  userId: string,
  req?: Request,
) {
  const ensureOrgAccess = async (organizationId: string | null | undefined) => {
    if (!organizationId) {
      return { allowed: false, status: 400 };
    }

    return verifyMembership(userId, organizationId, req);
  };

  const resolveDraftOrganizationId = async (draftId: string | null | undefined): Promise<string | null> => {
    if (!draftId) return null;

    const { data, error } = await client
      .from("doc_studio_drafts")
      .select("organization_id")
      .eq("id", draftId)
      .maybeSingle();

    if (error) throw error;
    return (data as DraftOrgRow | null)?.organization_id ?? null;
  };

  const resolveJobOrganizationId = async (jobId: string | null | undefined): Promise<string | null> => {
    if (!jobId) return null;

    const { data, error } = await client
      .from("documentation_jobs")
      .select("organization_id, draft_id")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw error;

    const job = data as JobOrgRow | null;
    if (!job) return null;
    if (job.organization_id) return job.organization_id;
    return await resolveDraftOrganizationId(job.draft_id ?? null);
  };

  const resolveActiveOrganizationIds = async (): Promise<string[]> => {
    const chain = client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("is_active", true);

    // Supabase select chains are thenable — await directly for list results.
    const { data, error } = await (chain as unknown as Promise<{
      data: Array<{ organization_id: string }> | null;
      error: unknown;
    }>);

    if (error) throw error;

    return (data ?? [])
      .map((row) => row.organization_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  };

  return {
    ensureOrgAccess,
    resolveDraftOrganizationId,
    resolveJobOrganizationId,
    resolveActiveOrganizationIds,
  };
}

function createSupabaseMembershipVerifier(
  supabase: SupabaseClient,
): MembershipVerifier {
  return async (userId, organizationId, request) => {
    const membership = await verifyOrgMembership(supabase, userId, organizationId, request);
    return membership.error
      ? { allowed: false, status: 403 }
      : { allowed: true };
  };
}

export function createDocStudioAccessVerifier(
  supabase: SupabaseClient,
  userId: string,
  req?: Request,
) {
  const resolver = createDocStudioAccessResolver(
    supabase as unknown as TableLikeClient,
    createSupabaseMembershipVerifier(supabase),
    userId,
    req,
  );

  return {
    ...resolver,
    async verifyDraftAccess(draftId: string): Promise<boolean> {
      const organizationId = await resolver.resolveDraftOrganizationId(draftId);
      const result = await resolver.ensureOrgAccess(organizationId);
      return result.allowed;
    },
    async verifyJobAccess(jobId: string): Promise<boolean> {
      const organizationId = await resolver.resolveJobOrganizationId(jobId);
      const result = await resolver.ensureOrgAccess(organizationId);
      return result.allowed;
    },
  };
}

export async function ensureDocStudioOrgAccess(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null | undefined,
  req?: Request,
): Promise<Response | null> {
  const resolver = createDocStudioAccessResolver(
    supabase as unknown as TableLikeClient,
    createSupabaseMembershipVerifier(supabase),
    userId,
    req,
  );
  const result = await resolver.ensureOrgAccess(organizationId);
  if (result.allowed) return null;

  const status = result.status ?? 403;
  const message = status === 400
    ? "Organization context is required"
    : "Not authorized for this organization";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function resolveDraftOrganizationId(
  supabase: SupabaseClient,
  draftId: string | null | undefined,
): Promise<string | null> {
  return createDocStudioAccessVerifier(supabase, "").resolveDraftOrganizationId(draftId);
}

export async function resolveJobOrganizationId(
  supabase: SupabaseClient,
  jobId: string | null | undefined,
): Promise<string | null> {
  return createDocStudioAccessVerifier(supabase, "").resolveJobOrganizationId(jobId);
}

export async function canAccessDocStudioDraft(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  req?: Request,
): Promise<boolean> {
  return createDocStudioAccessVerifier(supabase, userId, req).verifyDraftAccess(draftId);
}

export async function canAccessDocStudioJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  req?: Request,
): Promise<boolean> {
  return createDocStudioAccessVerifier(supabase, userId, req).verifyJobAccess(jobId);
}

export const resolveDocStudioDraftOrganizationId = resolveDraftOrganizationId;
export const resolveDocStudioJobOrganizationId = resolveJobOrganizationId;
