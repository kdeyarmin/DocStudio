export function resolveCheckinUrl(
  baseUrl: string | null | undefined,
  token: string,
  envAppUrl?: string,
  envSiteUrl?: string,
): string {
  const fallbackBase = envAppUrl || envSiteUrl || "https://app.caremetric.ai";
  const origin = (baseUrl || fallbackBase).replace(/\/+$/, "");
  return `${origin}/ccm/checkin?token=${encodeURIComponent(token)}`;
}
