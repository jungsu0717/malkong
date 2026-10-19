import { IBMPlexSansKR_400Regular } from '@expo-google-fonts/ibm-plex-sans-kr/400Regular';
import { IBMPlexSansKR_500Medium } from '@expo-google-fonts/ibm-plex-sans-kr/500Medium';
import { IBMPlexSansKR_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-kr/600SemiBold';
import { IBMPlexSansKR_700Bold } from '@expo-google-fonts/ibm-plex-sans-kr/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, FontFamily } from '@/constants/theme';
import { BabyProvider, useBaby } from '@/data/baby-context';
import { EntitlementsProvider } from '@/data/entitlements-context';
import { FamilyProvider } from '@/data/family-context';
import { loadStoredKnowledge, refreshKnowledge } from '@/data/knowledge-update';
import { onTodoAlertOpened } from '@/data/notifications';
import { PreferencesProvider } from '@/data/preferences-context';
import { RecordsProvider } from '@/data/records-context';
import { RoutinesProvider } from '@/data/routines-context';
import { TodosProvider } from '@/data/todos-context';

SplashScreen.preventAutoHideAsync();

// 서버 호출(TanStack Query) — 묻기는 자동 재시도하지 않는다(use-malkong 주석)
const queryClient = new QueryClient();

/**
 * 저장된 생일이 없으면 온보딩으로 보낸다 (SPEC-MY-01).
 */
function OnboardingGate() {
  const { baby, loading } = useBaby();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!baby && segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [baby, loading, segments, router]);

  // 아침 알림 · 할 일 알림을 누르고 들어오면 할 일 탭으로
  useEffect(() => onTodoAlertOpened(() => router.navigate('/todo')), [router]);

  return null;
}

/**
 * 기기에 받아 둔 지식 판을 첫 화면 전에 얹고, 서버의 새 판은 뒤에서 받아 둔다 (task common/019).
 * 저장소를 한 줄 읽는 일이라 글꼴보다 빨리 끝난다.
 */
function useKnowledge(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadStoredKnowledge().finally(() => {
      if (!cancelled) setReady(true);
      void refreshKnowledge();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const knowledgeReady = useKnowledge();
  // 글꼴을 읽는 동안은 시작 화면이 그대로 남는다 — 시스템 글꼴로 한 번 그렸다가 바뀌는 깜박임을 막는다.
  // 읽지 못해도(오류) 시스템 글꼴로 연다
  const [fontsLoaded, fontError] = useFonts({
    [FontFamily.regular]: IBMPlexSansKR_400Regular,
    [FontFamily.medium]: IBMPlexSansKR_500Medium,
    [FontFamily.semibold]: IBMPlexSansKR_600SemiBold,
    [FontFamily.bold]: IBMPlexSansKR_700Bold,
  });
  if ((!fontsLoaded && !fontError) || !knowledgeReady) return null;

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
                <FamilyProvider>
                <TodosProvider>
                <RoutinesProvider>
                  <OnboardingGate />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                    <Stack.Screen name="topic/[id]" options={{ ...header, title: '주제' }} />
                    <Stack.Screen name="notifications" options={{ ...header, title: '알림' }} />
                    <Stack.Screen name="family" options={{ ...header, title: '가족과 함께 보기' }} />
                    <Stack.Screen name="routine-recommend" options={{ ...header, title: '루틴 추천' }} />
                    <Stack.Screen name="todo-recommend" options={{ ...header, title: '할 일 추천' }} />
                    <Stack.Screen name="lists" options={{ ...header, title: '준비 목록' }} />
                    <Stack.Screen name="topics" options={{ ...header, title: '주제별 보기' }} />
                    <Stack.Screen name="legal/[doc]" options={header} />
                  </Stack>
                </RoutinesProvider>
                </TodosProvider>
                </FamilyProvider>
              </RecordsProvider>
            </BabyProvider>
          </PreferencesProvider>
        </EntitlementsProvider>
      </QueryClientProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
