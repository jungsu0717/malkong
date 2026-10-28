import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { TeddyIcon } from '@/components/baby-icons';
import { FontFamily } from '@/constants/theme';
import { useGrowthAlerts } from '@/hooks/use-growth';
import { useTheme } from '@/hooks/use-theme';

/** 탭 넷 — 홈(첫 화면, 루틴은 홈에서 들어가는 상세 화면) · 할 일(장보기 · 준비 목록 포함) · 성장 · 마이 (decisions/027 · 029 · 031 · 034) */
export default function TabLayout() {
  const c = useTheme();
  // 성장 소식(주차 · 달이 바뀌는 날 아침) — 앱을 열 때마다 다시 건다
  useGrowthAlerts();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarLabelStyle: { fontFamily: FontFamily.medium, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.divider,
          ...(Platform.OS === 'web' ? { height: 64, paddingTop: 6 } : {}),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: '할 일',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="growth"
        options={{
          title: '성장',
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: '마이',
          tabBarIcon: ({ color, size }) => <TeddyIcon size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
