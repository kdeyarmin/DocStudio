import { extractBearerToken, isValidPlaywrightCallbackToken } from "../_shared/doc-studio-auth.ts";

export function resolvePlaywrightCallbackTokenFromEnv(
  envGet: (name: string) => string | undefined,
): string | null {
  const callbackSecret = envGet("PLAYWRIGHT_CALLBACK_SECRET");
  const supabaseAnonKey = envGet("SUPABASE_ANON_KEY");

  if (!callbackSecret && !supabaseAnonKey) return null;
  // Prefer dedicated callback secret when configured.
  return callbackSecret ?? supabaseAnonKey ?? null;
}

export function isAuthorizedPlaywrightRequest(
  req: Request,
  envGet: (name: string) => string | undefined = (name) => Deno.env.get(name),
): boolean {
  const bearerToken = extractBearerToken(req.headers.get("Authorization"));
  if (!bearerToken) return false;

  return isValidPlaywrightCallbackToken(
    bearerToken,
    envGet("PLAYWRIGHT_CALLBACK_SECRET"),
    envGet("SUPABASE_ANON_KEY"),
  );
}
