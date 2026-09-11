export const SUPPORT_HUB_PUBLICATION_SCHEMA: string;
export const REGISTERED_SUPPORT_HUB_PRODUCTS: readonly string[];
export function buildSupportHubPublicationManifest(input: unknown): Readonly<Record<string, unknown>>;
export function serializeSupportHubPublicationManifest(input: unknown): string;
