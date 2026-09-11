export const EXPORT_LIMITS: Readonly<{ article: number; video: number; sidecar: number }>;
export interface ReviewedDraft {
  id?: string; updated_at?: string;
  status: string; reviewed_at: string | null; reviewed_by: string | null; revalidation_required: boolean;
  output_type: string; edited_content?: { guide_md?: string }; generated_content?: { guide_md?: string };
}
export interface ExportMetadata {
  source: { content_key: string; version: string };
  content: { title: string; summary: string; locale: string; access_level: 'public' | 'customer' | 'staff' };
  placements: Array<{ product_slug: string; audience: string[]; route_pattern: string | null }>;
}
export interface PublicationExport {
  manifest: { source: { content_key: string; version: string }; artifact: { sha256: string; byte_length: number }; placements: ExportMetadata['placements'] };
  files: Array<{ part: string; name: string; blob: Blob }>;
}
export function assertReviewedDraft(draft: ReviewedDraft): void;
export function publicationReviewSnapshot(draft: ReviewedDraft): string;
export function prepareSupportHubExport(input: {
  draft: ReviewedDraft; metadata: ExportMetadata; primary?: Blob; captions?: Blob; transcript?: Blob;
  durationMs?: number; phiReviewed: boolean;
}): Promise<PublicationExport>;
