import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeUsPhoneNumber } from "./phone.ts";

type PlatformSmsConfig = {
  sms_account_sid?: string | null;
  sms_auth_token?: string | null;
  sms_from_phone?: string | null;
  sms_enabled?: boolean | null;
};

type SmsLogInsert = {
  organization_id: string;
  patient_id: string | null;
  user_id?: string | null;
  to_phone: string;
  from_phone: string;
  message: string;
  status: string;
  error_message?: string;
  twilio_sid?: string;
  sent_at: string;
};

async function resolveSmsConfig(supabase: SupabaseClient) {
  let accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  let authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  let fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromPhone) {
    const { data: config } = await supabase
      .from("platform_integration_config")
      .select("sms_account_sid, sms_auth_token, sms_from_phone, sms_enabled")
      .limit(1)
      .maybeSingle<PlatformSmsConfig>();

    if (!config?.sms_enabled) {
      throw new Error("SMS integration is disabled");
    }

    accountSid ||= config.sms_account_sid ?? undefined;
    authToken ||= config.sms_auth_token ?? undefined;
    fromPhone ||= config.sms_from_phone ?? undefined;
  }

  if (!accountSid || !authToken || !fromPhone) {
    throw new Error("SMS credentials not configured");
  }

  return { accountSid, authToken, fromPhone };
}

export async function sendSmsViaEdge(
  to: string,
  message: string,
  patientId: string | null,
  organizationId: string,
  source = "edge-function",
  options?: { userId?: string | null; fromPhone?: string | null },
): Promise<{ ok: boolean; sid?: string; status?: string; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Service not configured" };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { accountSid, authToken, fromPhone: configuredFromPhone } = await resolveSmsConfig(supabase);
    const toPhone = normalizeUsPhoneNumber(to);
    const fromPhone = options?.fromPhone ? normalizeUsPhoneNumber(options.fromPhone) : configuredFromPhone;
    const auth = btoa(`${accountSid}:${authToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: toPhone,
      From: fromPhone,
      Body: message,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => ({} as { sid?: string; status?: string; message?: string }));

    if (!response.ok) {
      const error = payload.message || `Twilio error ${response.status}`;
      console.error(`[${source}] SMS send failed:`, error);
      const failedLog: SmsLogInsert = {
        organization_id: organizationId,
        patient_id: patientId,
        user_id: options?.userId ?? null,
        to_phone: toPhone,
        from_phone: fromPhone,
        message,
        status: "failed",
        error_message: error,
        sent_at: new Date().toISOString(),
      };
      await supabase.from("sms_logs").insert(failedLog as Record<string, unknown>);
      return { ok: false, error };
    }

    const sentLog: SmsLogInsert = {
      organization_id: organizationId,
      patient_id: patientId,
      user_id: options?.userId ?? null,
      to_phone: toPhone,
      from_phone: fromPhone,
      message,
      status: payload.status || "sent",
      twilio_sid: payload.sid,
      sent_at: new Date().toISOString(),
    };
    await supabase.from("sms_logs").insert(sentLog as Record<string, unknown>);

    return { ok: true, sid: payload.sid, status: payload.status };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Failed to send SMS";
    console.error(`[${source}] SMS send exception:`, messageText);
    return { ok: false, error: messageText };
  }
}
