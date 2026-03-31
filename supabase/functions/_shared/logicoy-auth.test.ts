/**
 * Unit tests for LogiCoy authentication helpers.
 *
 * Run with:
 *   npm run test
 *   or: deno test --allow-net supabase/functions/_shared/logicoy-auth.test.ts
 */
import {
  assert,
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  getLogicoyAccessToken,
  normalizeTokenEndpoint,
  verifySupabaseJwt,
} from './logicoy-auth.ts';

const PKCS1_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQCvuDlMEiCXLgvhnfTwJtCIBGj3I5C3MDVcVXK4MibMoWjMwA6J
Oaw1/jNFHC52WC2LIaIQmw7X+13PjIeSKqT0OGgza+cIUWYw3ScspreM1TTQA04M
ImLIFrJoPEWHerAZf1MVgZiZ8A8JGfPegAse9OU/rScS8Wzg0cE16QrZswIDAQAB
AoGBAII++fFhylhkoBfmngRXsN/w7OCqsvylthevmm3fdpTc2zJQ9TVP007eEaCb
R/EeYPusvVSzqif7QMizcFWuWD8WWDxl+Yyd//xU4kvi/IrDH5NiPwO5KB+WbHvw
eSd08ZN50+PQIGCirhj7T9NTDledidGDf9k107QFmJYpZkdJAkEA40dOrVUXX1zC
LW7va4cyMJFv+IZaDtJv/86QSBN+JJtnhMdnU/Kor+SoSBBe0JemNYA3aWGyKNo/
dZs0A1lu7wJBAMXs7s8Y1tBhKlHQ2I//GMvjIk96O3bIWtZj6wa0AVNK9/To+2jr
MPQzO8pyzq7beKSSy+qd5Zltjoiz9gIbQX0CQGNJhW9nWtyIEzPx4Jni5+QbxQSW
/MS43cCspo82JMctNJ3m1pbvzQ16IKHKtQD/HtcEejCJQ2FhZpOkB6bm7PUCQFGT
6oopbsDMi6jVL62KMyo2H/oqI0A+LFKZNFG696DhEXo8XQNNjQvZ4hb7YvznML6E
UtAM7Ilkgo8NvaP4n/ECQQCaS+MBDvVkzprcz1tKctqqtWF/ApZZujX9qi60+vVf
ARvXXAuSh1fzBy6Wg1vFrU/pHzmoo3YjBDA+gPcJ4vmL
-----END RSA PRIVATE KEY-----`;

const PKCS8_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAK+4OUwSIJcuC+Gd
9PAm0IgEaPcjkLcwNVxVcrgyJsyhaMzADok5rDX+M0UcLnZYLYshohCbDtf7Xc+M
h5IqpPQ4aDNr5whRZjDdJyymt4zVNNADTgwiYsgWsmg8RYd6sBl/UxWBmJnwDwkZ
896ACx705T+tJxLxbODRwTXpCtmzAgMBAAECgYEAgj758WHKWGSgF+aeBFew3/Ds
4Kqy/KW2F6+abd92lNzbMlD1NU/TTt4RoJtH8R5g+6y9VLOqJ/tAyLNwVa5YPxZY
PGX5jJ3//FTiS+L8isMfk2I/A7koH5Zse/B5J3Txk3nT49AgYKKuGPtP01MOV52J
0YN/2TXTtAWYlilmR0kCQQDjR06tVRdfXMItbu9rhzIwkW/4hloO0m//zpBIE34k
m2eEx2dT8qiv5KhIEF7Ql6Y1gDdpYbIo2j91mzQDWW7vAkEAxezuzxjW0GEqUdDY
j/8Yy+MiT3o7dsha1mPrBrQBU0r39Oj7aOsw9DM7ynLOrtt4pJLL6p3lmW2OiLP2
AhtBfQJAY0mFb2da3IgTM/HgmeLn5BvFBJb8xLjdwKymjzYkxy00nebWlu/NDXog
ocq1AP8e1wR6MIlDYWFmk6QHpubs9QJAUZPqiiluwMyLqNUvrYozKjYf+iojQD4s
Upk0Ubr3oOERejxdA02NC9niFvti/OcwvoRS0AzsiWSCjw29o/if8QJBAJpL4wEO
9WTOmtzPW0py2qq1YX8Cllm6Nf2qLrT69V8BG9dcC5KHV/MHLpaDW8WtT+kfOaij
diMEMD6A9wni+Ys=
-----END PRIVATE KEY-----`;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

