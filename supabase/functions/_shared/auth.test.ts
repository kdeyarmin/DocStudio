/**
 * Unit tests for doc-studio auth helper utilities.
 *
 * Run with:
 *   deno test --allow-none supabase/functions/_shared/auth.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireSharedSecret } from "./auth.ts";

Deno.test("requireSharedSecret rejects missing configured secret", () => {
  const req = new Request("https://example.test/functions/v1/doc-studio-jobs", {
    method: "POST",
    headers: { Authorization: "Bearer anything" },
  });

  const response = requireSharedSecret(req, "");
  assertEquals(response?.status, 503);
});

Deno.test("requireSharedSecret rejects missing authorization header", async () => {
  const req = new Request("https://example.test/functions/v1/doc-studio-jobs", {
    method: "POST",
  });

  const response = requireSharedSecret(req, "shared-secret");
  assertEquals(response?.status, 401);
  assertEquals(await response?.json(), { error: "Missing authorization header" });
});

Deno.test("requireSharedSecret rejects wrong bearer token", async () => {
  const req = new Request("https://example.test/functions/v1/doc-studio-jobs", {
    method: "POST",
    headers: { Authorization: "Bearer wrong-secret" },
  });

  const response = requireSharedSecret(req, "shared-secret");
  assertEquals(response?.status, 401);
  assertEquals(await response?.json(), { error: "Invalid shared secret" });
});

Deno.test("requireSharedSecret accepts matching bearer token", () => {
  const req = new Request("https://example.test/functions/v1/doc-studio-jobs", {
    method: "POST",
    headers: { Authorization: "Bearer shared-secret" },
  });

  const response = requireSharedSecret(req, "shared-secret");
  assertEquals(response, null);
});
