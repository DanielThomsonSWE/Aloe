import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './supabase';

export type Medication = {
  id: string; name: string; dosage: string; schedule: string; description: string;
  pinned: boolean; created_at: string;
};
export type MedicationInput = Pick<Medication, 'name' | 'dosage' | 'schedule' | 'description'>;
export const demoMode = process.env.EXPO_PUBLIC_DATA_MODE !== 'supabase';
const API = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const STORAGE_KEY = 'aloe:demo:medications:v1';
const examples: Medication[] = [
  { id: 'demo-metformin', name: 'Metformin', dosage: '500 mg', schedule: '', description: 'Twice daily with meals', pinned: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'demo-synthroid', name: 'Synthroid', dosage: '100 mcg', schedule: '', description: 'Morning, empty stomach', pinned: false, created_at: '2026-01-01T00:00:01Z' },
  { id: 'demo-lisinopril', name: 'Lisinopril', dosage: '10 mg', schedule: '', description: 'Once daily, morning', pinned: false, created_at: '2026-01-01T00:00:02Z' },
];
export function visibleMedications(items: Medication[], query: string) {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(item => `${item.name} ${item.dosage} ${item.schedule} ${item.description}`.toLocaleLowerCase().includes(search))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
function normalizeMedication(item: Medication): Medication {
  const description = item.description ?? '';
  const schedule = item.schedule ?? '';
  if (schedule && !/\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(schedule)) {
    return {
      ...item,
      schedule: '',
      description: [description, schedule].filter((value, index, values) => value && values.indexOf(value) === index).join(' · '),
    };
  }
  return { ...item, description };
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API) throw new Error('Set EXPO_PUBLIC_API_URL to connect to the backend.');
  const token = await getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API}${path}`, { ...init, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(typeof payload.detail === 'string' ? payload.detail : 'Could not save your changes. Please try again.');
    }
    return response.status === 204 ? undefined as T : response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The connection timed out. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function readDemo(): Promise<Medication[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    const items = JSON.parse(stored) as (Omit<Medication, 'description'> & { description?: string })[];
    let migrated = false;
    const normalized: Medication[] = items.map(item => {
      const value = normalizeMedication({ ...item, description: item.description ?? '' });
      if (value.description !== item.description || value.schedule !== item.schedule) migrated = true;
      return value;
    });
    if (migrated) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(examples));
  return [...examples];
}
export const medications = {
  async list(): Promise<Medication[]> {
    const items = demoMode ? await readDemo() : await request<Medication[]>('/medications');
    return items.map(normalizeMedication);
  },
  async add(input: MedicationInput): Promise<Medication> {
    if (!demoMode) return request('/medications', { method: 'POST', body: JSON.stringify(input) });
    const items = await readDemo();
    const item: Medication = { ...input, id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`, pinned: false, created_at: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...items, item]));
    return item;
  },
  async update(id: string, input: MedicationInput): Promise<Medication> {
    if (!demoMode) return request(`/medications/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    const items = await readDemo();
    const item = items.find(item => item.id === id);
    if (!item) throw new Error('This medication is no longer saved. Refresh the list.');
    const updated = { ...item, ...input };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(item => item.id === id ? updated : item)));
    return updated;
  },
  async pin(id: string, pinned: boolean): Promise<Medication> {
    if (!demoMode) return request(`/medications/${id}`, { method: 'PATCH', body: JSON.stringify({ pinned }) });
    const items = await readDemo();
    const item = items.find(item => item.id === id);
    if (!item) throw new Error('This medication is no longer saved. Refresh the list.');
    const updated = { ...item, pinned };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(item => item.id === id ? updated : item)));
    return updated;
  },
  async remove(id: string): Promise<void> {
    if (!demoMode) return request(`/medications/${id}`, { method: 'DELETE' });
    const items = await readDemo();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter(item => item.id !== id)));
  },
};
