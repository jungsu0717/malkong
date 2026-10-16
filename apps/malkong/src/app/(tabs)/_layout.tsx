import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { TeddyIcon } from '@/components/baby-icons';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 탭 넷 — 오늘(첫 화면, 루틴과 오늘 할 일) · 할 일 · 장보기 · 마이. 기록은 마이 → 기록 (decisions/026~028) */
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
          title: '오늘',
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} />,
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
        name="my"
        options={{
          title: '마이',
          tabBarIcon: ({ color, size }) => <TeddyIcon size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
