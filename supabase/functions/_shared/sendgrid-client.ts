export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function replaceVariables(template: string | null | undefined, variables: Record<string, unknown>): string {
  const source = template ?? "";
  return source.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

export async function sendViaSendGrid(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  fromAddress: string,
  fromName: string,
  apiKey: string,
  source = "edge-function",
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromAddress, name: fromName || "CareMetric AI" },
        reply_to: { email: fromAddress, name: fromName || "CareMetric AI" },
        subject,
        content: [
          { type: "text/plain", value: textBody || subject },
          { type: "text/html", value: htmlBody },
        ],
      }),
    });

    if (!response.ok && response.status !== 202) {
      const errorText = await response.text();
      console.error(`[${source}] SendGrid error:`, response.status, errorText);
      return { success: false, error: `SendGrid error ${response.status}: ${errorText}` };
    }

    return {
      success: true,
      messageId: response.headers.get("x-message-id") || `sg-${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SendGrid request failed",
    };
  }
}