function makeUnsignedJwt(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'RS256', typ: 'JWT' },
): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encode(header)}.${encode(payload)}.signature`;
}

type MockRequestInit = RequestInit & {
  body?: BodyInit | null;
  method?: string;
};

/**
 * Run a test function with globalThis.fetch replaced by a mock handler.
 * Restores the original fetch after the test completes.
 */
async function withMockFetchSerialized(
  fn: () => Promise<void> | void,
  handler: (input: RequestInfo | URL, init?: RequestInit) => ReturnType<typeof fetch>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const withMockFetch = withMockFetchSerialized;

Deno.test('getLogicoyAccessToken signs a client assertion JWT with PKCS#8 private key', async () => {
  await withMockFetchSerialized(async () => {
    const accessToken = await getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: PKCS8_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: 'client-registration-uuid',
      logicoy_api_key: null,
    });

    assertEquals(accessToken, 'logicoy-access-token');
  }, async (input, init) => {
    assertEquals(String(input), 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token');
    const ri = init as MockRequestInit | undefined;
    assertEquals(ri?.method, 'POST');

    const body = new URLSearchParams(String(ri?.body ?? ''));
    assertEquals(body.get('grant_type'), 'client_credentials');
    assertEquals(body.get('client_id'), 'test-client-id');
    assertEquals(body.get('client_assertion_type'), 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');

    const assertion = body.get('client_assertion');
    assertEquals(Boolean(assertion), true);

    const [headerSegment, payloadSegment] = assertion!.split('.');
    const header = JSON.parse(decodeBase64Url(headerSegment));
    const payload = JSON.parse(decodeBase64Url(payloadSegment));

    assertEquals(header.alg, 'RS256');
    assertEquals(header.typ, 'JWT');
    assertEquals(header.kid, 'client-registration-uuid');
    assertEquals(payload.iss, 'test-client-id');
    assertEquals(payload.sub, 'test-client-id');
    assertEquals(typeof payload.jti, 'string');

    return new Response(JSON.stringify({ access_token: 'logicoy-access-token' }), { status: 200 });
  });
});

Deno.test('getLogicoyAccessToken accepts PEMs in PKCS#1 format', async () => {
  await withMockFetchSerialized(async () => {
    const accessToken = await getLogicoyAccessToken({
      logicoy_api_url: 'http://127.0.0.1:54321/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: PKCS1_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: 'client-registration-uuid',
      logicoy_api_key: null,
    });

    assertEquals(accessToken, 'pkcs1-ok');
  }, async () => {
    return new Response(JSON.stringify({ access_token: 'pkcs1-ok' }), { status: 200 });
  });
});


Deno.test('getLogicoyAccessToken requires a client registration UUID for private key JWT auth', async () => {
  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: PKCS8_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: null,
      logicoy_api_key: null,
    }),
    Error,
    'LogiCoy private key authentication requires a client registration UUID',
  );
});

Deno.test('stored client assertions require a configured client ID', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt({
    iss: 'missing-client-id',
    sub: 'missing-client-id',
    aud: 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token',
    exp: now + 300,
    jti: 'jwt-id',
  });

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: null,
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'Stored LogiCoy client assertion JWT requires a configured client ID',
  );
});


Deno.test('stored client assertions require a configured client registration UUID', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token',
      exp: now + 300,
      jti: 'stored-jwt-id',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: null,
      logicoy_api_key: null,
    }),
    Error,
    'Stored LogiCoy client assertion JWT requires a configured client registration UUID',
  );
});

Deno.test('stored client assertions accept aud arrays and normalized token URLs', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: [
        'https://example.com/unused',
        'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token/',
      ],
      iat: now,
      exp: now + 300,
      jti: 'stored-jwt-id',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await withMockFetchSerialized(async () => {
    const accessToken = await getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_token_url: 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token/',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    });

    assertEquals(accessToken, 'stored-jwt-ok');
  }, async (_input, init) => {
    const ri = init as MockRequestInit | undefined;
    const body = new URLSearchParams(String(ri?.body ?? ''));
    assertEquals(body.get('client_id'), 'test-client-id');
    assertEquals(body.get('client_assertion'), storedAssertion);
    return new Response(JSON.stringify({ access_token: 'stored-jwt-ok' }), { status: 200 });
  });
});

Deno.test('getLogicoyAccessToken retries transient 503 responses and eventually succeeds', async () => {
  let attempts = 0;

  await withMockFetchSerialized(async () => {
    const accessToken = await getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: PKCS8_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: 'client-registration-uuid',
      logicoy_api_key: null,
    });

    assertEquals(accessToken, 'eventual-token');
    assertEquals(attempts, 3);
  }, async () => {
    attempts += 1;
    if (attempts < 3) {
      return new Response('temporary upstream failure', { status: 503 });
    }
    return new Response(JSON.stringify({ access_token: 'eventual-token' }), { status: 200 });
  });
});

Deno.test('getLogicoyAccessToken does not retry non-transient 400 failures', async () => {
  let attempts = 0;

  await withMockFetchSerialized(async () => {
    await assertRejects(
      () => getLogicoyAccessToken({
        logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
        logicoy_client_id: 'test-client-id',
        logicoy_private_key: PKCS8_PRIVATE_KEY,
        logicoy_client_assertion_jwt: null,
        logicoy_client_registration_pk_uuid: 'client-registration-uuid',
        logicoy_api_key: null,
      }),
      Error,
      'Token exchange failed (400)',
    );
    assertEquals(attempts, 1);
  }, async () => {
    attempts += 1;
    return new Response('invalid_request', { status: 400 });
  });
});

Deno.test('withMockFetchSerialized restores global fetch after completion', async () => {
  const originalFetch = globalThis.fetch;
  await withMockFetchSerialized(async () => {
    assert(globalThis.fetch !== originalFetch);
  }, async () => new Response(JSON.stringify({ access_token: 'ok' }), { status: 200 }));
  assertEquals(globalThis.fetch, originalFetch);
});

Deno.test('stored client assertions require an aud claim that matches the token endpoint', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      exp: now + 300,
      jti: 'stored-jwt-id',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'Stored LogiCoy client assertion JWT is missing a valid aud claim',
  );
});

Deno.test('stored client assertions validate the configured client registration UUID as kid', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token',
      exp: now + 300,
      jti: 'stored-jwt-id',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'wrong-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'Stored LogiCoy client assertion JWT kid header does not match',
  );
});

Deno.test('getLogicoyAccessToken returns the api key when no private key or stored assertion is configured', async () => {
  const result = await getLogicoyAccessToken({
    logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
    logicoy_client_id: null,
    logicoy_private_key: null,
    logicoy_client_assertion_jwt: null,
    logicoy_client_registration_pk_uuid: null,
    logicoy_api_key: 'my-api-key',
  });

  assertEquals(result, 'my-api-key');
});

Deno.test('getLogicoyAccessToken throws when no credentials are configured', async () => {
  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: null,
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: null,
      logicoy_api_key: null,
    }),
    Error,
    'No LogiCoy authentication credentials configured',
  );
});

Deno.test('getLogicoyAccessToken throws immediately when private key is set but client_id is missing', async () => {
  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: null,
      logicoy_private_key: PKCS8_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: 'client-registration-uuid',
      logicoy_api_key: 'fallback-api-key',
    }),
    Error,
    'LogiCoy private key authentication requires a client ID',
  );
});

Deno.test('normalizeTokenEndpoint appends /erxapi/oauth2/token and strips trailing slash from api_url', () => {
  const endpoint = normalizeTokenEndpoint({
    logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi/',
    logicoy_token_url: null,
    logicoy_client_id: null,
    logicoy_private_key: null,
    logicoy_client_assertion_jwt: null,
    logicoy_client_registration_pk_uuid: null,
    logicoy_api_key: null,
  });
  assertEquals(endpoint, 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token');
});

Deno.test('normalizeTokenEndpoint uses explicit token_url when provided', () => {
  const endpoint = normalizeTokenEndpoint({
    logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
    logicoy_token_url: 'https://auth.logicoy.com/oauth2/token',
    logicoy_client_id: null,
    logicoy_private_key: null,
    logicoy_client_assertion_jwt: null,
    logicoy_client_registration_pk_uuid: null,
    logicoy_api_key: null,
  });
  assertEquals(endpoint, 'https://auth.logicoy.com/oauth2/token');
});

const TOKEN_URL = 'https://eprescribing-stg.logicoy.com/erxapi/oauth2/token';

Deno.test('stored client assertions reject expired jwt', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: TOKEN_URL,
      exp: now + 30,
      jti: 'jti-1',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'expired or will expire too soon',
  );
});

Deno.test('stored client assertions reject iss/sub that do not match client id', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'other-id',
      sub: 'other-id',
      aud: TOKEN_URL,
      exp: now + 300,
      jti: 'jti-2',
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'iss/sub claims do not match',
  );
});

Deno.test('stored client assertions reject missing jti', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: TOKEN_URL,
      exp: now + 300,
    },
    { alg: 'RS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'missing a valid jti claim',
  );
});

Deno.test('stored client assertions reject alg other than RS256', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: TOKEN_URL,
      exp: now + 300,
      jti: 'jti-3',
    },
    { alg: 'HS256', typ: 'JWT', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'alg header must be RS256',
  );
});

Deno.test('stored client assertions reject invalid typ header', async () => {
  const now = Math.floor(Date.now() / 1000);
  const storedAssertion = makeUnsignedJwt(
    {
      iss: 'test-client-id',
      sub: 'test-client-id',
      aud: TOKEN_URL,
      exp: now + 300,
      jti: 'jti-4',
    },
    { alg: 'RS256', typ: 'at+jwt', kid: 'expected-kid' },
  );

  await assertRejects(
    () => getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: null,
      logicoy_client_assertion_jwt: storedAssertion,
      logicoy_client_registration_pk_uuid: 'expected-kid',
      logicoy_api_key: null,
    }),
    Error,
    'typ header must be JWT',
  );
});

Deno.test('getLogicoyAccessToken does not retry on 401 from token endpoint', async () => {
  let calls = 0;
  await withMockFetch(async () => {
    await assertRejects(
      () => getLogicoyAccessToken({
        logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
        logicoy_client_id: 'test-client-id',
        logicoy_private_key: PKCS8_PRIVATE_KEY,
        logicoy_client_assertion_jwt: null,
        logicoy_client_registration_pk_uuid: 'client-registration-uuid',
        logicoy_api_key: null,
      }),
      Error,
      'Token exchange failed (401)',
    );
  }, async () => {
    calls += 1;
    return new Response('Unauthorized', { status: 401 });
  });
  assertEquals(calls, 1);
});

Deno.test('getLogicoyAccessToken retries transient errors then succeeds', async () => {
  let calls = 0;
  await withMockFetch(async () => {
    const accessToken = await getLogicoyAccessToken({
      logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
      logicoy_client_id: 'test-client-id',
      logicoy_private_key: PKCS8_PRIVATE_KEY,
      logicoy_client_assertion_jwt: null,
      logicoy_client_registration_pk_uuid: 'client-registration-uuid',
      logicoy_api_key: null,
    });
    assertEquals(accessToken, 'after-retry');
  }, async () => {
    calls += 1;
    if (calls === 1) return new Response('Too Many', { status: 429 });
    if (calls === 2) return new Response('Bad Gateway', { status: 502 });
    return new Response(JSON.stringify({ access_token: 'after-retry' }), { status: 200 });
  });
  assertEquals(calls, 3);
});

Deno.test('getLogicoyAccessToken rejects 200 response with missing access_token', async () => {
  await withMockFetch(async () => {
    await assertRejects(
      () => getLogicoyAccessToken({
        logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
        logicoy_client_id: 'test-client-id',
        logicoy_private_key: PKCS8_PRIVATE_KEY,
        logicoy_client_assertion_jwt: null,
        logicoy_client_registration_pk_uuid: 'client-registration-uuid',
        logicoy_api_key: null,
      }),
      Error,
      'missing access_token',
    );
  }, async () => new Response(JSON.stringify({}), { status: 200 }));
});

Deno.test('getLogicoyAccessToken rejects non-JSON 200 body', async () => {
  await withMockFetch(async () => {
    await assertRejects(
      () => getLogicoyAccessToken({
        logicoy_api_url: 'https://eprescribing-stg.logicoy.com/erxapi',
        logicoy_client_id: 'test-client-id',
        logicoy_private_key: PKCS8_PRIVATE_KEY,
        logicoy_client_assertion_jwt: null,
        logicoy_client_registration_pk_uuid: 'client-registration-uuid',
        logicoy_api_key: null,
      }),
      Error,
      'non-JSON response',
    );
  }, async () => new Response('not json', { status: 200 }));
});

type SupabaseLike = Parameters<typeof verifySupabaseJwt>[0];

Deno.test('verifySupabaseJwt returns user id when token is valid', async () => {
  const supabase = {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: { id: 'user-abc' } },
        error: null,
      }),
    },
  } as unknown as SupabaseLike;

  const result = await verifySupabaseJwt(supabase, '  bearer-token  ');
  assertEquals(result.userId, 'user-abc');
  assertEquals(result.error, null);
});

Deno.test('verifySupabaseJwt returns ERX_AUTH_INVALID for blank token', async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as unknown as SupabaseLike;
  const result = await verifySupabaseJwt(supabase, '   ');
  assertEquals(result.userId, null);
  assertEquals(result.error, 'ERX_AUTH_INVALID');
});

Deno.test('verifySupabaseJwt returns ERX_AUTH_INVALID when getUser reports error', async () => {
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: { message: 'invalid' },
      }),
    },
  } as unknown as SupabaseLike;

  const result = await verifySupabaseJwt(supabase, 'token');
  assertEquals(result.userId, null);
  assertEquals(result.error, 'ERX_AUTH_INVALID');
});

Deno.test('verifySupabaseJwt returns ERX_AUTH_INVALID when getUser throws', async () => {
  const supabase = {
    auth: {
      getUser: async () => {
        throw new Error('network');
      },
    },
  } as unknown as SupabaseLike;

  const result = await verifySupabaseJwt(supabase, 'token');
  assertEquals(result.userId, null);
  assertEquals(result.error, 'ERX_AUTH_INVALID');
});

