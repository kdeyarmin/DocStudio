import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type {
  PlaywrightSettings,
  DocumentationDemoAccount,
  SceneGenerationConfig,
  NarrationAdvancedConfig,
  QualitySettingsConfig,
  DriftSettingsConfig,
  AssemblyConfig,
  CaptionExportConfig,
  PackageExportConfig,
  RenderSettings,
  ShotPlanningConfig,
  IntegrityRulesConfig,
} from '../types/documentation';
import type { ElevenLabsVoiceModelConfig } from '../providers/narration/NarrationProvider';
import {
  DEFAULT_PLAYWRIGHT_SETTINGS,
  SETTINGS_KEY,
  SCENE_GENERATION_CONFIG_KEY,
  DEFAULT_SCENE_GENERATION_CONFIG,
  NARRATION_ADVANCED_CONFIG_KEY,
  DEFAULT_NARRATION_ADVANCED_CONFIG,
  QUALITY_SETTINGS_CONFIG_KEY,
  DEFAULT_QUALITY_SETTINGS_CONFIG,
  DRIFT_SETTINGS_CONFIG_KEY,
  DEFAULT_DRIFT_SETTINGS_CONFIG,
  ASSEMBLY_CONFIG_KEY,
  DEFAULT_ASSEMBLY_CONFIG,
  CAPTION_EXPORT_CONFIG_KEY,
  DEFAULT_CAPTION_EXPORT_CONFIG,
  PACKAGE_EXPORT_CONFIG_KEY,
  DEFAULT_PACKAGE_EXPORT_CONFIG,
  RENDER_SETTINGS_CONFIG_KEY,
  DEFAULT_RENDER_SETTINGS,
  SHOT_PLANNING_CONFIG_KEY,
  DEFAULT_SHOT_PLANNING_CONFIG,
  INTEGRITY_RULES_CONFIG_KEY,
  DEFAULT_INTEGRITY_RULES_CONFIG,
} from '../types/documentation';

const FN = 'doc-studio-settings';

async function getOrganizationId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Not authenticated');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  const orgId = profile?.organization_id as string | null | undefined;
  if (!orgId) throw new Error('Organization not found');
  return orgId;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(FN, { body });
  if (error) throw new Error(error.message);
  return data as T;
}

async function callWithOrg<T>(body: Record<string, unknown>): Promise<T> {
  const organization_id = await getOrganizationId();
  return call<T>({ ...body, organization_id });
}

export function usePlaywrightSettings() {
  return useQuery({
    queryKey: ['doc-studio-playwright-settings'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: PlaywrightSettings | null }>({
        action: 'get_setting',
        key: SETTINGS_KEY,
      });
      return result.value_json ?? DEFAULT_PLAYWRIGHT_SETTINGS;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePlaywrightSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: PlaywrightSettings) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: SETTINGS_KEY,
        value_json: settings,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-playwright-settings'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSavePlaywrightSettings failed:', error.message);
    },
  });
}

export function useDemoAccounts() {
  return useQuery({
    queryKey: ['doc-studio-demo-accounts'],
    queryFn: () =>
      callWithOrg<{ accounts: DocumentationDemoAccount[] }>({ action: 'list_demo_accounts' }).then(
        (r) => r.accounts
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertDemoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id?: string;
      name: string;
      environment: 'demo' | 'staging';
      role?: string;
      username_hint?: string;
      description?: string;
      is_active?: boolean;
      base_url: string;
      login_path?: string;
      login_selectors?: {
        username: string;
        password: string;
        submit: string;
        successUrlPattern: string;
      };
      env_password_key?: string;
    }) =>
      callWithOrg<{ account: DocumentationDemoAccount }>({
        action: params.id ? 'update_demo_account' : 'create_demo_account',
        ...params,
      }).then((r) => r.account),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-demo-accounts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useUpsertDemoAccount failed:', error.message);
    },
  });
}

export function useDeleteDemoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      callWithOrg<{ success: boolean }>({ action: 'delete_demo_account', account_id: accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-demo-accounts'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useDeleteDemoAccount failed:', error.message);
    },
  });
}

export interface StoredNarrationConfig {
  elevenlabs_voice_id?: string;
  elevenlabs_model_id?: string;
  elevenlabs_stability?: number;
  elevenlabs_similarity_boost?: number;
  elevenlabs_style?: number;
  elevenlabs_use_speaker_boost?: boolean;
  elevenlabs_language_code?: string;
  elevenlabs_optimize_streaming_latency?: 0 | 1 | 2 | 3 | 4;
}

export function useNarrationConfig() {
  return useQuery({
    queryKey: ['doc-studio-narration-config'],
    queryFn: () =>
      callWithOrg<{
        narration_config: StoredNarrationConfig;
        elevenlabs_key_configured: boolean;
      }>({ action: 'get_narration_config' }),
    staleTime: 5 * 60 * 1000,
  });
}

export function narrationConfigToVoiceModel(
  cfg: StoredNarrationConfig,
  defaults: ElevenLabsVoiceModelConfig,
): ElevenLabsVoiceModelConfig {
  return {
    voice_id: cfg.elevenlabs_voice_id ?? defaults.voice_id,
    model_id: cfg.elevenlabs_model_id ?? defaults.model_id,
    stability: cfg.elevenlabs_stability ?? defaults.stability,
    similarity_boost: cfg.elevenlabs_similarity_boost ?? defaults.similarity_boost,
    style: cfg.elevenlabs_style ?? defaults.style,
    use_speaker_boost: cfg.elevenlabs_use_speaker_boost ?? defaults.use_speaker_boost,
    language_code: cfg.elevenlabs_language_code ?? defaults.language_code,
    optimize_streaming_latency:
      cfg.elevenlabs_optimize_streaming_latency ?? defaults.optimize_streaming_latency,
  };
}

