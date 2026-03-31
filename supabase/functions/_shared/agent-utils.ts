/**
 * Shared utilities for agent functions (email-handler, sms-handler, orchestrator).
 */

export const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must','can','could',
  'i','me','my','we','our','you','your','he','she','it','they','them','their',
  'this','that','these','those','what','which','who','whom','how','where','when','why',
  'in','on','at','to','for','of','with','by','from','as','into','about','between',
  'and','or','but','not','no','so','if','then','than','too','very','just',
  'up','out','all','any','each','every','both','few','more','some',
]);

export function extractKeywords(query: string): string[] {
  return query.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

export function sanitizeForIlike(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/[,().]/g, '');
}

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
