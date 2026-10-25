import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;

export function watchAuthState() {
  if (!supabase || Platform.OS === 'web') return () => {};
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  const listener = AppState.addEventListener('change', state => {
    if (state === 'active') supabase?.auth.startAutoRefresh();
    else supabase?.auth.stopAutoRefresh();
  });
  return () => { listener.remove(); supabase?.auth.stopAutoRefresh(); };
}

// Private anonymous identity for this single-screen MVP; no login page required.
let signingIn: Promise<string> | null = null;
export async function getAccessToken(): Promise<string> {
  if (!supabase) throw new Error('Add your Supabase project URL and publishable key.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.access_token;
  if (!signingIn) {
    signingIn = supabase.auth.signInAnonymously().then(({ data, error }) => {
      if (error || !data.session) throw new Error(error?.message ?? 'Enable anonymous sign-ins in Supabase.');
      return data.session.access_token;
    }).finally(() => { signingIn = null; });
  }
  return signingIn;
}
