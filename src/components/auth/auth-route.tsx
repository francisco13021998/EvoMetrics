import { Redirect } from 'expo-router';
import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

type AuthRouteProps = {
  children: ReactNode;
};

export function AuthLoadingScreen() {
  return (
    <ScreenContainer contentStyle={styles.loadingContent}>
      <View style={styles.loadingPanel}>
        <ThemedText type="label" themeColor="textSecondary">
          Acceso
        </ThemedText>
        <ThemedText type="headline">Comprobando sesion</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Conectando con tu espacio profesional.
        </ThemedText>
        <View style={styles.loadingBadge}>
          <ThemedText type="label" style={styles.loadingBadgeText}>
            EvoMetrics
          </ThemedText>
        </View>
        <ThemedText type="default" themeColor="textSecondary">
          Estamos validando tu acceso y preparando la interfaz sin saltos de pantalla innecesarios.
        </ThemedText>
        <StatusBanner
          tone="info"
          loading
          title="Sincronizando acceso"
          message="Recuperando la sesion y cargando el panel adecuado para este usuario."
        />
        <View style={styles.loadingMetaRow}>
          <View style={styles.loadingMetaPill}>
            <ThemedText type="smallBold">Auth estable</ThemedText>
          </View>
          <View style={styles.loadingMetaPill}>
            <ThemedText type="smallBold">Entrada fluida</ThemedText>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

export function GuestRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href={userRole === 'athlete' ? '/athlete' : '/clients'} />;
  }

  return <>{children}</>;
}

export function ProtectedRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}

export function TrainerRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (userRole === 'athlete') {
    return <Redirect href="/athlete" />;
  }

  return <>{children}</>;
}

export function AthleteRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (userRole !== 'athlete') {
    return <Redirect href="/clients" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 520,
  },
  loadingPanel: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  loadingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Accent.primaryMuted,
  },
  loadingBadgeText: {
    color: Accent.primary,
  },
  loadingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  loadingMetaPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: '#F4F7FC',
  },
});