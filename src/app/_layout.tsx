import { IBMPlexSansKR_400Regular } from '@expo-google-fonts/ibm-plex-sans-kr/400Regular';
import { IBMPlexSansKR_500Medium } from '@expo-google-fonts/ibm-plex-sans-kr/500Medium';
import { IBMPlexSansKR_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-kr/600SemiBold';
import { IBMPlexSansKR_700Bold } from '@expo-google-fonts/ibm-plex-sans-kr/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, FontFamily } from '@/constants/theme';
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
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  // 글꼴을 읽는 동안은 시작 화면이 그대로 남는다 — 시스템 글꼴로 한 번 그렸다가 바뀌는 깜박임을 막는다.
  // 읽지 못해도(오류) 시스템 글꼴로 연다
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.regular]: IBMPlexSansKR_400Regular,
    [FontFamily.medium]: IBMPlexSansKR_500Medium,
    [FontFamily.semibold]: IBMPlexSansKR_600SemiBold,
    [FontFamily.bold]: IBMPlexSansKR_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.background, card: c.background, text: c.text, border: c.divider, primary: c.accent },
  };
  const header = {
    headerShown: true,
    headerShadowVisible: false,
    headerTintColor: c.text,
    headerTitleStyle: { fontFamily: FontFamily.semibold, fontSize: 17 },
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <ThemeProvider value={theme}>
      {/* 흰 바탕에는 검은 글씨, 다크 모드에는 흰 글씨 */}
      <StatusBar style="auto" />
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
                    <Stack.Screen name="briefings" options={{ ...header, title: '지난 브리핑' }} />
                    <Stack.Screen name="legal/[doc]" options={header} />
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
