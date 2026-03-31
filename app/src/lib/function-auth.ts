import { supabase } from './supabase';

export async function getFunctionAuthHeaders(contentType = true): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new Error('Authenticated session required');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export function getPublicFunctionHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}
