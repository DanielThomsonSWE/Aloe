import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type StoredSession = { expoSessionId: string; sessionId: string };
type SessionIdentity = { expoSessionId: string; sessionId: string; userId: string };
type AnalyticsEvent = { event_name: string; occurred_at: string };
type StoredEventLog = {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  downloaded: boolean;
  events: AnalyticsEvent[];
};

const SESSION_STORAGE_KEY = 'aloe:analytics:session:v1';
const USER_STORAGE_KEY = 'aloe:analytics:user:v1';
const WEB_SESSION_STORAGE_KEY = 'aloe:analytics:web-session:v1';
const EVENT_LOG_STORAGE_KEY = 'aloe:analytics:event-log:v1';
const FINAL_EVENT_NAME = 'found_medication_in_calendar';

let sessionIdentity: SessionIdentity | null = null;
let initialization: Promise<void> | null = null;
let sessionStartedAt: string | null = null;
let sessionEndedAt: string | null = null;
let downloaded = false;
let eventLogInitialized = false;
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

function readStoredEventLog(sessionId: string): StoredEventLog | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(EVENT_LOG_STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as Partial<StoredEventLog>;
    if (stored.session_id !== sessionId || typeof stored.started_at !== 'string' || !Array.isArray(stored.events)) return null;
    const events = stored.events.filter((event): event is AnalyticsEvent =>
      typeof event === 'object' && event !== null
      && typeof event.event_name === 'string'
      && typeof event.occurred_at === 'string');
    return {
      session_id: sessionId,
      started_at: stored.started_at,
      ended_at: typeof stored.ended_at === 'string' ? stored.ended_at : null,
      downloaded: stored.downloaded === true,
      events,
    };
  } catch {
    return null;
  }
}

function persistEventLog() {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !sessionIdentity || !sessionStartedAt) return;
    window.sessionStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify({
      session_id: sessionIdentity.sessionId,
      started_at: sessionStartedAt,
      ended_at: sessionEndedAt,
      downloaded,
      events: sessionEvents,
    } satisfies StoredEventLog));
  } catch {
    // Keep analytics from affecting app behavior when browser storage is unavailable.
  }
}

function restoreEventLog(stored: StoredEventLog | null, startedAt: string) {
  const eventsRecordedBeforeInitialization = [...sessionEvents];
  sessionEvents.length = 0;
  sentEventNames.clear();

  if (stored) {
    sessionStartedAt = stored.started_at;
    sessionEndedAt = stored.ended_at;
    downloaded = stored.downloaded;
    for (const event of stored.events) {
      if (sentEventNames.has(event.event_name)) continue;
      sentEventNames.add(event.event_name);
      sessionEvents.push(event);
    }
  } else {
    sessionStartedAt = startedAt;
    sessionEndedAt = null;
    downloaded = false;
  }

  for (const event of eventsRecordedBeforeInitialization) {
    if (sentEventNames.has(event.event_name)) continue;
    sentEventNames.add(event.event_name);
    sessionEvents.push(event);
  }
  eventLogInitialized = true;
}

function recordEvent(eventName: string, occurredAt: string) {
  try {
    if (sentEventNames.has(eventName)) return;
    sentEventNames.add(eventName);
    sessionEvents.push({ event_name: eventName, occurred_at: occurredAt });
    persistEventLog();
  } catch {
    sentEventNames.delete(eventName);
  }
}

function downloadSession(endedAt: string) {
  try {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !sessionIdentity || !sessionStartedAt || downloaded) return;
    sessionEndedAt = endedAt;
    persistEventLog();

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
    persistEventLog();
  } catch {
    // A blocked or unsupported download must not interrupt the button action.
  }
}

export function initSession(userId?: string): Promise<void> {
  if (initialization) return initialization;
  const startedAt = new Date().toISOString();
  sessionStartedAt = startedAt;

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
      restoreEventLog(readStoredEventLog(sessionId), startedAt);
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
      if (!eventLogInitialized) restoreEventLog(null, startedAt);
    }

    recordEvent('session_start', sessionStartedAt ?? startedAt);
  })().catch(() => {
    sessionIdentity ??= {
      expoSessionId: getExpoSessionId(),
      sessionId: createIdentifier('session'),
      userId: userId?.trim() || createIdentifier('user'),
    };
    if (!eventLogInitialized) restoreEventLog(null, startedAt);
    recordEvent('session_start', sessionStartedAt ?? startedAt);
  });

  return initialization;
}

export function trackFirst(eventName: string): void {
  const ready = initSession();
  const occurredAt = new Date().toISOString();
  try {
    if (sentEventNames.has(eventName)) {
      if (eventName === FINAL_EVENT_NAME && !downloaded) {
        void ready.then(() => downloadSession(sessionEndedAt ?? occurredAt)).catch(() => {});
      }
      return;
    }
    recordEvent(eventName, occurredAt);
    if (eventName === FINAL_EVENT_NAME) {
      sessionEndedAt = occurredAt;
      persistEventLog();
      void ready.then(() => downloadSession(occurredAt)).catch(() => {
        // Keep analytics failures from affecting the existing button behavior.
      });
    }
  } catch {
    sentEventNames.delete(eventName);
  }
}
