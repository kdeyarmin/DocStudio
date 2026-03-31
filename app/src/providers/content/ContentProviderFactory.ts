import type { ContentProvider } from './ContentProvider';
import { FutureOpenAIContentProvider } from './FutureOpenAIContentProvider';

let _instance: ContentProvider | null = null;

export function getContentProvider(): ContentProvider {
  if (!_instance) _instance = new FutureOpenAIContentProvider();
  return _instance;
}

export function resetContentProviderInstance(): void {
  _instance = null;
}
