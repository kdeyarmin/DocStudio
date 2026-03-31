/**
 * AES-GCM authenticated encryption for sensitive config values stored in the database.
 *
 * Encrypted payload format (v2):
 *   "v2:<base64url(12-byte IV)>.<base64url(ciphertext + 16-byte GCM tag)>"
 *
 * Legacy format (v1 – base64 only, effectively plaintext):
 *   btoa("<8-byte saltHex>:<plaintext password>")
 *
 * Backward-compatible decryption detects the format by the presence / absence of the
 * "v2:" prefix.  New encryptions always produce v2.  Saves that receive a v2 key will
 * silently migrate legacy rows on next write.
 */

const VERSION_PREFIX = 'v2:';

function toBufferSource(data: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(data) as Uint8Array<ArrayBuffer>;
}

function b64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

/**
 * Derive a 256-bit AES-GCM key from a secret string by hashing it with SHA-256.
 * The secret should already be a high-entropy random value (e.g. 32+ random bytes
 * stored as a hex string in the environment).
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string with AES-GCM using the supplied server secret.
 * Returns a versioned, self-contained string that includes the random IV.
 *
 * @throws {Error} when `secret` is absent.
 */
export async function encryptValue(plaintext: string, secret: string): Promise<string> {
  if (!secret) {
    throw new Error(
      'CONFIG_ENCRYPTION_KEY is required for encryption. Set this environment variable.',
    );
  }
  const key = await deriveKey(secret);
  const iv = toBufferSource(crypto.getRandomValues(new Uint8Array(12)));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    toBufferSource(new TextEncoder().encode(plaintext)),
  );
  return VERSION_PREFIX + b64urlEncode(iv) + '.' + b64urlEncode(new Uint8Array(ciphertext));
}

/**
 * Decrypt a value that was previously encrypted with `encryptValue` (v2 format)
 * **or** with the legacy base64 scheme (v1 format).
 *
 * @param encrypted  The stored encrypted string (v1 or v2).
 * @param secret     The server-side AES-GCM secret (required for v2; ignored for v1).
 * @throws {Error}   When v2 format is detected but `secret` is absent, or the
 *                   ciphertext is tampered with.
 */
export async function decryptValue(encrypted: string, secret: string | null): Promise<string> {
  if (!encrypted) return '';

  // ── v2: AES-GCM ──────────────────────────────────────────────────────────
  if (encrypted.startsWith(VERSION_PREFIX)) {
    if (!secret) {
      throw new Error(
        'CONFIG_ENCRYPTION_KEY is required to decrypt v2-format credentials. ' +
          'Set this environment variable.',
      );
    }
    const payload = encrypted.slice(VERSION_PREFIX.length);
    const dotIdx = payload.indexOf('.');
    if (dotIdx === -1) throw new Error('Invalid v2 encrypted payload: missing separator.');
    const iv = b64urlDecode(payload.slice(0, dotIdx));
    const ciphertext = toBufferSource(b64urlDecode(payload.slice(dotIdx + 1)));
    const key = await deriveKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  }

  // ── v1: legacy base64 ────────────────────────────────────────────────────
  try {
    const decoded = atob(encrypted);
    const colonIdx = decoded.indexOf(':');
    return colonIdx !== -1 ? decoded.slice(colonIdx + 1) : decoded;
  } catch {
    // Cannot decode – fail closed rather than exposing the raw stored value.
    return '';
  }
}

/** Returns true when the stored value uses the legacy base64 (v1) format. */
export function isLegacyEncrypted(encrypted: string): boolean {
  return !!encrypted && !encrypted.startsWith(VERSION_PREFIX);
}
