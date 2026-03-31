import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '../lib/supabase';
import type {
  PackageExportRecord,
} from '../types/documentation';

import { logger } from '../lib/logger';

const PACKAGE_FN = 'doc-studio-package';

export interface PackageListItem {
  id: string;
  draft_id: string;
  export_type: string;
  status: string;
  package_version: string;
  scene_count: number;
  total_duration_seconds: number;
  exported_at: string;
}

export function useLatestPackage(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-package', draftId],
    queryFn: async (): Promise<PackageExportRecord | null> => {
      const res = await callEdgeFunction<{
        success: boolean;
        package_export: PackageExportRecord | null;
        error?: string;
      }>(PACKAGE_FN, { action: 'get_package', draft_id: draftId, organization_id: '' });
      if (!res.success) throw new Error(res.error ?? 'Failed to load package');
      return res.package_export;
    },
    enabled: !!draftId,
    staleTime: 60 * 1000,
  });
}

export function usePackageHistory(draftId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-package-history', draftId],
    queryFn: async (): Promise<PackageListItem[]> => {
      const res = await callEdgeFunction<{
        success: boolean;
        packages: PackageListItem[];
        error?: string;
      }>(PACKAGE_FN, { action: 'list_packages', draft_id: draftId, organization_id: '' });
      if (!res.success) throw new Error(res.error ?? 'Failed to load packages');
      return res.packages ?? [];
    },
    enabled: !!draftId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAssemblePackage(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string }) => {
      const res = await callEdgeFunction<{
        success: boolean;
        package_export: PackageExportRecord;
        error?: string;
      }>(PACKAGE_FN, {
        action: 'assemble_package',
        draft_id: draftId,
        organization_id: params.organizationId,
      });
      if (!res.success) throw new Error(res.error ?? 'Package assembly failed');
      return res.package_export;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-package', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-package-history', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioPackage] useAssemblePackage failed:', error.message);
    },
  });
}

export function useRunFullAssembly(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string }) => {
      const res = await callEdgeFunction<{
        success: boolean;
        audio_assembly: unknown;
        caption_manifest: unknown;
        package_export: PackageExportRecord;
        error?: string;
      }>(PACKAGE_FN, {
        action: 'run_full_assembly',
        draft_id: draftId,
        organization_id: params.organizationId,
      });
      if (!res.success) throw new Error(res.error ?? 'Full assembly failed');
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly-health', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-package', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-package-history', draftId] });
      qc.invalidateQueries({ queryKey: ['doc-studio-draft', draftId] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioPackage] useRunFullAssembly failed:', error.message);
    },
  });
}
