import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BabyProvider, useBaby } from '@/data/baby-context';
import { ChatProvider } from '@/data/chat-context';
import { EntitlementsProvider } from '@/data/entitlements-context';
import { PreferencesProvider } from '@/data/preferences-context';
import { RecordsProvider } from '@/data/records-context';

SplashScreen.preventAutoHideAsync();

// 서버 호출(TanStack Query) — 묻기는 자동 재시도하지 않는다(use-malkong 주석)
const queryClient = new QueryClient();

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
      <QueryClientProvider client={queryClient}>
        <EntitlementsProvider>
          <PreferencesProvider>
          <BabyProvider>
            <RecordsProvider>
              <ChatProvider>
                <OnboardingGate />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                  <Stack.Screen
                    name="records"
                    options={{ headerShown: true, title: '우리 아기 기록', headerBackTitle: '마이' }}
                  />
                </Stack>
              </ChatProvider>
            </RecordsProvider>
          </BabyProvider>
          </PreferencesProvider>
        </EntitlementsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
