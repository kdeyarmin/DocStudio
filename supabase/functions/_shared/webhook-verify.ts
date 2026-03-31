function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toBufferSource(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = toBytes(a);
  const bBytes = toBytes(b);
  const maxLength = Math.max(aBytes.length, bBytes.length);

  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

export function matchesAnySecret(
  token: string | null | undefined,
  ...expectedSecrets: Array<string | null | undefined>
): boolean {
  if (!token) return false;

  let matched = false;
  for (const secret of expectedSecrets) {
    if (!secret) continue;
    matched = timingSafeEqual(token, secret) || matched;
  }

  return matched;
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !/^bearer\s+/i.test(authHeader)) {
    return null;
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  return token || null;
}

export function requestMatchesAnySecret(
  req: Request,
  ...expectedSecrets: Array<string | null | undefined>
): boolean {
  return matchesAnySecret(getBearerToken(req), ...expectedSecrets);
}

export function requestMatchesServiceRoleOrSecret(
  req: Request,
  serviceRoleKey: string | null | undefined,
  ...expectedSecrets: Array<string | null | undefined>
): boolean {
  return matchesAnySecret(getBearerToken(req), serviceRoleKey, ...expectedSecrets);
}

async function computeTwilioSignature(url: string, params: Iterable<[string, string]>, authToken: string): Promise<string> {
  const sorted = [...params].sort(([a], [b]) => a.localeCompare(b));
  let payload = url;
  for (const [key, value] of sorted) {
    payload += key + value;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBufferSource(toBytes(authToken)),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, toBufferSource(toBytes(payload)));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyTwilioSignature(req: Request, rawBody: string, authToken: string): Promise<boolean> {
  const twilioSignature = req.headers.get("X-Twilio-Signature");
  if (!twilioSignature) return false;

  const params = new URLSearchParams(rawBody);
  const computed = await computeTwilioSignature(req.url, params.entries(), authToken);
  return timingSafeEqual(computed, twilioSignature);
}
