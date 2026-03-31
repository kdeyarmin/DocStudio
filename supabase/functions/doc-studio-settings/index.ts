import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, verifySuperAdmin } from "../_shared/auth.ts";
import { jsonResponse as json, corsPreflightResponse } from "../_shared/http.ts";

function bodyOrganizationId(body: Record<string, unknown>): string | null {
  const orgId = body.organization_id;
  if (typeof orgId !== "string") return null;
  const trimmed = orgId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = createServiceClient();

    // All actions in this function are super-admin only (platform-wide settings and API keys).
    const auth = await verifySuperAdmin(req, supabase);
    if (!auth.ok) {
      return auth.error;
    }

    const body = await req.json() as Record<string, unknown>;
    const { action } = body;
    const organizationId = bodyOrganizationId(body);
    if (!organizationId) {
      return json({ error: "organization_id is required" }, 400);
    }

    if (action === "get_setting") {
      const { key } = body;
      if (typeof key !== "string" || key.trim().length === 0) {
        return json({ error: "key is required" }, 400);
      }
      const { data, error } = await supabase
        .from("documentation_settings")
        .select("value_json")
        .eq("organization_id", organizationId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return json({ value_json: data?.value_json ?? null });
    }

    if (action === "set_setting") {
      const { key, value_json } = body;
      if (typeof key !== "string" || key.trim().length === 0) {
        return json({ error: "key is required" }, 400);
      }
      const { error } = await supabase
        .from("documentation_settings")
        .upsert(
          { organization_id: organizationId, key, value_json, updated_at: new Date().toISOString() },
          { onConflict: "organization_id,key" },
        );
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "list_demo_accounts") {
      const { data, error } = await supabase
        .from("documentation_demo_accounts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });
      if (error) throw error;
      return json({ accounts: data ?? [] });
    }

    if (action === "create_demo_account") {
      const { id: _id, ...fields } = body;
      if (typeof fields.name !== "string" || fields.name.trim().length === 0) {
        return json({ error: "name is required" }, 400);
      }
      if (typeof fields.base_url !== "string" || fields.base_url.trim().length === 0) {
        return json({ error: "base_url is required" }, 400);
      }
      if (fields.environment !== "demo" && fields.environment !== "staging") {
        return json({ error: "environment must be 'demo' or 'staging'" }, 400);
      }
      const { data, error } = await supabase
        .from("documentation_demo_accounts")
        .insert({
          organization_id: organizationId,
          name: fields.name,
          environment: fields.environment,
          role: fields.role ?? null,
          username_hint: fields.username_hint ?? null,
          description: fields.description ?? null,
          is_active: fields.is_active ?? true,
          base_url: fields.base_url.trim(),
          login_path: fields.login_path ?? "/login",
          login_selectors: fields.login_selectors ?? {},
          env_password_key: fields.env_password_key ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ account: data });
    }

    if (action === "update_demo_account") {
      const { id, ...fields } = body;
      if (typeof id !== "string" || id.trim().length === 0) {
        return json({ error: "id is required" }, 400);
      }
      const updates: Record<string, unknown> = {};
      if (fields.name !== undefined) {
        if (typeof fields.name !== "string" || fields.name.trim().length === 0) {
          return json({ error: "name must be a non-empty string" }, 400);
        }
        updates.name = fields.name.trim();
      }
      if (fields.environment !== undefined) {
        if (fields.environment !== "demo" && fields.environment !== "staging") {
          return json({ error: "environment must be 'demo' or 'staging'" }, 400);
        }
        updates.environment = fields.environment;
      }
      if (fields.role !== undefined) updates.role = fields.role;
      if (fields.username_hint !== undefined) updates.username_hint = fields.username_hint;
      if (fields.description !== undefined) updates.description = fields.description;
      if (fields.is_active !== undefined) updates.is_active = fields.is_active;
      if (fields.base_url !== undefined) {
        if (typeof fields.base_url !== "string" || fields.base_url.trim().length === 0) {
          return json({ error: "base_url must be a non-empty string" }, 400);
        }
        updates.base_url = fields.base_url.trim();
      }
      if (fields.login_path !== undefined) updates.login_path = fields.login_path;
      if (fields.login_selectors !== undefined) updates.login_selectors = fields.login_selectors;
      if (fields.env_password_key !== undefined) updates.env_password_key = fields.env_password_key;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("documentation_demo_accounts")
        .update(updates)
        .eq("organization_id", organizationId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Demo account not found" }, 404);
      return json({ account: data });
    }

    if (action === "delete_demo_account") {
      const { account_id } = body;
      if (typeof account_id !== "string" || account_id.trim().length === 0) {
        return json({ error: "account_id is required" }, 400);
      }
      const { error } = await supabase
        .from("documentation_demo_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("id", account_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "get_narration_config") {
      const { data: settingRow } = await supabase
        .from("documentation_settings")
        .select("value_json")
        .eq("organization_id", organizationId)
        .eq("key", "narration_config")
        .maybeSingle();

      const { data: keyRow } = await supabase
        .from("platform_global_api_keys")
        .select("service_name, is_active, updated_at")
        .eq("service_name", "elevenlabs")
        .eq("is_active", true)
        .maybeSingle();

      return json({
        narration_config: (settingRow?.value_json ?? {}) as Record<string, unknown>,
        elevenlabs_key_configured: !!keyRow,
      });
    }

    if (action === "save_narration_config") {
      const { elevenlabs_voice_id, elevenlabs_api_key } = body as {
        elevenlabs_voice_id?: string;
        elevenlabs_api_key?: string;
      };

      const { error: cfgErr } = await supabase
        .from("documentation_settings")
        .upsert(
          {
            organization_id: organizationId,
            key: "narration_config",
            value_json: { elevenlabs_voice_id: elevenlabs_voice_id ?? "21m00Tcm4TlvDq8ikWAM" },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,key" },
        );
      if (cfgErr) throw cfgErr;

      if (elevenlabs_api_key && elevenlabs_api_key.trim().length > 0) {
        const { error: keyErr } = await supabase
          .from("platform_global_api_keys")
          .upsert(
            {
              service_name: "elevenlabs",
              api_key: elevenlabs_api_key.trim(),
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "service_name" },
          );
        if (keyErr) throw keyErr;
      }

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error('[doc-studio-settings] Unhandled error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'Internal server error' }, 500);
  }
});
