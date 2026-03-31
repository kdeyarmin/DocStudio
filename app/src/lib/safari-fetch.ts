const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const BASE_RETRY_DELAY = 500;
const MAX_RETRIES = 2;

function isSafariLoadFailed(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message === 'Load failed' ||
      error.message === 'The network connection was lost.' ||
      error.message.includes('network connection was lost'))
  );
}

const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const resilientFetch: typeof fetch = async (input, init) => {
  if (!isSafari) {
    return fetch(input, init);
  }

  const method = (init?.method || 'GET').toUpperCase();
  const canRetry = SAFE_RETRY_METHODS.has(method);

  let lastError: unknown;
  const maxAttempts = canRetry ? MAX_RETRIES : 0;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;

      if (!isSafariLoadFailed(err)) {
        throw err;
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, BASE_RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
};
