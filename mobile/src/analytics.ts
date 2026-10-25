import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type StoredSession = { expoSessionId: string; sessionId: string };
type SessionIdentity = { expoSessionId: string; sessionId: string; userId: string };
type AnalyticsEvent = { event_name: string; occurred_at: string };

const SESSION_STORAGE_KEY = 'aloe:analytics:session:v1';
const USER_STORAGE_KEY = 'aloe:analytics:user:v1';
const WEB_SESSION_STORAGE_KEY = 'aloe:analytics:web-session:v1';
const FINAL_EVENT_NAME = 'found_medication_in_calendar';

let sessionIdentity: SessionIdentity | null = null;
let initialization: Promise<void> | null = null;
let sessionStartedAt: string | null = null;
let downloaded = false;
const sessionEvents: AnalyticsEvent[] = [];
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

function recordEvent(eventName: string, occurredAt: string) {
  try {
    if (sentEventNames.has(eventName)) return;
    sentEventNames.add(eventName);
    sessionEvents.push({ event_name: eventName, occurred_at: occurredAt });
  } catch {
    sentEventNames.delete(eventName);
  }
}

function downloadSession(endedAt: string) {
  try {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !sessionIdentity || !sessionStartedAt || downloaded) return;

    const fileContents = JSON.stringify({
      user_id: sessionIdentity.userId,
      session_id: sessionIdentity.sessionId,
      started_at: sessionStartedAt,
      ended_at: endedAt,
      events: [...sessionEvents].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)),
    }, null, 2);
    const file = new Blob([fileContents], { type: 'application/json' });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `aloe-session-${sessionIdentity.sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    downloaded = true;
  } catch {
    // A blocked or unsupported download must not interrupt the button action.
  }
}

export function initSession(userId?: string): Promise<void> {
  if (initialization) return initialization;
  sessionStartedAt = new Date().toISOString();
  const startedAt = sessionStartedAt;

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

    recordEvent('session_start', startedAt);
  })().catch(() => {
    sessionIdentity ??= {
      expoSessionId: getExpoSessionId(),
      sessionId: createIdentifier('session'),
      userId: userId?.trim() || createIdentifier('user'),
    };
    recordEvent('session_start', startedAt);
  });

  return initialization;
}

export function trackFirst(eventName: string): void {
  const ready = initSession();
  const occurredAt = new Date().toISOString();
  try {
    if (sentEventNames.has(eventName)) return;
    recordEvent(eventName, occurredAt);
    if (eventName === FINAL_EVENT_NAME) {
      void ready.then(() => downloadSession(occurredAt)).catch(() => {
        // Keep analytics failures from affecting the existing button behavior.
      });
    }
  } catch {
    sentEventNames.delete(eventName);
  }
}
