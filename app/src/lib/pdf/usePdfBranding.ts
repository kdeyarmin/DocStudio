import { CAREMETRIC_LOGO } from '../../assets/logo';
import type { Organization } from '../supabase';
import type { PdfBranding } from './types';

export function buildPdfBranding(organization?: Organization | null): PdfBranding {
  if (!organization) {
    return {
      logoUrl: CAREMETRIC_LOGO,
      practiceName: 'CareMetric AI',
    };
  }

  return {
    logoUrl: organization.logo_url || CAREMETRIC_LOGO,
    practiceName: organization.name,
    address: organization.address || undefined,
    city: organization.city || undefined,
    state: organization.state || undefined,
    zipCode: organization.zip_code || undefined,
    phone: organization.phone || undefined,
    email: organization.email || undefined,
    website: organization.website || undefined,
    npi: organization.npi_number || undefined,
    taxId: organization.tax_id || undefined,
  };
}

export function usePdfBranding(organization?: Organization | null): PdfBranding {
  return buildPdfBranding(organization);
}
