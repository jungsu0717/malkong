import { DarkTheme, DefaultTheme, ThemeProvider, Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BabyFaceIcon, PacifierIcon, RattleIcon, TeddyIcon } from '@/components/baby-icons';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.background },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
            tabBarIcon: ({ color, size }) => <BabyFaceIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ask"
          options={{
            title: '물어보기',
            tabBarIcon: ({ color, size }) => <PacifierIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="growth"
          options={{
            title: '성장',
            tabBarIcon: ({ color, size }) => <RattleIcon size={size} color={color} />,
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
    </ThemeProvider>
  );
}
