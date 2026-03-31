export function toMessageContent(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const textParts = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean);
    return textParts.join("\n").trim() || null;
  }
  return null;
}

export interface OrgResolverClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
        };
        limit(value: number): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
        };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
      };
      limit(value: number): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
      };
    };
  };
}

export async function resolveOrganizationId(
  supabase: OrgResolverClient,
  userId: string,
  requestedOrgId?: string,
): Promise<{ organizationId: string | null; isSuperAdmin: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, is_super_admin")
    .eq("id", userId)
    .maybeSingle();

  const isSuperAdmin = !!profile?.is_super_admin;

  if (requestedOrgId) {
    return { organizationId: requestedOrgId, isSuperAdmin };
  }

  const profileOrgId = typeof profile?.organization_id === "string" ? profile.organization_id : null;
  if (profileOrgId) {
    return { organizationId: profileOrgId, isSuperAdmin };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return {
    organizationId: typeof membership?.organization_id === "string" ? membership.organization_id : null,
    isSuperAdmin,
  };
}
