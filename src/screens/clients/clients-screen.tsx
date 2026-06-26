import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

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
import { formatClientAge } from '@/utils/client-age';

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
  const syncStatus = isLoadingClients ? 'Sincronizando...' : clientsError ? 'Requiere revision' : 'Sincronizado';

  const loadClients = useCallback(async () => {
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
  }, [user?.id]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useFocusEffect(
    React.useCallback(() => {
      void loadClients();
    }, [loadClients])
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
        <View style={styles.brandStrip}>
          <View style={styles.brandBadge}>
            <Image source={require('../../../assets/branding/logo-evometrics.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <View style={styles.brandCopy}>
            <ThemedText type="label" style={styles.brandEyebrow}>
              Dashboard
            </ThemedText>
            <ThemedText type="small" style={styles.brandText}>
              Control de clientes EvoMetrics
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

        <View style={styles.heroTopRow}>
          <ThemedText type="label" style={styles.heroEyebrow}>
            Resumen operativo
          </ThemedText>
          <View style={styles.heroIdentity}>
            <ThemedText style={styles.heroTitle}>{userName}</ThemedText>
            <View style={styles.heroMetaRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
                {clinicName || 'Centro o marca pendiente'}
              </ThemedText>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, clientsError ? styles.statusDotWarning : styles.statusDotOk]} />
                <ThemedText type="small" style={styles.statusText}>
                  {syncStatus}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.heroMetricsRow}>
          <DashboardMetricCard
            label="Clientes activos"
            value={String(clients.length)}
            helper="Perfiles disponibles para seguimiento"
            tone="primary"
          />
          <DashboardMetricCard
            label="Ganancias mensuales"
            value="1.480 EUR"
            helper="Estimacion mensual actual"
            variant="placeholder"
          />
        </View>

        <StatusBanner tone="warning" title="PIN Atleta" message="Función en mantennimiento" />
      </View>

      <View style={styles.clientsSection}>
        <View style={styles.clientsHeader}>
          <View style={styles.clientsHeaderCopy}>
            <ThemedText type="label" style={styles.clientsEyebrow}>
              Clientes
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.clientsSubcopy}>
              {hasClients ? `${clients.length} perfiles disponibles` : 'Sin perfiles cargados'}
            </ThemedText>
          </View>
          <View style={styles.clientsHeaderActions}>
            <AppButton
              label="PIN Atleta"
              variant="surface"
              size="compact"
              fullWidth={false}
              disabled
            />
            <AppButton label="Nuevo cliente" onPress={() => router.push('/clients/new')} size="compact" fullWidth={false} />
          </View>
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
              description="Crea el primer perfil para empezar el seguimiento profesional de forma estructurada."
              actionLabel="Crear cliente"
              actionVariant="primary"
              onAction={() => router.push('/clients/new')}
            />
          </View>
        ) : (
          <View style={[styles.clientsList, { borderColor: theme.backgroundSelected }]}>
            {clients.map((client, index) => (
              <ClientRow
                key={client.id}
                name={client.name}
                meta={`${formatSex(client.sex)} · ${formatClientAge(client) === '-' ? 'Edad pendiente' : formatClientAge(client)} · ${client.heightCm ? `${client.heightCm} cm` : 'Altura pendiente'}`}
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
    borderWidth: 1,
    borderColor: '#D8E5F8',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    shadowColor: '#12336E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1EAF8',
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E2F8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  brandEyebrow: {
    color: '#1E4FBF',
  },
  brandText: {
    color: '#3F5780',
    lineHeight: 18,
  },
  heroTopRow: {
    gap: 6,
  },
  heroIdentity: {
    gap: 5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  heroTitle: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    flex: 1,
    lineHeight: 19,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: '#D8E6FB',
    borderRadius: Radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  statusDotOk: {
    backgroundColor: '#1F57D6',
  },
  statusDotWarning: {
    backgroundColor: '#DC5B5B',
  },
  statusText: {
    color: '#27406A',
    lineHeight: 17,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  assuranceRow: {
    backgroundColor: '#F4F8FF',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#D9E6FB',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  assuranceText: {
    color: '#35517A',
    lineHeight: 18,
  },
  clientsSection: {
    gap: Spacing.two,
    paddingTop: 12,
  },
  clientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  clientsHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  clientsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientsEyebrow: {
    color: Accent.primary,
  },
  clientsSubcopy: {
    marginTop: 2,
    lineHeight: 18,
  },
  clientsList: {
    gap: 0,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
});