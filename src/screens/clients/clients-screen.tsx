import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ClientRow } from '@/components/surface/client-row';
import { DashboardMetricCard } from '@/components/surface/dashboard-metric-card';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { Client } from '@/types/domain';

import { ThemedText } from '@/components/themed-text';

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

export function ClientsScreen() {
  const { signOut, user } = useAuth();
  const theme = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const hasClients = clients.length > 0;
  const showInitialLoading = isLoadingClients && !hasClients && !clientsError;
  const userName = (user?.user_metadata?.fullName as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const clinicName = (user?.user_metadata?.clinicName as string | undefined)?.trim() || null;

  async function loadClients() {
    if (!user?.id) {
      setClients([]);
      setIsLoadingClients(false);
      return;
    }

    setIsLoadingClients(true);
    setClientsError(null);

    try {
      const nextClients = await clientsService.listByOwner(user.id);
      setClients(nextClients);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
      setClientsError(message);
    } finally {
      setIsLoadingClients(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      void loadClients();
    }, [user?.id])
  );

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <ThemedText type="label" style={styles.heroEyebrow}>Panel</ThemedText>
            <ThemedText style={styles.heroTitle}>{userName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
              {clinicName || 'Centro o marca pendiente'}
            </ThemedText>
          </View>
          <AppButton
            label="Salir"
            variant="ghost"
            size="compact"
            onPress={handleLogout}
            loading={isSigningOut}
            fullWidth={false}
          />
        </View>

        <View style={styles.heroMetricsRow}>
          <DashboardMetricCard
            label="Clientes"
            value={String(clients.length)}
            tone="primary"
          />
          <DashboardMetricCard
            label="Facturación media mensual"
            value="-"
          />
        </View>

        <View style={styles.primaryActionRow}>
          <AppButton label="Nuevo cliente" onPress={() => router.push('/clients/new')} />
        </View>
      </View>

      <View style={styles.clientsSection}>
        <View style={styles.clientsHeader}>
          <ThemedText type="label" style={styles.clientsEyebrow}>Clientes</ThemedText>
        </View>

        {showInitialLoading ? (
          <StatusBanner tone="info" loading message="Cargando clientes..." />
        ) : clientsError ? (
          <>
            <StatusBanner tone="danger" message={clientsError} />
            <AppButton label="Reintentar" onPress={() => void loadClients()} variant="secondary" />
          </>
        ) : clients.length === 0 ? (
          <View style={[styles.emptyWrap, { borderColor: theme.backgroundSelected }]}>
            <EmptyState
              title="Sin clientes todavía"
              description="Crea el primer perfil para empezar el seguimiento profesional."
              actionLabel="Crear cliente"
              actionVariant="primary"
              onAction={() => router.push('/clients/new')}
            />
          </View>
        ) : (
          <View style={styles.clientsList}>
            {clients.map((client, index) => (
              <ClientRow
                key={client.id}
                name={client.name}
                meta={`${formatSex(client.sex)} · ${client.age ? `${client.age} años` : 'Edad pendiente'} · ${client.heightCm ? `${client.heightCm} cm` : 'Altura pendiente'}`}
                onPress={() => router.push(`/clients/${client.id}`)}
                last={index === clients.length - 1}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heroIdentity: {
    flex: 1,
    gap: Spacing.one,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  heroTitle: {
    color: '#10203B',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: 700,
  },
  heroSubtitle: {
    maxWidth: 260,
    lineHeight: 19,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryActionRow: {
    paddingTop: Spacing.one,
  },
  clientsSection: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  clientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientsEyebrow: {
    color: Accent.primary,
  },
  clientsList: {
    gap: 0,
  },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
});