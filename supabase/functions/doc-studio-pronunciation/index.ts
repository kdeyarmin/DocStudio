import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient, verifySuperAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsPreflightResponse } from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabase = createServiceClient();
    const authz = await verifySuperAdmin(req, supabase);
    if (!authz.ok) return authz.error;

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      const { category, enabled_only } = body;
      let query = supabase.from("documentation_pronunciation_dictionary").select("*").order("term");
      if (category) query = query.eq("category", category);
      if (enabled_only) query = query.eq("is_enabled", true);

      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ entries: data });
    }

    if (action === "get") {
      const { entry_id } = body;
      if (!entry_id) return errorResponse("entry_id required", 400);

      const { data, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .select("*")
        .eq("id", entry_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return errorResponse("Entry not found", 404);
      return successResponse({ entry: data });
    }

    if (action === "create") {
      const { term, phonetic_spelling, category, notes, is_enabled, replacement_mode, substitute_text, provider_compat, metadata_json } = body;
      if (!term) return errorResponse("term required", 400);

      const { data, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .insert({
          term,
          phonetic_spelling: phonetic_spelling ?? null,
          category: category ?? "general",
          notes: notes ?? null,
          is_enabled: is_enabled ?? true,
          replacement_mode: replacement_mode ?? "phonetic",
          substitute_text: substitute_text ?? null,
          provider_compat: provider_compat ?? ["elevenlabs"],
          metadata_json: metadata_json ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return successResponse({ entry: data });
    }

    if (action === "update") {
      const { entry_id, ...updates } = body;
      if (!entry_id) return errorResponse("entry_id required", 400);

      const allowed = ["term", "phonetic_spelling", "category", "notes", "is_enabled", "replacement_mode", "substitute_text", "provider_compat", "metadata_json"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) patch[k] = updates[k];
      }

      const { data, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .update(patch)
        .eq("id", entry_id)
        .select()
        .single();

      if (error) throw error;
      return successResponse({ entry: data });
    }

    if (action === "delete") {
      const { entry_id } = body;
      if (!entry_id) return errorResponse("entry_id required", 400);

      const { error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .delete()
        .eq("id", entry_id);

      if (error) throw error;
      return successResponse({ deleted: true });
    }

    if (action === "toggle") {
      const { entry_id, is_enabled } = body;
      if (!entry_id || is_enabled === undefined) return errorResponse("entry_id and is_enabled required", 400);

      const { data, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .update({ is_enabled })
        .eq("id", entry_id)
        .select()
        .single();

      if (error) throw error;
      return successResponse({ entry: data });
    }

    if (action === "apply_to_text") {
      const { text, provider } = body;
      if (!text) return errorResponse("text required", 400);

      const { data: entries, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .select("*")
        .eq("is_enabled", true);

      if (error) throw error;

      let result = text;
      for (const entry of entries ?? []) {
        if (entry.replacement_mode === "none") continue;
        if (provider && Array.isArray(entry.provider_compat) && !entry.provider_compat.includes(provider)) continue;
        if (!entry.substitute_text && !entry.phonetic_spelling) continue;

        const regex = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, "gi");
        if (entry.replacement_mode === "substitute" && entry.substitute_text) {
          result = result.replace(regex, entry.substitute_text);
        } else if (entry.replacement_mode === "ssml" && entry.phonetic_spelling) {
          result = result.replace(regex, `<phoneme alphabet="ipa" ph="${escapeXmlAttr(entry.phonetic_spelling)}">${escapeXmlAttr(entry.term)}</phoneme>`);
        }
      }

      return successResponse({ original_text: text, processed_text: result, entries_applied: entries?.length ?? 0 });
    }

    if (action === "preview_pronunciation") {
      const { text, provider } = body;
      if (!text) return errorResponse("text required", 400);

      const { data: entries, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .select("*")
        .eq("is_enabled", true);

      if (error) throw error;

      let result = text;
      const appliedEntries: Array<{
        term: string;
        mode: string;
        replacement: string;
        match_count: number;
        compatible: boolean;
      }> = [];

      for (const entry of entries ?? []) {
        if (entry.replacement_mode === "none") continue;
        if (!entry.substitute_text && !entry.phonetic_spelling) continue;

        const compatible = !provider
          || !Array.isArray(entry.provider_compat)
          || entry.provider_compat.includes(provider);

        if (!compatible) {
          appliedEntries.push({
            term: entry.term,
            mode: entry.replacement_mode,
            replacement: entry.substitute_text ?? entry.phonetic_spelling ?? "",
            match_count: 0,
            compatible: false,
          });
          continue;
        }

        const regex = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, "gi");
        const matches = [...result.matchAll(regex)];
        if (matches.length === 0) continue;

        let replacement = "";
        if (entry.replacement_mode === "substitute" && entry.substitute_text) {
          replacement = entry.substitute_text;
          result = result.replace(regex, replacement);
        } else if (entry.replacement_mode === "ssml" && entry.phonetic_spelling) {
          replacement = `<phoneme alphabet="ipa" ph="${escapeXmlAttr(entry.phonetic_spelling)}">${escapeXmlAttr(entry.term)}</phoneme>`;
          result = result.replace(regex, replacement);
        } else {
          continue;
        }

        appliedEntries.push({
          term: entry.term,
          mode: entry.replacement_mode,
          replacement,
          match_count: matches.length,
          compatible: true,
        });
      }

      return successResponse({
        original_text: text,
        processed_text: result,
        applied_entries: appliedEntries,
        applied_count: appliedEntries.filter(e => e.compatible && e.match_count > 0).length,
        skipped_incompatible: appliedEntries.filter(e => !e.compatible).length,
      });
    }

    if (action === "bulk_import") {
      const { entries } = body;
      if (!Array.isArray(entries) || !entries.length) return errorResponse("entries array required", 400);

      const allowedFields = ["term", "phonetic_spelling", "category", "notes", "is_enabled", "replacement_mode", "substitute_text", "provider_compat", "metadata_json"];
      const sanitized = entries.map((e: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        for (const f of allowedFields) {
          if (e[f] !== undefined) row[f] = e[f];
        }
        return row;
      });

      const { data, error } = await supabase
        .from("documentation_pronunciation_dictionary")
        .upsert(sanitized, { onConflict: "term" })
        .select();

      if (error) throw error;
      return successResponse({ entries: data, count: data?.length ?? 0 });
    }

    return errorResponse(`Unknown action: ${action}`, 400);
  } catch (err: unknown) {
    console.error('[doc-studio-pronunciation] Unhandled error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function successResponse(data: Record<string, unknown>) {
  return jsonResponse({ success: true, ...data });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}
