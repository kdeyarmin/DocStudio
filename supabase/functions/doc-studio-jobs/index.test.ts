import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isAuthorizedRunnerCallbackWithEnv } from "./callback-auth.ts";

Deno.test("isAuthorizedRunnerCallbackWithEnv: rejects missing or malformed bearer token", () => {
  const noAuthReq = new Request("https://example.com");
  assertEquals(isAuthorizedRunnerCallbackWithEnv(noAuthReq, () => undefined), false);

  const malformedAuthReq = new Request("https://example.com", {
    headers: { Authorization: "Token abc" },
  });
  assertEquals(isAuthorizedRunnerCallbackWithEnv(malformedAuthReq, () => undefined), false);
});

Deno.test("isAuthorizedRunnerCallbackWithEnv: accepts callback secret and anon fallback", () => {
  const envGet = (name: string): string | undefined => {
    if (name === "PLAYWRIGHT_CALLBACK_SECRET") return "callback-secret";
    if (name === "SUPABASE_ANON_KEY") return "anon-key";
    return undefined;
  };

  const callbackSecretReq = new Request("https://example.com", {
    headers: { Authorization: "Bearer callback-secret" },
  });
  assertEquals(isAuthorizedRunnerCallbackWithEnv(callbackSecretReq, envGet), true);

  const anonFallbackReq = new Request("https://example.com", {
    headers: { Authorization: "Bearer anon-key" },
  });
  assertEquals(isAuthorizedRunnerCallbackWithEnv(anonFallbackReq, envGet), true);

  const wrongTokenReq = new Request("https://example.com", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  assertEquals(isAuthorizedRunnerCallbackWithEnv(wrongTokenReq, envGet), false);
});
