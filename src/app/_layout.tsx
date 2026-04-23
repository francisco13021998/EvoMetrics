import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/providers/auth-provider';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <AuthProvider>
      <ThemeProvider
        value={{
          ...(theme ?? DefaultTheme),
          colors: {
            ...(theme?.colors ?? DefaultTheme.colors),
            background: palette.background,
            card: palette.backgroundElement,
            text: palette.text,
            border: palette.backgroundSelected,
            primary: palette.text,
          },
        }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
            animation: 'slide_from_right',
          }}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}
