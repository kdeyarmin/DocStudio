import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSuperAdminOrTrustedToken } from "../_shared/auth.ts";
import { callAI, resolveAIConfigForTask } from "../_shared/ai-provider.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) { return jsonResponse({ error: "Service not configured" }, 503); }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const auth = await requireSuperAdminOrTrustedToken(req, supabase);
    if (auth.error) return auth.error;

    let body: {
      draftId: string;
      taskType?: string;
      regenerateScenes?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON in request body" }, 400);
    }

    const { draftId, taskType = "content_writing", regenerateScenes = false } = body;

    if (!draftId) {
      return jsonResponse({ success: false, error: "Missing required field: draftId" }, 400);
    }

    const { data: draft } = await supabase
      .from("doc_studio_drafts")
      .select("id, title, description, target_url, output_type, status, steps, generated_content, edited_content, target_role, organization_id")
      .eq("id", draftId)
      .maybeSingle();

    if (!draft) {
      return jsonResponse({ success: false, error: "Draft not found or access denied" }, 404);
    }

    const validTaskTypes = ["tutorial_generation", "content_writing", "narration", "shot_classification", "review_insights"];
    const resolvedTaskType = validTaskTypes.includes(taskType) ? taskType : "content_writing";

    const aiConfig = await resolveAIConfigForTask(supabase, resolvedTaskType);
    if (!aiConfig) {
      return jsonResponse({ success: false, error: "AI service not configured for this task. Please check Platform Settings." }, 503);
    }

    await supabase
      .from("doc_studio_drafts")
      .update({ status: "generating" })
      .eq("id", draftId);

    const systemPrompt = `You are an expert documentation and tutorial content creator. Generate clear, engaging, and well-structured content for software documentation and training materials. Follow best practices for technical writing. Be thorough but concise.`;

    const stepsContext = draft.steps && Array.isArray(draft.steps)
      ? `\nWorkflow Steps:\n${draft.steps.map((s: unknown, i: number) => `${i + 1}. ${typeof s === "string" ? s : JSON.stringify(s)}`).join("\n")}`
      : "";

    const userMessage = `Generate documentation content for the following:

Title: ${draft.title || "Untitled"}
${draft.description ? `Description: ${draft.description}` : ""}
${draft.target_url ? `Target URL/Feature: ${draft.target_url}` : ""}
${draft.output_type ? `Output Type: ${draft.output_type}` : ""}
${draft.target_role ? `Target Audience: ${draft.target_role}` : ""}
${stepsContext}

Please generate comprehensive, structured content including:
1. An overview/introduction
2. Step-by-step instructions (if applicable)
3. Key points and best practices
4. A summary

Format the response as JSON with this structure:
{
  "overview": "string",
  "sections": [{"title": "string", "content": "string", "order": number}],
  "keyPoints": ["string"],
  "summary": "string"
}`;

    let generatedContent: unknown;
    try {
      const aiResponse = await callAI(aiConfig, {
        systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        temperature: 0.4,
        maxTokens: 8192,
      });

      try {
        const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
        generatedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { overview: aiResponse.text, sections: [], keyPoints: [], summary: "" };
      } catch {
        generatedContent = { overview: aiResponse.text, sections: [], keyPoints: [], summary: "" };
      }
    } catch (aiError: unknown) {
      await supabase
        .from("doc_studio_drafts")
        .update({ status: "failed" })
        .eq("id", draftId);

      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      return jsonResponse({ success: false, error: errMsg }, 500);
    }

    const { data: updatedDraft, error: updateError } = await supabase
      .from("doc_studio_drafts")
      .update({
        status: "generated",
        generated_content: generatedContent,
      })
      .eq("id", draftId)
      .select()
      .single();

    if (updateError) {
      return jsonResponse({ success: false, error: "Failed to save generated content" }, 500);
    }

    if (regenerateScenes) {
      const contentObj = generatedContent as Record<string, unknown>;
      const contentSections = (Array.isArray(contentObj?.sections) ? contentObj.sections : []) as Record<string, unknown>[];
      if (contentSections.length > 0) {
        const { error: deleteErr } = await supabase.from("doc_studio_scenes").delete().eq("draft_id", draftId);
        if (deleteErr) console.error("[doc-studio-generate-content] Failed to delete old scenes:", deleteErr.message);
        const scenesToInsert = contentSections.map((section: Record<string, unknown>, index: number) => ({
          draft_id: draftId,
          scene_order: index + 1,
          title: (section.title as string) || `Scene ${index + 1}`,
          summary: typeof section.content === "string" ? section.content.substring(0, 200) : "",
          narration_text: typeof section.content === "string" ? section.content : "",
        }));
        const { error: insertErr } = await supabase.from("doc_studio_scenes").insert(scenesToInsert);
        if (insertErr) console.error("[doc-studio-generate-content] Failed to insert scenes:", insertErr.message);
      }
    }

    return jsonResponse({ success: true, draft: updatedDraft, generatedContent } as Record<string, unknown>);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: errMsg }, 500);
  }
});
