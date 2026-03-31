import { createElement, type ReactElement } from 'react';
import type { PdfDocumentOptions } from './types';

async function loadPdfRenderer() {
  const [{ pdf }, { PdfDocumentComponent }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./PdfDocument'),
  ]);

  return { pdf, PdfDocumentComponent };
}

export async function generatePdfBlob(options: PdfDocumentOptions): Promise<Blob> {
  const { pdf, PdfDocumentComponent } = await loadPdfRenderer();
  const element = createElement(PdfDocumentComponent, { options }) as ReactElement;
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateAndDownloadPdf(
  options: PdfDocumentOptions,
  filename?: string
): Promise<void> {
  const blob = await generatePdfBlob(options);
  const url = URL.createObjectURL(blob);
  const safeFilename = filename || `${options.title.replace(/[^a-zA-Z0-9]/g, '_') || 'document'}.pdf`;
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
