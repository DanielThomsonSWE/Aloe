import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOVED_EXAMPLES_KEY = 'aloe:demo:removed-food-examples:v1';

export const exampleInteractions = {
  async removedIds(): Promise<string[]> {
    const stored = await AsyncStorage.getItem(REMOVED_EXAMPLES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  },

  async remove(id: string): Promise<void> {
    const removedIds = await this.removedIds();
    if (!removedIds.includes(id)) {
      await AsyncStorage.setItem(REMOVED_EXAMPLES_KEY, JSON.stringify([...removedIds, id]));
    }
  },
};
