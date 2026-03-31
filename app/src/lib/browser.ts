export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getWindowOrigin(fallback = 'http://localhost'): string {
  if (!isBrowser()) return fallback;
  return window.location.origin;
}

export function isSafeExternalUrl(url: string): boolean {
  if (!url.trim()) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeWindowUrl(url: string): boolean {
  if (!url.trim()) return false;

  if (/^(blob:|data:|\/|#)/i.test(url)) {
    return true;
  }

  try {
    const parsed = new URL(url, getWindowOrigin());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getFallbackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${Date.now()}-${hex}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createStableId(prefix?: string): string {
  const rawId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : getFallbackId();

  return prefix ? `${prefix}-${rawId}` : rawId;
}

export function openPrintWindow(
  html: string,
  options?: {
    title?: string;
    features?: string;
    // Set this to true only when caller content is already escaped/sanitized.
    trustedHtml?: boolean;
  },
): Window | null {
  if (!isBrowser()) return null;

  const baseFeatures = options?.features ?? 'width=800,height=900';
  const featureSet = new Set(
    baseFeatures
      .split(',')
      .map((feature) => feature.trim())
      .filter(Boolean),
  );
  featureSet.add('noopener');
  featureSet.add('noreferrer');

  const printWindow = window.open('', '_blank', Array.from(featureSet).join(','));
  if (!printWindow) return null;

  if (html) {
    if (!options?.trustedHtml) {
      console.warn('openPrintWindow blocked untrusted html payload');
      printWindow.close();
      return null;
    }
    printWindow.document.open();
    if (options?.title) {
      printWindow.document.title = options.title;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  } else if (options?.title) {
    printWindow.document.title = options.title;
  }

  return printWindow;
}

export function printWindowContents(printWindow: Window, delayMs = 300): void {
  const triggerPrint = () => {
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, delayMs);
  };

  if (printWindow.document.readyState === 'complete') {
    triggerPrint();
    return;
  }

  printWindow.addEventListener('load', triggerPrint, { once: true });
}

export function printUrl(url: string, delayMs = 300): boolean {
  if (!isBrowser()) return false;
  if (!isSafeWindowUrl(url)) return false;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');

  let cleanedUp = false;
  let loadTimeoutId: number | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (loadTimeoutId !== null) {
      window.clearTimeout(loadTimeoutId);
    }
    iframe.onload = null;
    iframe.onerror = null;
    iframe.remove();
  };

  const openFallbackWindow = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  iframe.onload = () => {
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        openFallbackWindow();
      } finally {
        cleanup();
      }
    }, delayMs);
  };

  iframe.onerror = () => {
    cleanup();
    openFallbackWindow();
  };

  document.body.appendChild(iframe);
  loadTimeoutId = window.setTimeout(() => {
    cleanup();
    openFallbackWindow();
  }, 10_000);
  iframe.src = url;

  return true;
}
