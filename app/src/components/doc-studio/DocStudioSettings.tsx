import { useState } from 'react';
import { Settings, Users, Mic, Layers, SlidersHorizontal, BookOpen, Star, Package, Film, Camera, ShieldCheck, GitPullRequestArrow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PlaywrightConfigTab } from './settings/PlaywrightConfigTab';
import { DemoAccountsTab } from './settings/DemoAccountsTab';
import { AIContentTab } from './settings/AIContentTab';
import { SceneGenerationTab } from './settings/SceneGenerationTab';
import { NarrationAdvancedTab } from './settings/NarrationAdvancedTab';
import { PronunciationTab } from './settings/PronunciationTab';
import { QualityDriftTab } from './settings/QualityDriftTab';
import { AudioAssemblyTab } from './settings/AudioAssemblyTab';
import { RenderSettingsTab } from './settings/RenderSettingsTab';
import { ShotPlanningTab } from './settings/ShotPlanningTab';
import { IntegrityRulesTab } from './settings/IntegrityRulesTab';
import { ReviewWorkflowTab } from './settings/ReviewWorkflowTab';

type Tab = 'playwright' | 'demo_accounts' | 'ai_content' | 'scenes' | 'narration' | 'pronunciation' | 'quality_drift' | 'assembly' | 'render' | 'shot_planning' | 'integrity_rules' | 'review_workflow';

const TABS: { value: Tab; label: string; Icon: LucideIcon }[] = [
  { value: 'playwright', label: 'Playwright', Icon: Settings },
  { value: 'demo_accounts', label: 'Demo Accounts', Icon: Users },
  { value: 'ai_content', label: 'AI & Narration', Icon: Mic },
  { value: 'scenes', label: 'Scene Generation', Icon: Layers },
  { value: 'narration', label: 'Narration', Icon: SlidersHorizontal },
  { value: 'pronunciation', label: 'Pronunciation', Icon: BookOpen },
  { value: 'quality_drift', label: 'Quality & Drift', Icon: Star },
  { value: 'assembly', label: 'Assembly & Packaging', Icon: Package },
  { value: 'render', label: 'Render', Icon: Film },
  { value: 'shot_planning', label: 'Shot Planning', Icon: Camera },
  { value: 'integrity_rules', label: 'Integrity Rules', Icon: ShieldCheck },
  { value: 'review_workflow', label: 'Review Workflow', Icon: GitPullRequestArrow },
];

export function DocStudioSettings() {
  const [tab, setTab] = useState<Tab>('playwright');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Documentation Studio Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Configure automation providers, narration, quality scoring, and more.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'playwright' && <PlaywrightConfigTab />}
        {tab === 'demo_accounts' && <DemoAccountsTab />}
        {tab === 'ai_content' && <AIContentTab />}
        {tab === 'scenes' && <SceneGenerationTab />}
        {tab === 'narration' && <NarrationAdvancedTab />}
        {tab === 'pronunciation' && <PronunciationTab />}
        {tab === 'quality_drift' && <QualityDriftTab />}
        {tab === 'assembly' && <AudioAssemblyTab />}
        {tab === 'render' && <RenderSettingsTab />}
        {tab === 'shot_planning' && <ShotPlanningTab />}
        {tab === 'integrity_rules' && <IntegrityRulesTab />}
        {tab === 'review_workflow' && <ReviewWorkflowTab />}
      </div>
    </div>
  );
}
