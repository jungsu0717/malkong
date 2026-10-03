import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { BabyFaceIcon, ChatBubbleIcon, TeddyIcon } from '@/components/baby-icons';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 탭 셋 — 말콩(대화, 첫 화면) · 우리 아기 · 마이 (decisions/012) */
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
          title: '말콩',
          tabBarIcon: ({ color, size }) => <ChatBubbleIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="baby"
        options={{
          title: '우리 아기',
          tabBarIcon: ({ color, size }) => <BabyFaceIcon size={size} color={color} />,
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
