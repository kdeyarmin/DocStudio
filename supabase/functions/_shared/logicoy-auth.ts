import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchWithTimeout, sleep } from "./http-client.ts";

export type LogicoyPlatformConfig = {
  logicoy_api_url: string;
  logicoy_token_url?: string | null;
  logicoy_client_id: string | null;
  logicoy_private_key: string | null;
  logicoy_client_assertion_jwt: string | null;
  logicoy_client_registration_pk_uuid?: string | null;
  logicoy_api_key: string | null;
};

export type JwtVerificationResult = {
  userId: string | null;
  error: string | null;
};

const TOKEN_RETRY_ATTEMPTS = 3;
const TOKEN_RETRY_DELAY_MS = 500;
const CLOCK_SKEW_SECONDS = 60;
const CLIENT_ASSERTION_TTL_SECONDS = 300;
const CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const RSA_PRIVATE_KEY_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
const PKCS8_PRIVATE_KEY_HEADER = "-----BEGIN PRIVATE KEY-----";

export async function verifySupabaseJwt(
  supabase: SupabaseClient,
  token: string,
): Promise<JwtVerificationResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return { userId: null, error: "ERX_AUTH_INVALID" };
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(normalizedToken);

    if (error || !user) {
      return { userId: null, error: "ERX_AUTH_INVALID" };
    }

    return { userId: user.id, error: null };
  } catch {
    return { userId: null, error: "ERX_AUTH_INVALID" };
  }
}

function normalizeComparableUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function normalizeTokenEndpoint(platformConfig: LogicoyPlatformConfig): string {
  const explicitEndpoint = platformConfig.logicoy_token_url?.trim();
  if (explicitEndpoint) {
    return normalizeComparableUrl(explicitEndpoint);
  }

  const apiUrl = platformConfig.logicoy_api_url?.trim();
  if (!apiUrl) {
    throw new Error("LogiCoy API URL is not configured.");
  }

  const normalizedApiBase = normalizeComparableUrl(apiUrl)
    .replace(/\/erxapi$/i, "");

  return `${normalizedApiBase}/erxapi/oauth2/token`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeBase64UrlString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function decodeBase64UrlString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function encodeDerLength(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }

  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }

  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function encodeDer(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const payloadLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(1 + encodeDerLength(payloadLength).length + payloadLength);
  output[0] = tag;

  const lengthBytes = encodeDerLength(payloadLength);
  output.set(lengthBytes, 1);

  let offset = 1 + lengthBytes.length;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function wrapPkcs1PrivateKeyAsPkcs8(pkcs1Der: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaEncryptionAlgorithm = encodeDer(
    0x30,
    new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]),
    new Uint8Array([0x05, 0x00]),
  );
  const privateKeyOctetString = encodeDer(0x04, pkcs1Der);

  return encodeDer(0x30, version, rsaEncryptionAlgorithm, privateKeyOctetString);
}

function decodePemBody(pemKey: string): Uint8Array {
  const pemBody = pemKey
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");

  if (!pemBody) {
    throw new Error("LogiCoy private key is empty or malformed.");
  }

  try {
    return Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0));
  } catch {
    throw new Error("LogiCoy private key is not valid base64-encoded key data.");
  }
}

async function importRsaPrivateKey(pemKey: string): Promise<CryptoKey> {
  const trimmedPem = pemKey.trim();

  if (!trimmedPem.includes(PKCS8_PRIVATE_KEY_HEADER) && !trimmedPem.includes(RSA_PRIVATE_KEY_HEADER)) {
    throw new Error("LogiCoy private key must be PEM-encoded and begin with BEGIN PRIVATE KEY or BEGIN RSA PRIVATE KEY.");
  }

  const derBytes = decodePemBody(trimmedPem);
  const keyData = trimmedPem.includes(RSA_PRIVATE_KEY_HEADER)
    ? wrapPkcs1PrivateKeyAsPkcs8(derBytes)
    : derBytes;

  const keyBuffer = new ArrayBuffer(keyData.byteLength);
  new Uint8Array(keyBuffer).set(keyData);

  try {
    const pkcs8Bytes = new Uint8Array(keyData);
    return await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Bytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new Error("LogiCoy private key could not be imported. Ensure the PEM is a valid RSA PKCS#8 or PKCS#1 private key.");
  }
}

