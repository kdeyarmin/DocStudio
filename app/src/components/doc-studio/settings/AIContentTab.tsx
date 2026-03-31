import { useState, useEffect } from 'react';
import { Save, Loader as Loader2, Eye, EyeOff, Zap, Mic, CircleCheck as CheckCircle, ExternalLink } from 'lucide-react';
import { useNarrationConfig, useSaveNarrationConfig } from '../../../hooks/useDocStudioSettings';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../lib/toast';

export function AIContentTab() {
  const { showToast } = useToast();
  const { data: narrationCfg, isLoading } = useNarrationConfig();
  const saveNarration = useSaveNarrationConfig();

  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  useEffect(() => {
    if (narrationCfg?.narration_config?.elevenlabs_voice_id) {
      setVoiceId(narrationCfg.narration_config.elevenlabs_voice_id);
    }
  }, [narrationCfg]);

  const handleTestKey = async () => {
    setTestingKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      let organizationId: string | null = null;
      if (userData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userData.user.id)
          .maybeSingle();
        organizationId = (profile?.organization_id as string | null | undefined) ?? null;
      }
      if (!organizationId) {
        showToast('Organization context not found', 'error');
        return;
      }
      const res = await supabase.functions.invoke('doc-studio-narration', {
        body: { action: 'test_key', organization_id: organizationId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.data?.available) {
        showToast(`ElevenLabs connected — ${res.data.voice_count ?? 0} voices available`, 'success');
      } else {
        showToast(res.data?.error ?? 'ElevenLabs key not valid', 'error');
      }
    } catch {
      showToast('Connection test failed', 'error');
    } finally {
      setTestingKey(false);
    }
  };

  const handleSave = async () => {
    try {
      await saveNarration.mutateAsync({
        elevenlabs_voice_id: voiceId.trim() || undefined,
        elevenlabs_api_key: apiKey.trim() || undefined,
      });
      setApiKey('');
      showToast('Narration settings saved', 'success');
    } catch {
      showToast('Failed to save narration settings', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Zap size={16} className="text-blue-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">AI Content Generation</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Uses your configured OpenAI or Claude API key (set in Platform Settings) to generate guide content, transcripts, and narration scripts from Playwright job results.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
          <CheckCircle size={13} className="text-green-500 shrink-0" />
          AI provider is resolved automatically from your Platform API key settings. No additional configuration needed here.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg"><Mic size={16} className="text-emerald-600" /></div>
          <div>
            <h3 className="font-medium text-slate-700 text-sm">ElevenLabs Narration</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Optional. When configured, enables one-click voiceover audio generation from narration scripts.
            </p>
          </div>
          {narrationCfg?.elevenlabs_key_configured && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <CheckCircle size={11} /> Connected
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ElevenLabs API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={narrationCfg?.elevenlabs_key_configured ? '••••••••••••••••••••• (key saved)' : 'sk-...'}
                />
                <button type="button" onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleTestKey}
                disabled={testingKey || !narrationCfg?.elevenlabs_key_configured}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap">
                {testingKey ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                Test
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Leave blank to keep the existing saved key.</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Voice ID</label>
            <input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="21m00Tcm4TlvDq8ikWAM"
            />
            <p className="text-xs text-slate-400 mt-1">
              Default: <code className="font-mono">21m00Tcm4TlvDq8ikWAM</code> (Rachel). Find voice IDs in your{' '}
              <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">
                ElevenLabs dashboard <ExternalLink size={10} />
              </a>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saveNarration.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saveNarration.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Narration Settings
        </button>
      </div>
    </div>
  );
}
