import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const connectedMode = process.env.EXPO_PUBLIC_DATA_MODE === 'supabase';
// Expo Router statically renders web routes in Node during `expo export`.
const browserStorageAvailable = Platform.OS !== 'web' || typeof window !== 'undefined';
const configured = !!url && !!key && browserStorageAvailable;

// Analytics stays unauthenticated so writes use the database's `anon` role.
export const supabase = configured ? createClient(url!, key!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;

// Keep the existing medication API's anonymous-auth session separate from analytics.
// This preserves its current behavior without attaching an authenticated JWT to analytics writes.
const apiSupabase = configured && connectedMode ? createClient(url!, key!, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;

export function watchAuthState() {
  if (!apiSupabase || Platform.OS === 'web') return () => {};
  if (AppState.currentState === 'active') apiSupabase.auth.startAutoRefresh();
  const listener = AppState.addEventListener('change', state => {
    if (state === 'active') apiSupabase?.auth.startAutoRefresh();
    else apiSupabase?.auth.stopAutoRefresh();
  });
  return () => { listener.remove(); apiSupabase?.auth.stopAutoRefresh(); };
}

// Private anonymous identity for the existing API; no login page is required.
let signingIn: Promise<string> | null = null;
export async function getAccessToken(): Promise<string> {
  if (!apiSupabase) throw new Error('Add your Supabase project URL and public key.');
  const { data, error } = await apiSupabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.access_token;
  if (!signingIn) {
    signingIn = apiSupabase.auth.signInAnonymously().then(({ data, error }) => {
      if (error || !data.session) throw new Error(error?.message ?? 'Enable anonymous sign-ins in Supabase.');
      return data.session.access_token;
    }).finally(() => { signingIn = null; });
  }
  return signingIn;
}
