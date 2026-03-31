import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  PronunciationDictionaryEntry,
  PronunciationCategory,
  PronunciationReplacementMode,
} from '../types/documentation';

const FN = 'doc-studio-pronunciation';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

export function usePronunciationDictionary(opts?: {
  category?: PronunciationCategory;
  enabledOnly?: boolean;
}) {
  return useQuery({
    queryKey: ['doc-studio-pronunciation', opts],
    queryFn: () =>
      call<{ entries: PronunciationDictionaryEntry[] }>({
        action: 'list',
        category: opts?.category,
        enabled_only: opts?.enabledOnly,
      }).then((r) => r.entries),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePronunciationEntry(entryId: string | null) {
  return useQuery({
    queryKey: ['doc-studio-pronunciation-entry', entryId],
    queryFn: () =>
      call<{ entry: PronunciationDictionaryEntry }>({
        action: 'get',
        entry_id: entryId,
      }).then((r) => r.entry),
    enabled: !!entryId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePronunciationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      term: string;
      phonetic_spelling?: string | null;
      category?: PronunciationCategory;
      notes?: string | null;
      is_enabled?: boolean;
      replacement_mode?: PronunciationReplacementMode;
      substitute_text?: string | null;
      provider_compat?: string[];
    }) =>
      call<{ entry: PronunciationDictionaryEntry }>({ action: 'create', ...params }).then(
        (r) => r.entry
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation'] });
    },
  });
}

export function useUpdatePronunciationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      entry_id: string;
      term?: string;
      phonetic_spelling?: string | null;
      category?: PronunciationCategory;
      notes?: string | null;
      is_enabled?: boolean;
      replacement_mode?: PronunciationReplacementMode;
      substitute_text?: string | null;
      provider_compat?: string[];
    }) =>
      call<{ entry: PronunciationDictionaryEntry }>({ action: 'update', ...params }).then(
        (r) => r.entry
      ),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation'] });
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation-entry', entry.id] });
    },
  });
}

export function useDeletePronunciationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry_id: string) =>
      call<{ deleted: boolean }>({ action: 'delete', entry_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation'] });
    },
  });
}

export function useTogglePronunciationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { entry_id: string; is_enabled: boolean }) =>
      call<{ entry: PronunciationDictionaryEntry }>({ action: 'toggle', ...params }).then(
        (r) => r.entry
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation'] });
    },
  });
}

export function useApplyPronunciationToText() {
  return useMutation({
    mutationFn: (params: { text: string; provider?: string }) =>
      call<{
        original_text: string;
        processed_text: string;
        entries_applied: number;
      }>({ action: 'apply_to_text', ...params }),
  });
}

export function usePreviewPronunciation() {
  return useMutation({
    mutationFn: (params: { text: string; provider?: string }) =>
      call<{
        original_text: string;
        processed_text: string;
        applied_entries: Array<{
          term: string;
          mode: string;
          replacement: string;
          match_count: number;
          compatible: boolean;
        }>;
        applied_count: number;
        skipped_incompatible: number;
      }>({ action: 'preview_pronunciation', ...params }),
  });
}

export function useBulkImportPronunciationEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Array<{
      term: string;
      phonetic_spelling?: string | null;
      category?: PronunciationCategory;
      is_enabled?: boolean;
      replacement_mode?: PronunciationReplacementMode;
      substitute_text?: string | null;
    }>) =>
      call<{ entries: PronunciationDictionaryEntry[]; count: number }>({
        action: 'bulk_import',
        entries,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-pronunciation'] });
    },
  });
}
