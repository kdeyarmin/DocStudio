import type { PdfBranding } from './types';

export interface SupportGuideDownloadOptions {
  title: string;
  content: string;
  category?: string;
  version?: string;
  filename?: string;
  subtitle?: string;
  branding?: PdfBranding;
}

export async function generateSupportGuidePdf({
  title,
  content,
  category,
  version,
  filename,
  subtitle,
  branding,
}: SupportGuideDownloadOptions): Promise<void> {
  const [{ generateAndDownloadPdf }, { buildSupportGuideSections }, { buildPdfBranding }] = await Promise.all([
    import('./generate'),
    import('./templates/supportGuide'),
    import('./usePdfBranding'),
  ]);

  await generateAndDownloadPdf(
    {
      title,
      subtitle: subtitle ?? category,
      branding: branding ?? buildPdfBranding(),
      sections: buildSupportGuideSections({ content, category, version }),
    },
    filename,
  );
}
