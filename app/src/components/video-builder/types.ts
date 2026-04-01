export interface SceneConfig {
  id: string;
  type: SceneType;
  label: string;
  durationSeconds: number;
  enabled: boolean;
  props: Record<string, unknown>;
}

export type SceneType =
  | 'brand-intro'
  | 'problem-statement'
  | 'dashboard-overview'
  | 'ai-generation'
  | 'ambient-listening'
  | 'feature-montage'
  | 'closing-cta';

export interface ThemeOverrides {
  brandColor: string;
  brandName: string;
  tagline: string;
  ctaText: string;
  ctaUrl: string;
}

export interface VideoComposition {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  scenes: SceneConfig[];
  theme: ThemeOverrides;
  created_by: string;
  updated_at: string;
  created_at: string;
}

export const SCENE_REGISTRY: Record<SceneType, { label: string; icon: string; defaultDuration: number; description: string }> = {
  'brand-intro': {
    label: 'Brand Intro',
    icon: 'Sparkles',
    defaultDuration: 8,
    description: 'Logo reveal with animated tagline',
  },
  'problem-statement': {
    label: 'Problem Statement',
    icon: 'AlertTriangle',
    defaultDuration: 8,
    description: 'Pain point with dramatic stats',
  },
  'dashboard-overview': {
    label: 'Dashboard Tour',
    icon: 'LayoutDashboard',
    defaultDuration: 12,
    description: 'Interactive patient list walkthrough',
  },
  'ai-generation': {
    label: 'AI Note Generation',
    icon: 'Wand2',
    defaultDuration: 30,
    description: 'SOAP note generated from minimal input',
  },
  'ambient-listening': {
    label: 'Ambient Listening',
    icon: 'Mic',
    defaultDuration: 34,
    description: 'Record visit, auto-generate note',
  },
  'feature-montage': {
    label: 'Feature Montage',
    icon: 'Grid3x3',
    defaultDuration: 16,
    description: 'Quick cuts: billing, telehealth, scheduling, analytics',
  },
  'closing-cta': {
    label: 'Closing CTA',
    icon: 'Megaphone',
    defaultDuration: 12,
    description: 'Stats counters and call to action',
  },
};

export function createDefaultScenes(): SceneConfig[] {
  return (Object.entries(SCENE_REGISTRY) as [SceneType, typeof SCENE_REGISTRY[SceneType]][]).map(
    ([type, meta], index) => ({
      id: `scene-${index}`,
      type,
      label: meta.label,
      durationSeconds: meta.defaultDuration,
      enabled: true,
      props: {},
    }),
  );
}

export const DEFAULT_THEME: ThemeOverrides = {
  brandColor: '#1a6ffa',
  brandName: 'CareMetric AI',
  tagline: 'AI-Powered Clinical Documentation',
  ctaText: 'Start Your Free Trial',
  ctaUrl: 'caremetric.ai',
};
