import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type StoredSession = { expoSessionId: string; sessionId: string };
type SessionIdentity = { expoSessionId: string; sessionId: string; userId: string };

const SESSION_STORAGE_KEY = 'aloe:analytics:session:v1';
const USER_STORAGE_KEY = 'aloe:analytics:user:v1';
const WEB_SESSION_STORAGE_KEY = 'aloe:analytics:web-session:v1';

let sessionIdentity: SessionIdentity | null = null;
let initialization: Promise<void> | null = null;
const sentEventNames = new Set<string>();

function createIdentifier(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getExpoSessionId() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Constants.sessionId;
  try {
    const stored = window.sessionStorage.getItem(WEB_SESSION_STORAGE_KEY);
    if (stored) return stored;
    window.sessionStorage.setItem(WEB_SESSION_STORAGE_KEY, Constants.sessionId);
  } catch {
    // Fall back to Expo's page session if browser storage is unavailable.
  }
  return Constants.sessionId;
}

function parseStoredSession(value: string | null): StoredSession | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as Partial<StoredSession>;
    return typeof stored.expoSessionId === 'string' && typeof stored.sessionId === 'string'
      ? { expoSessionId: stored.expoSessionId, sessionId: stored.sessionId }
      : null;
  } catch {
    return null;
  }
}

async function writeEvent(eventName: string, occurredAt: string) {
  try {
    if (!supabase || !sessionIdentity) return;
    const { error } = await supabase.from('events').upsert({
      user_id: sessionIdentity.userId,
      session_id: sessionIdentity.sessionId,
      event_name: eventName,
      occurred_at: occurredAt,
    }, { onConflict: 'session_id,event_name', ignoreDuplicates: true });
    if (error) throw error;
  } catch {
    sentEventNames.delete(eventName);
  }
}

export function initSession(userId?: string): Promise<void> {
  if (initialization) return initialization;
  const startedAt = new Date().toISOString();

  initialization = (async () => {
    const expoSessionId = getExpoSessionId();
    try {
      const storedValues = await AsyncStorage.multiGet([SESSION_STORAGE_KEY, USER_STORAGE_KEY]);
      const storedSession = parseStoredSession(storedValues[0]?.[1] ?? null);
      const storedUserId = storedValues[1]?.[1] ?? null;
      const sessionId = storedSession?.expoSessionId === expoSessionId
        ? storedSession.sessionId
        : createIdentifier('session');
      const persistentUserId = userId?.trim() || storedUserId || createIdentifier('user');

      sessionIdentity = { expoSessionId, sessionId, userId: persistentUserId };
      await AsyncStorage.multiSet([
        [SESSION_STORAGE_KEY, JSON.stringify({ expoSessionId, sessionId })],
        [USER_STORAGE_KEY, persistentUserId],
      ]);
    } catch {
      sessionIdentity ??= {
        expoSessionId,
        sessionId: createIdentifier('session'),
        userId: userId?.trim() || createIdentifier('user'),
      };
    }

    sentEventNames.add('session_start');
    void writeEvent('session_start', startedAt);
  })().catch(() => {
    sessionIdentity ??= {
      expoSessionId: getExpoSessionId(),
      sessionId: createIdentifier('session'),
      userId: userId?.trim() || createIdentifier('user'),
    };
    sentEventNames.add('session_start');
    void writeEvent('session_start', startedAt);
  });

  return initialization;
}

export function trackFirst(eventName: string): void {
  const occurredAt = new Date().toISOString();
  try {
    if (sentEventNames.has(eventName)) return;
    sentEventNames.add(eventName);
    void initSession().then(() => writeEvent(eventName, occurredAt)).catch(() => {
      sentEventNames.delete(eventName);
    });
  } catch {
    sentEventNames.delete(eventName);
  }
}