export function useSaveNarrationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      params: StoredNarrationConfig & { elevenlabs_api_key?: string },
    ) => callWithOrg<{ success: boolean }>({ action: 'save_narration_config', ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-config'] });
      qc.invalidateQueries({ queryKey: ['doc-studio-elevenlabs-available'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveNarrationConfig failed:', error.message);
    },
  });
}

export function useSceneGenerationConfig() {
  return useQuery({
    queryKey: ['doc-studio-scene-generation-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: SceneGenerationConfig | null }>({
        action: 'get_setting',
        key: SCENE_GENERATION_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_SCENE_GENERATION_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveSceneGenerationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: SceneGenerationConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: SCENE_GENERATION_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-scene-generation-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveSceneGenerationConfig failed:', error.message);
    },
  });
}

export function useNarrationAdvancedConfig() {
  return useQuery({
    queryKey: ['doc-studio-narration-advanced-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: NarrationAdvancedConfig | null }>({
        action: 'get_setting',
        key: NARRATION_ADVANCED_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_NARRATION_ADVANCED_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveNarrationAdvancedConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: NarrationAdvancedConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: NARRATION_ADVANCED_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-narration-advanced-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveNarrationAdvancedConfig failed:', error.message);
    },
  });
}

export function useQualitySettingsConfig() {
  return useQuery({
    queryKey: ['doc-studio-quality-settings-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: QualitySettingsConfig | null }>({
        action: 'get_setting',
        key: QUALITY_SETTINGS_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_QUALITY_SETTINGS_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveQualitySettingsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: QualitySettingsConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: QUALITY_SETTINGS_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-quality-settings-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveQualitySettingsConfig failed:', error.message);
    },
  });
}

export function useDriftSettingsConfig() {
  return useQuery({
    queryKey: ['doc-studio-drift-settings-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: DriftSettingsConfig | null }>({
        action: 'get_setting',
        key: DRIFT_SETTINGS_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_DRIFT_SETTINGS_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveDriftSettingsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: DriftSettingsConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: DRIFT_SETTINGS_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-drift-settings-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveDriftSettingsConfig failed:', error.message);
    },
  });
}

export function useAssemblyConfig() {
  return useQuery({
    queryKey: ['doc-studio-assembly-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: AssemblyConfig | null }>({
        action: 'get_setting',
        key: ASSEMBLY_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_ASSEMBLY_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveAssemblyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: AssemblyConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: ASSEMBLY_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-assembly-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveAssemblyConfig failed:', error.message);
    },
  });
}

export function useCaptionExportConfig() {
  return useQuery({
    queryKey: ['doc-studio-caption-export-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: CaptionExportConfig | null }>({
        action: 'get_setting',
        key: CAPTION_EXPORT_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_CAPTION_EXPORT_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveCaptionExportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: CaptionExportConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: CAPTION_EXPORT_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-caption-export-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveCaptionExportConfig failed:', error.message);
    },
  });
}

export function usePackageExportConfig() {
  return useQuery({
    queryKey: ['doc-studio-package-export-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: PackageExportConfig | null }>({
        action: 'get_setting',
        key: PACKAGE_EXPORT_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_PACKAGE_EXPORT_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePackageExportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: PackageExportConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: PACKAGE_EXPORT_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-package-export-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSavePackageExportConfig failed:', error.message);
    },
  });
}

export function useRenderSettingsConfig() {
  return useQuery({
    queryKey: ['doc-studio-render-settings-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: RenderSettings | null }>({
        action: 'get_setting',
        key: RENDER_SETTINGS_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_RENDER_SETTINGS;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveRenderSettingsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: RenderSettings) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: RENDER_SETTINGS_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-render-settings-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveRenderSettingsConfig failed:', error.message);
    },
  });
}

export function useShotPlanningConfig() {
  return useQuery({
    queryKey: ['doc-studio-shot-planning-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: ShotPlanningConfig | null }>({
        action: 'get_setting',
        key: SHOT_PLANNING_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_SHOT_PLANNING_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveShotPlanningConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ShotPlanningConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: SHOT_PLANNING_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-shot-planning-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveShotPlanningConfig failed:', error.message);
    },
  });
}

export function useIntegrityRulesConfig() {
  return useQuery({
    queryKey: ['doc-studio-integrity-rules-config'],
    queryFn: async () => {
      const result = await callWithOrg<{ value_json: IntegrityRulesConfig | null }>({
        action: 'get_setting',
        key: INTEGRITY_RULES_CONFIG_KEY,
      });
      return result.value_json ?? DEFAULT_INTEGRITY_RULES_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveIntegrityRulesConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: IntegrityRulesConfig) =>
      callWithOrg<{ success: boolean }>({
        action: 'set_setting',
        key: INTEGRITY_RULES_CONFIG_KEY,
        value_json: config,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-studio-integrity-rules-config'] });
    },
    onError: (error: Error) => {
      logger.error('[useDocStudioSettings] useSaveIntegrityRulesConfig failed:', error.message);
    },
  });
}
