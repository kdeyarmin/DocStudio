import { jsonResponse } from "./http.ts";

/**
 * Standardized error response helper for Edge Functions.
 *
 * Wraps `jsonResponse` so every error body has a consistent shape:
 *   { success: false, error: "<message>"[, details: "<details>"] }
 *
 * CORS headers are included automatically when the originating `req` is
 * provided.
 */
export function errorResponse(message: string, status = 400, req?: Request, details?: string) {
  const body: Record<string, unknown> = { success: false, error: message };
  if (details) body.details = details;
  return jsonResponse(body, status, req);
}

export function internalError(message = "Internal server error", req?: Request) {
  return errorResponse(message, 500, req);
}
