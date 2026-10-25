import { Image } from 'expo-image';

// Unmodified Figma assets at their original root dimensions.
const icons = {
  brand: [require('../assets/figma/brand.svg'), 32, 32],
  search: [require('../assets/figma/search.svg'), 20, 20],
  medication: [require('../assets/figma/medication.svg'), 20, 20],
  pin: [require('../assets/figma/pin.svg'), 20, 20],
  chevron: [require('../assets/figma/chevron.svg'), 16, 16],
  plus: [require('../assets/figma/plus.svg'), 20, 20],
  home: [require('../assets/figma/home.svg'), 20, 20],
  calendar: [require('../assets/figma/calendar.svg'), 20, 20],
  signal: [require('../assets/figma/signal.svg'), 20, 20],
  wifi: [require('../assets/figma/wifi.svg'), 20, 20],
  battery: [require('../assets/figma/battery.svg'), 28, 20],
  calendarBack: [require('../assets/figma/calendar-back.svg'), 40, 40],
  dropdown: [require('../assets/figma/dropdown.svg'), 9, 6],
  dosePoint: [require('../assets/figma/dose-point.svg'), 8, 8],
  doseRing: [require('../assets/figma/dose-ring.svg'), 18, 18],
} as const;
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  const [source, width, height] = icons[name];
  return <Image source={source} style={{ width, height }} contentFit="contain" accessible={false} />;
}
