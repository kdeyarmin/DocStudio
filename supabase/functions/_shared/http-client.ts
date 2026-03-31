export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: init.signal ?? abortController.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
