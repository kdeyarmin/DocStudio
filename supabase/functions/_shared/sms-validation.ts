/**
 * Input validation helpers for the send-sms edge function.
 *
 * Extracted to allow unit testing without standing up the full Deno.serve handler.
 */

export interface SendSMSRequest {
  to: string;
  message: string;
  patientId?: string;
  organizationId: string;
}

export function getRequiredString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

export function getOptionalString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
  }
  return undefined;
}

export function parseSendSMSRequest(body: unknown): { data?: SendSMSRequest; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid JSON in request body" };
  }

  const payload = body as Record<string, unknown>;
  const to = getRequiredString(payload.to);
  const message = getRequiredString(payload.message, payload.body);
  const organizationId = getRequiredString(payload.organizationId, payload.organization_id);
  const patientId = getOptionalString(payload.patientId, payload.patient_id);

  if (!to || !message || !organizationId) {
    return { error: "Missing required fields: to, message, organizationId" };
  }

  return {
    data: {
      to,
      message,
      patientId,
      organizationId,
    },
  };
}
