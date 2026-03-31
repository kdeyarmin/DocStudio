import { getWindowOrigin } from './browser';

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.replace(/\/+$/, '');
}

export function getSiteUrl(): string {
  return normalizeUrl(import.meta.env.VITE_SITE_URL?.trim() || getWindowOrigin());
}

export function getAppUrl(): string {
  return normalizeUrl(import.meta.env.VITE_APP_URL?.trim() || getWindowOrigin());
}
