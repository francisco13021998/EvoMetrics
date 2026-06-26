import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { RevisionRow } from '@/components/surface/revision-row';
import { ThemedText } from '@/components/themed-text';
import { formatAthleteLevelLabel } from '@/constants/athlete-level';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, Revision } from '@/types/domain';
import { formatClientAge } from '@/utils/client-age';

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

export function AthleteHomeScreen() {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = await clientsService.getByAthleteUserId(user.id);
      setClient(nextClient);

      if (nextClient) {
        const nextRevisions = await revisionsService.listByClient(nextClient.id);
        setRevisions(nextRevisions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar tus datos.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
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

  if (isLoading) {
    return (
      <ScreenContainer>
        <StatusBanner tone="info" loading message="Cargando tu perfil..." />
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <StatusBanner tone="danger" message={errorMessage} />
        <AppButton label="Reintentar" variant="secondary" onPress={() => void loadData()} />
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Perfil no encontrado"
          description="No se encontró un perfil vinculado a tu cuenta. Contacta con tu entrenador."
          actionLabel="Cerrar sesión"
          onAction={() => { void handleLogout(); }}
        />
      </ScreenContainer>
    );
  }

  const summaryItems = [
    { label: 'Sexo', value: formatSex(client.sex) },
    { label: 'Edad', value: formatClientAge(client) },
    { label: 'Altura', value: client.heightCm ? `${client.heightCm} cm` : '-' },
  ];

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      {/* Hero card */}
      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroTopAccent} />

        <View style={styles.brandRow}>
          <View style={styles.brandCopy}>
            <ThemedText type="label" style={styles.brandEyebrow}>Mi perfil</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Datos de seguimiento (solo lectura)</ThemedText>
          </View>
          <AppButton
            label="Salir"
            variant="ghost"
            size="compact"
            fullWidth={false}
            onPress={() => { void handleLogout(); }}
            loading={isSigningOut}
          />
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="label" style={styles.heroEyebrow}>Atleta activo</ThemedText>
          <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
        </View>

        <View style={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <View
              key={item.label}
              style={[styles.summaryItem, { borderColor: theme.backgroundSelected, backgroundColor: '#F8FBFF' }]}>
              <ThemedText type="small" themeColor="textSecondary">{item.label}</ThemedText>
              <ThemedText type="smallBold" style={styles.summaryValue}>{item.value}</ThemedText>
            </View>
          ))}
        </View>

        <View style={[styles.levelPanel, { borderColor: theme.backgroundSelected, backgroundColor: '#F8FBFF' }]}>
          <ThemedText type="small" themeColor="textSecondary">Nivel</ThemedText>
          <View style={[styles.levelBadge, { backgroundColor: Accent.primaryMuted }]}>
            <ThemedText type="smallBold" style={{ color: Accent.primary }}>{formatAthleteLevelLabel(client.athleteLevel)}</ThemedText>
          </View>
        </View>
      </View>

      {/* Acciones de análisis */}
      <View style={[styles.section, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="headline">Mi progreso</ThemedText>
        </View>
        <View style={styles.actionsRow}>
          <View style={styles.actionCell}>
            <AppButton
              label="Fotos"
              variant="surface"
              size="compact"
              onPress={() => router.push(`/clients/${client.id}/photos`)}
            />
          </View>
          <View style={styles.actionCell}>
            <AppButton
              label="Análisis"
              variant="surface"
              size="compact"
              onPress={() => router.push(`/clients/${client.id}/metrics`)}
            />
          </View>
        </View>
      </View>

      {/* Lista de revisiones */}
      <View style={[styles.section, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="headline">Revisiones</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {revisions.length} {revisions.length === 1 ? 'revisión' : 'revisiones'}
          </ThemedText>
        </View>

        <View style={[styles.revisionsPanel, { borderColor: theme.backgroundSelected }]}>
          {revisions.length === 0 ? (
            <View style={styles.emptyRevisions}>
              <ThemedText type="small" themeColor="textSecondary">Sin revisiones registradas todavía.</ThemedText>
            </View>
          ) : (
            revisions.map((revision, index) => (
              <RevisionRow
                key={revision.id}
                phase={revision.phase}
                date={new Date(revision.reviewedAt).toLocaleDateString('es-ES')}
                weight={revision.weightKg ? `${revision.weightKg} kg` : '-'}
                onPress={() => router.push(`/revisions/${revision.id}`)}
                last={index === revisions.length - 1}
              />
            ))
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 12,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: Spacing.three,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#12336E',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  heroTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#22C55E',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E1EAF8',
    paddingBottom: 8,
  },
  brandCopy: {
    flex: 1,
    gap: 0,
  },
  brandEyebrow: {
    color: '#1E4FBF',
  },
  heroCopy: {
    gap: 2,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  heroTitle: {
    color: '#10203B',
    fontSize: 32,
    lineHeight: 36,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryItem: {
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    gap: 2,
    alignItems: 'flex-start',
  },
  summaryValue: {
    color: '#10203B',
  },
  levelPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
  },
  levelBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  section: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCell: {
    flex: 1,
  },
  revisionsPanel: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  emptyRevisions: {
    paddingVertical: Spacing.two,
  },
});
