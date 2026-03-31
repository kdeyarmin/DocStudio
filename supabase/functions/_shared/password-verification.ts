import { createClient } from 'npm:@supabase/supabase-js@2';

export async function verifyPasswordWithSupabase(email: string, password: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase anonymous auth client is not configured');
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return false;
  }

  await anonClient.auth.signOut();
  return true;
}
