import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarScreen } from '../CalendarScreen';
import { Icon, IconName } from '../icons';
import { Medication, medications } from '../medications';
import { styles as s } from '../styles';

export default function CalendarRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const desktop = web && width >= 600;
  const [items, setItems] = useState<Medication[]>([]);

  useEffect(() => {
    let active = true;
    void medications.list().then(value => {
      if (active) setItems(value);
    }).catch(() => {
      if (active) setItems([]);
    });
    return () => { active = false; };
  }, []);

  const tabs: { title: string; icon: IconName }[] = [
    { title: 'Home', icon: 'home' },
    { title: 'Food interactions', icon: 'search' },
    { title: 'Calendar', icon: 'calendar' },
  ];

  return (
    <View style={[s.stage, desktop && s.desktopStage]}>
      <StatusBar style="dark" />
      <View testID="phone" style={[
        s.phone,
        desktop && { width: 400, height: Math.min(height - 48, 876), flex: 0, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
        web && !desktop && { borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
      ]}>
        {web ? (
          <View style={s.status} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={s.statusTime}>9:41</Text>
            <View style={s.deviceStatus}><Icon name="signal" /><Icon name="wifi" /><Icon name="battery" /></View>
          </View>
        ) : <View style={{ height: insets.top }} />}
        <CalendarScreen medications={items} onBack={() => router.replace('/')} />
        <View style={s.navigation}>
          <View style={s.navigationDivider} />
          <View style={s.tabs}>
            {tabs.map(tab => {
              const selected = tab.title === 'Calendar';
              const foodTab = tab.title === 'Food interactions';
              return (
                <Pressable
                  key={tab.title}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.title}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (tab.title === 'Home') router.replace('/');
                    else if (foodTab) router.replace('/food-interactions');
                  }}
                  style={({ pressed }) => [s.tab, selected && s.activeTab, pressed && s.pressed]}
                >
                  <Icon name={tab.icon} />
                  <Text style={[s.tabText, selected && s.activeTabText]}>{tab.title}</Text>
                </Pressable>
              );
            })}
          </View>
          {web ? <View style={s.homeIndicatorArea}><View style={s.homeIndicator} /></View> : <View style={{ height: Math.max(insets.bottom, 8) }} />}
        </View>
      </View>
    </View>
  );
}
