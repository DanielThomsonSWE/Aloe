import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Platform, View } from 'react-native';
import { styles } from '../styles';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_700Bold,
  });

  if (!loaded && !error) {
    return <View style={styles.loading}><ActivityIndicator color="#202020" /></View>;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' }} />
    </SafeAreaProvider>
  );
}
