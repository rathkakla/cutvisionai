import '../global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CutVisionProvider } from '@/context/cutvision-context';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Abaikan: splash bisa saja sudah disembunyikan otomatis.
});

const cutVisionTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#F59E0B',
    background: '#0B0D13',
    card: '#131622',
    border: '#23293D',
    text: '#FFFFFF',
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <CutVisionProvider>
        <ThemeProvider value={cutVisionTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0B0D13' },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="analyzing" />
            <Stack.Screen name="result" />
          </Stack>
        </ThemeProvider>
      </CutVisionProvider>
    </SafeAreaProvider>
  );
}
