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
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { RecordNudge } from '@/components/record-nudge';
import { Colors, FontFamily } from '@/constants/theme';
import { BabyProvider, useBaby } from '@/data/baby-context';
import { ChatProvider } from '@/data/chat-context';
import { DraftProvider } from '@/data/draft-context';
import { EntitlementsProvider } from '@/data/entitlements-context';
import { InboxProvider } from '@/data/inbox-context';
import { PreferencesProvider, usePreferences } from '@/data/preferences-context';
import { RecordsProvider } from '@/data/records-context';

SplashScreen.preventAutoHideAsync();

// 서버 호출(TanStack Query) — 묻기는 자동 재시도하지 않는다(use-malkong 주석)
const queryClient = new QueryClient();

/**
 * 만화를 아직 닫지 않았으면 만화부터 — 생일이 있든 없든, 건너뛰거나 끝까지 볼 때까지 (SPEC-MY-07).
 * 그다음 저장된 생일이 없으면 온보딩으로 보낸다 (SPEC-MY-01).
 */
function OnboardingGate() {
  const { baby, loading } = useBaby();
  const { introSeen, loading: prefsLoading } = usePreferences();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || prefsLoading) return;
    if (!introSeen) {
      if (segments[0] !== 'intro') router.replace('/intro');
    } else if (!baby && segments[0] !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [baby, loading, prefsLoading, introSeen, segments, router]);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                  <InboxProvider>
                  <DraftProvider>
                  <OnboardingGate />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="intro" options={{ animation: 'fade' }} />
                    <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                    <Stack.Screen name="inbox" options={{ ...header, title: '알림함' }} />
                    <Stack.Screen name="records" options={{ ...header, title: '우리 아기 기록' }} />
                    <Stack.Screen name="legal/[doc]" options={header} />
                  </Stack>
                  {/* 하루 기록이 며칠 비면 묻는 카드와 알림 (SPEC-BABY-07) */}
                  <RecordNudge />
                  </DraftProvider>
                  </InboxProvider>
                </ChatProvider>
              </RecordsProvider>
            </BabyProvider>
          </PreferencesProvider>
        </EntitlementsProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
