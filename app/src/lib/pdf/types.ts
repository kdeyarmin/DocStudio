export interface PdfBranding {
  logoUrl?: string;
  practiceName: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  npi?: string;
  taxId?: string;
}

export interface PdfSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'keyValue' | 'divider' | 'spacer' | 'signature' | 'image';
  level?: 1 | 2 | 3;
  text?: string;
  items?: string[];
  ordered?: boolean;
  rows?: string[][];
  headers?: string[];
  pairs?: { label: string; value: string }[];
  signerName?: string;
  signerTitle?: string;
  signedAt?: string;
  highlight?: 'normal' | 'warning' | 'critical' | 'success';
  imageUrl?: string;
  imageCaption?: string;
  imageWidth?: number;
  imageHeight?: number;
  height?: number;
}

export interface PdfDocumentOptions {
  title: string;
  subtitle?: string;
  branding: PdfBranding;
  sections: PdfSection[];
  orientation?: 'portrait' | 'landscape';
  showPageNumbers?: boolean;
  generatedDate?: string;
  patientName?: string;
  patientDob?: string;
  providerName?: string;
  confidentialityNotice?: boolean;
  footerText?: string;
}
