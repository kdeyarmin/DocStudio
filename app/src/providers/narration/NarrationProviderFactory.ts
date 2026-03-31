import type { NarrationProvider, VoiceConfigOptions } from './NarrationProvider';
import { FutureElevenLabsNarrationProvider } from './FutureElevenLabsNarrationProvider';

let _instance: FutureElevenLabsNarrationProvider | null = null;

export function getNarrationProvider(
  voiceConfig?: VoiceConfigOptions,
): FutureElevenLabsNarrationProvider {
  if (voiceConfig) {
    return new FutureElevenLabsNarrationProvider(voiceConfig);
  }
  if (!_instance) _instance = new FutureElevenLabsNarrationProvider();
  return _instance;
}

export function createNarrationProvider(
  voiceConfig: VoiceConfigOptions,
): FutureElevenLabsNarrationProvider {
  return new FutureElevenLabsNarrationProvider(voiceConfig);
}

export function resetNarrationProviderInstance(): void {
  _instance = null;
}

export type { NarrationProvider };