function parseJwtPart(token: string, index: number, label: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Stored LogiCoy client assertion JWT is malformed.");
  }

  try {
    const json = decodeBase64UrlString(parts[index]);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid payload");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Stored LogiCoy client assertion JWT ${label} is invalid.`);
  }
}

function parseJwtHeader(token: string): Record<string, unknown> {
  return parseJwtPart(token, 0, "header");
}

function parseJwtPayload(token: string): Record<string, unknown> {
  return parseJwtPart(token, 1, "payload");
}

function getAudienceValues(payload: Record<string, unknown>): string[] {
  if (typeof payload.aud === "string") {
    return [payload.aud];
  }

  if (Array.isArray(payload.aud)) {
    return payload.aud.filter((entry): entry is string => typeof entry === "string");
  }

  return [];
}

function validateStoredClientAssertion(
  clientAssertionJwt: string,
  clientId: string | null,
  tokenEndpoint: string,
  clientRegistrationPkUuid: string | null,
): void {
  if (!clientId?.trim()) {
    throw new Error("Stored LogiCoy client assertion JWT requires a configured client ID.");
  }

  const expectedKeyId = clientRegistrationPkUuid?.trim() || null;
  if (!expectedKeyId) {
    throw new Error("Stored LogiCoy client assertion JWT requires a configured client registration UUID.");
  }

  const header = parseJwtHeader(clientAssertionJwt);
  const payload = parseJwtPayload(clientAssertionJwt);
  const normalizedClientId = clientId.trim();
  const normalizedTokenEndpoint = normalizeComparableUrl(tokenEndpoint);
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const iat = payload.iat == null ? null : Number(payload.iat);
  const nbf = payload.nbf == null ? null : Number(payload.nbf);
  const audValues = getAudienceValues(payload)
    .map((audience) => normalizeComparableUrl(audience))
    .filter(Boolean);

  if (header.alg !== "RS256") {
    throw new Error("Stored LogiCoy client assertion JWT alg header must be RS256.");
  }
  if (header.typ != null && header.typ !== "JWT") {
    throw new Error("Stored LogiCoy client assertion JWT typ header must be JWT.");
  }
  if (!Number.isFinite(exp)) {
    throw new Error("Stored LogiCoy client assertion JWT is missing a valid exp claim.");
  }
  if (exp <= now + CLOCK_SKEW_SECONDS) {
    throw new Error("Stored LogiCoy client assertion JWT is expired or will expire too soon.");
  }
  if (iat != null && !Number.isFinite(iat)) {
    throw new Error("Stored LogiCoy client assertion JWT iat claim is invalid.");
  }
  if (iat != null && iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Stored LogiCoy client assertion JWT iat claim is in the future.");
  }
  if (nbf != null && !Number.isFinite(nbf)) {
    throw new Error("Stored LogiCoy client assertion JWT nbf claim is invalid.");
  }
  if (nbf != null && nbf > now + CLOCK_SKEW_SECONDS) {
    throw new Error("Stored LogiCoy client assertion JWT is not valid yet.");
  }
  if (audValues.length === 0) {
    throw new Error("Stored LogiCoy client assertion JWT is missing a valid aud claim.");
  }
  if (!audValues.includes(normalizedTokenEndpoint)) {
    throw new Error("Stored LogiCoy client assertion JWT aud claim does not match the configured token endpoint.");
  }
  if (payload.iss !== normalizedClientId || payload.sub !== normalizedClientId) {
    throw new Error("Stored LogiCoy client assertion JWT iss/sub claims do not match the configured client ID.");
  }
  if (typeof payload.jti !== "string" || payload.jti.trim().length === 0) {
    throw new Error("Stored LogiCoy client assertion JWT is missing a valid jti claim.");
  }
  if (header.kid !== expectedKeyId) {
    throw new Error("Stored LogiCoy client assertion JWT kid header does not match the configured client registration UUID.");
  }
}

