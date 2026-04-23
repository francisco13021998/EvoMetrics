import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ClientRow } from '@/components/surface/client-row';
import { Accent, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { Client } from '@/types/domain';

import { ThemedText } from '@/components/themed-text';

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  if (sex === 'other') return 'Otro';
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
      <PageHeader
        eyebrow="Panel"
        title="Clientes"
        subtitle={user?.email ?? undefined}
        rightSlot={
          <AppButton
            label="Cerrar sesion"
            variant="ghost"
            size="compact"
            onPress={handleLogout}
            loading={isSigningOut}
            fullWidth={false}
          />
        }
      />

      <PageSection first>
        <View style={[styles.statsStrip, { borderBottomColor: theme.backgroundSelected }]}>
          <View style={styles.statBlock}>
            <ThemedText type="label" themeColor="textSecondary">Clientes</ThemedText>
            <ThemedText type="headline" style={styles.statValuePrimary}>{clients.length}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.statBlock}>
            <ThemedText type="label" themeColor="textSecondary">Altura media</ThemedText>
            <ThemedText type="headline">
              {clients.filter((c) => c.heightCm !== null).length
                ? `${Math.round(
                    clients.filter((c) => c.heightCm !== null).reduce((t, c) => t + (c.heightCm ?? 0), 0) /
                    clients.filter((c) => c.heightCm !== null).length
                  )} cm`
                : '-'}
            </ThemedText>
          </View>
        </View>
      </PageSection>

      <PageSection label="Clientes" rightSlot={
        <AppButton label="Nuevo cliente" size="compact" fullWidth={false} onPress={() => router.push('/clients/new')} />
      }>
        {showInitialLoading ? (
          <StatusBanner tone="info" loading message="Cargando clientes..." />
        ) : clientsError ? (
          <>
            <StatusBanner tone="danger" message={clientsError} />
            <AppButton label="Reintentar" onPress={() => void loadClients()} variant="secondary" />
          </>
        ) : clients.length === 0 ? (
          <EmptyState
            title="Sin clientes todavia"
            description="Crea el primer perfil para comenzar el seguimiento."
            actionLabel="Crear cliente"
            actionVariant="primary"
            onAction={() => router.push('/clients/new')}
          />
        ) : (
          <View>
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
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    gap: Spacing.three,
  },
  statBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  statValuePrimary: {
    color: Accent.primary,
  },
});