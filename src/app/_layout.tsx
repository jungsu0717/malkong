import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BabyProvider, useBaby } from '@/data/baby-context';
import { EntitlementsProvider } from '@/data/entitlements-context';
import { RecordsProvider } from '@/data/records-context';

SplashScreen.preventAutoHideAsync();

/**
 * 저장된 생일이 없으면 온보딩으로 보낸다 (SPEC-MY-01).
 * 반대로 이미 저장돼 있는데 온보딩에 머물러 있으면 홈으로 되돌린다.
 */
function OnboardingGate() {
  const { baby, loading } = useBaby();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onOnboarding = segments[0] === 'onboarding';
    if (!baby && !onOnboarding) router.replace('/onboarding');
  }, [baby, loading, segments, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <EntitlementsProvider>
        <BabyProvider>
          <RecordsProvider>
            <OnboardingGate />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            </Stack>
          </RecordsProvider>
        </BabyProvider>
      </EntitlementsProvider>
    </ThemeProvider>
  );
}