async function signClientAssertionJwt(
  clientId: string,
  tokenEndpoint: string,
  privateKey: CryptoKey,
  keyId: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    iat: now,
    exp: now + CLIENT_ASSERTION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };

  const signingInput = `${encodeBase64UrlString(JSON.stringify(header))}.${encodeBase64UrlString(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function isTransientTokenStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isTransientTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("AbortError")
    || message.includes("timed out")
    || message.includes("fetch failed")
    || message.includes("network")
    || message.includes("ECONNRESET")
    || message.includes("ENOTFOUND");
}

function isTransientTokenStatusFromMessage(message: string): boolean {
  const statusMatch = message.match(/Token exchange failed \((\d+)\)/);
  if (!statusMatch) {
    return false;
  }
  return isTransientTokenStatus(Number(statusMatch[1]));
}

async function exchangeToken(
  tokenEndpoint: string,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<string> {
  const response = await fetchWithTimeout(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }, 30_000, fetchImpl);

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${responseText}`);
  }

  let json: { access_token?: string };
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Token exchange succeeded (${response.status}) but returned non-JSON response`);
  }

  if (!json.access_token || typeof json.access_token !== "string") {
    throw new Error(`Token exchange succeeded (${response.status}) but response missing access_token`);
  }

  return json.access_token;
}

async function exchangeTokenWithRetry(
  tokenEndpoint: string,
  bodyFactory: () => URLSearchParams,
  logContext: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  for (let attempt = 1; attempt <= TOKEN_RETRY_ATTEMPTS; attempt++) {
    try {
      return await exchangeToken(tokenEndpoint, bodyFactory(), fetchImpl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = isTransientTokenError(error) || isTransientTokenStatusFromMessage(message);

      if (attempt === TOKEN_RETRY_ATTEMPTS || !shouldRetry) {
        throw error;
      }

      console.warn(`[${logContext}] LogiCoy token exchange attempt ${attempt}/${TOKEN_RETRY_ATTEMPTS} failed; retrying: ${message}`);
      await sleep(TOKEN_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error("LogiCoy token exchange retry loop exhausted unexpectedly.");
}

export async function getLogicoyAccessToken(
  platformConfig: LogicoyPlatformConfig,
  logContext = "logicoy-auth",
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const tokenEndpoint = normalizeTokenEndpoint(platformConfig);
  const clientId = platformConfig.logicoy_client_id?.trim() || null;
  const clientRegistrationPkUuid = platformConfig.logicoy_client_registration_pk_uuid?.trim() || null;
  const privateKeyPem = platformConfig.logicoy_private_key?.trim() || null;
  const storedAssertionJwt = platformConfig.logicoy_client_assertion_jwt?.trim() || null;
  const apiKey = platformConfig.logicoy_api_key?.trim() || null;

  if (privateKeyPem) {
    if (!clientId) {
      throw new Error("LogiCoy private key authentication requires a client ID.");
    }
    if (!clientRegistrationPkUuid) {
      throw new Error("LogiCoy private key authentication requires a client registration UUID.");
    }

    const privateKey = await importRsaPrivateKey(privateKeyPem);
    const assertion = await signClientAssertionJwt(
      clientId,
      tokenEndpoint,
      privateKey,
      clientRegistrationPkUuid,
    );

    return await exchangeTokenWithRetry(
      tokenEndpoint,
      () => new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_assertion_type: CLIENT_ASSERTION_TYPE,
        client_assertion: assertion,
      }),
      logContext,
      fetchImpl,
    );
  }

  if (storedAssertionJwt) {
    validateStoredClientAssertion(storedAssertionJwt, clientId, tokenEndpoint, clientRegistrationPkUuid);
    return await exchangeTokenWithRetry(
      tokenEndpoint,
      () => new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId!,
        client_assertion_type: CLIENT_ASSERTION_TYPE,
        client_assertion: storedAssertionJwt,
      }),
      logContext,
      fetchImpl,
    );
  }

  if (apiKey) {
    return apiKey;
  }

  throw new Error("No LogiCoy authentication credentials configured. Set a private key, client assertion JWT, or API key.");
}
