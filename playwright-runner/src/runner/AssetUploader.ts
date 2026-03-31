import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import type { UploadScreenshotParams } from '../types';

const BUCKET = process.env.STORAGE_BUCKET ?? 'doc-studio-assets';

export class AssetUploader {
  constructor(private supabase: SupabaseClient) {}

  async uploadScreenshot(params: UploadScreenshotParams): Promise<string | null> {
    const {
      jobId,
      stepId,
      stepOrder,
      caption,
      buffer,
      assetType = 'screenshot',
      isCover,
    } = params;

    const prefix = assetType === 'failure_screenshot' ? 'fail' : 'screenshot';
    const fileName = `${prefix}-step-${String(stepOrder).padStart(3, '0')}-${Date.now()}.png`;
    const filePath = `jobs/${jobId}/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error(`[AssetUploader] upload failed for step ${stepOrder}:`, uploadError.message);
      return null;
    }

    const { data: urlData } = this.supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const assetId = uuid();
    const { error: dbError } = await this.supabase.from('documentation_assets').insert({
      id: assetId,
      job_id: jobId,
      step_id: stepId,
      asset_type: assetType,
      file_name: fileName,
      storage_path: filePath,
      public_url: urlData.publicUrl,
      file_size_bytes: buffer.length,
      mime_type: 'image/png',
      sort_order: stepOrder,
      is_cover_candidate: isCover ?? (assetType === 'screenshot' && stepOrder === 1),
      asset_status: 'ready',
      metadata_json: { asset_subtype: assetType, caption },
    });

    if (dbError) {
      console.error(`[AssetUploader] DB insert failed for step ${stepOrder}:`, dbError.message);
      return null;
    }

    return assetId;
  }
}
