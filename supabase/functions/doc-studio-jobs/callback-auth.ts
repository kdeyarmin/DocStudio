import { extractBearerToken, isValidPlaywrightCallbackToken } from "../_shared/doc-studio-auth.ts";

export function isAuthorizedRunnerCallback(req: Request): boolean {
  return isAuthorizedRunnerCallbackWithEnv(req, (name) => Deno.env.get(name));
}

export function isAuthorizedRunnerCallbackWithEnv(
  req: Request,
  envGet: (name: string) => string | undefined,
): boolean {
  const bearerToken = extractBearerToken(req.headers.get("Authorization"));
  if (!bearerToken) return false;

  return isValidPlaywrightCallbackToken(
    bearerToken,
    envGet("PLAYWRIGHT_CALLBACK_SECRET"),
    envGet("SUPABASE_ANON_KEY"),
  );
}

