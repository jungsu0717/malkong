import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { BottleIcon, TeddyIcon } from '@/components/baby-icons';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 탭 다섯 — 홈(첫 화면, 한눈 요약) · 할 일 · 장보기 · 기록 · 마이 (decisions/026, Julian 2026-10-15) */
export default function TabLayout() {
  const c = useTheme();

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
        name="shop"
        options={{
          title: '장보기',
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: '기록',
          tabBarIcon: ({ color, size }) => <BottleIcon size={size} color={color} />,
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
