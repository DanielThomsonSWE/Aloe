import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOVED_EXAMPLES_KEY = 'aloe:demo:removed-food-examples:v1';

export type ReferenceInteraction = {
  id: string;
  food: string;
  drug: string;
  dose: string;
  effect: string;
  detail: string;
  source: string;
};

export const referenceInteractions: ReferenceInteraction[] = [
  {
    id: 'alcohol-metformin', food: 'Alcohol', drug: 'Metformin', dose: '500 mg',
    effect: 'Excess alcohol may raise the risk of lactic acidosis.',
    detail: 'Metformin prescribing information warns that excessive alcohol intake is a risk factor for lactic acidosis.',
    source: 'DailyMed · Metformin prescribing information',
  },
  {
    id: 'potassium-lisinopril', food: 'Potassium salt substitutes', drug: 'Lisinopril', dose: '10 mg',
    effect: 'May raise blood potassium.',
    detail: 'Lisinopril prescribing information cautions that potassium-containing salt substitutes may increase serum potassium.',
    source: 'DailyMed · Lisinopril prescribing information',
  },
];

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
