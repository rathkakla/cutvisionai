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
    primary: '#D9822B',
    background: '#121212',
    card: '#121212',
    border: '#303030',
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
              contentStyle: { backgroundColor: '#121212' },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="scan" />
            <Stack.Screen name="analyzing" />
            <Stack.Screen name="result" />
          </Stack>
        </ThemeProvider>
      </CutVisionProvider>
    </SafeAreaProvider>
  );
}
