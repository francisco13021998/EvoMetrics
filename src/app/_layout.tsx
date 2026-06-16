import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/providers/auth-provider';

const palette = Colors.light;

export default function TabLayout() {
  return (
    <AuthProvider>
      <ThemeProvider
        value={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: palette.background,
            card: palette.backgroundElement,
            text: palette.text,
            border: palette.backgroundSelected,
            primary: palette.text,
          },
        }}>
        <StatusBar style="dark" />
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
