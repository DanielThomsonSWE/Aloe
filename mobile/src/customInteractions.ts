import AsyncStorage from '@react-native-async-storage/async-storage';

export type WaitUnit = 'hours' | 'days';

export type CustomInteraction = {
  id: string;
  foodName: string;
  drugName: string;
  waitAmount: number;
  waitUnit: WaitUnit;
  note: string;
  created_at: string;
};

export type NewCustomInteraction = Omit<CustomInteraction, 'id' | 'created_at'>;

const STORAGE_KEY = 'aloe:demo:custom-interactions:v1';

export const customInteractions = {
  async list(): Promise<CustomInteraction[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as CustomInteraction[] : [];
  },

  async add(input: NewCustomInteraction): Promise<CustomInteraction> {
    const items = await this.list();
    const item: CustomInteraction = {
      ...input,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...items]));
    return item;
  },

  async remove(id: string): Promise<void> {
    const items = await this.list();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter(item => item.id !== id)));
  },
};
