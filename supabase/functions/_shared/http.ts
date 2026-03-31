/**
 * Shared CORS headers and JSON response helpers for all Edge Functions.
 */

const ALLOWED_ORIGINS = [
  "https://caremetric.ai",
  "https://app.caremetric.ai",
  "https://www.caremetric.ai",
];

/** Resolve the CORS origin for a given request. */
export function getAllowedOrigin(req?: Request): string {
  const origin = req?.headers.get("Origin") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "";

  // In local development, allow the exact dev server origin only
  if (siteUrl && siteUrl.startsWith("http://localhost")) {
    if (origin === siteUrl) {
      return origin;
    }
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // If SITE_URL is a production URL not in the static list, allow it
  if (siteUrl && origin === siteUrl) {
    return origin;
  }

  // Default: return the primary domain (browser will block mismatched origins)
  return ALLOWED_ORIGINS[0];
}

export function getCorsHeaders(req?: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

/**
 * @deprecated Use getCorsHeaders(req) for origin-validated CORS.
 * Kept for backward compatibility with functions that don't pass the request.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

/** Standard JSON response with CORS headers. */
export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  req?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

/** Pre-built CORS preflight response. */
export function corsPreflightResponse(req?: Request): Response {
  return new Response(null, { status: 200, headers: getCorsHeaders(req) });
}

/** Escape special Postgres LIKE/ILIKE characters (\, %, _) in user input. */
export function escapeIlike(value: string): string {
  return value
    .replace(/\0/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Standardized success response.
 * All Edge Functions should use this for consistent API responses.
 */
export function successResponse(
  data: Record<string, unknown> = {},
  req?: Request,
  status = 200,
): Response {
  return jsonResponse({ success: true, ...data }, status, req);
}

/**
 * Standardized error response.
 * All Edge Functions should use this for consistent error responses.
 *
 * @param message - User-safe error message
 * @param status - HTTP status code (default 400)
 * @param req - Original request for CORS headers
 * @param code - Optional machine-readable error code for client handling
 */
export function errorResponse(
  message: string,
  status = 400,
  req?: Request,
  code?: string,
): Response {
  const body: Record<string, unknown> = { success: false, error: message };
  if (code) body.code = code;
  return jsonResponse(body, status, req);
}
