import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
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

type ClientDetailScreenProps = {
  clientId: string;
};

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

export function ClientDetailScreen({ clientId }: ClientDetailScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);

  const showInitialLoading = isLoading && !client;

  const loadClient = useCallback(async () => {
    if (!user?.id) {
      setClient(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = await clientsService.getById(clientId, user.id);
      setClient(nextClient);

      if (nextClient) {
        const nextRevisions = await revisionsService.listByClient(nextClient.id);
        setRevisions(nextRevisions);
      } else {
        setRevisions([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el cliente.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadClient();
    }, [loadClient])
  );

  async function confirmDelete() {
    if (!client || !user?.id || isDeleting) return;

    setIsDeleting(true);

    try {
      await clientsService.remove(client.id, user.id);
      router.replace('/clients');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el cliente.';
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDelete() {
    if (!client) return;

    setIsClientMenuOpen(false);

    Alert.alert(
      'Eliminar cliente',
      `Se eliminara ${client.name}. Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void confirmDelete(); } },
      ]
    );
  }

  if (showInitialLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Sincronizando datos del cliente." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <PageHeader title="Error" />
        <PageSection first>
          <StatusBanner tone="danger" message={errorMessage} />
          <AppButton label="Reintentar" onPress={() => void loadClient()} variant="secondary" />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no encontrado"
          description="Este perfil no existe o no pertenece al usuario autenticado."
          actionLabel="Volver a clientes"
          onAction={() => router.replace('/clients')}
        />
      </ScreenContainer>
    );
  }

  const summaryItems = [
    { label: 'Sexo', value: formatSex(client.sex) },
    { label: 'Edad', value: client.age ? `${client.age} años` : '-' },
    { label: 'Altura', value: client.heightCm ? `${client.heightCm} cm` : '-' },
  ];

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={styles.backButtonIcon}>←</ThemedText>
            <ThemedText type="smallBold" style={styles.backButtonText}>Volver</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setIsClientMenuOpen(true)}
            accessibilityLabel="Más opciones"
            style={({ pressed }) => [
              styles.menuButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <ThemedText type="headline" style={styles.menuDots}>⋯</ThemedText>
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
        </View>

        <View style={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <View
              key={item.label}
              style={[
                styles.summaryItem,
                { borderColor: theme.backgroundSelected, backgroundColor: '#F8FBFF' },
              ]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.summaryLabel}>{item.label}</ThemedText>
              <ThemedText type="smallBold" style={styles.summaryValue}>{item.value}</ThemedText>
            </View>
          ))}
        </View>

        <View style={[styles.levelPanel, { borderColor: theme.backgroundSelected, backgroundColor: '#F8FBFF' }]}>
          <View style={styles.levelPanelHeader}>
            <ThemedText type="small" themeColor="textSecondary">Nivel del cliente</ThemedText>
            <View style={[styles.levelBadge, { backgroundColor: Accent.primaryMuted }]}>
              <ThemedText type="smallBold" style={styles.levelBadgeText}>{formatAthleteLevelLabel(client.athleteLevel)}</ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.levelHint}>
            Orienta los protocolos por defecto.
          </ThemedText>
        </View>

        <Modal transparent visible={isClientMenuOpen} animationType="fade" onRequestClose={() => setIsClientMenuOpen(false)}>
          <Pressable style={styles.menuBackdrop} onPress={() => setIsClientMenuOpen(false)}>
            <Pressable style={[styles.menuPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
              <AppButton
                label="Editar cliente"
                variant="surface"
                size="compact"
                onPress={() => {
                  setIsClientMenuOpen(false);
                  router.push(`/clients/${client.id}/edit`);
                }}
              />
              <AppButton
                label="Eliminar cliente"
                variant="danger"
                size="compact"
                onPress={handleDelete}
                loading={isDeleting}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="headline">Revisiones</ThemedText>
          <View style={styles.revisionHeaderActions}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.revisionCountText}>
              {revisions.length} {revisions.length === 1 ? 'revisión' : 'revisiones'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.actionsBlock}>
          <View style={styles.actionsTopRow}>
            <View style={styles.actionCell}>
              <AppButton
                label="+ Revision"
                size="compact"
                leadingIcon={<ThemedText type="smallBold" style={styles.newRevisionIcon}>+</ThemedText>}
                onPress={() => router.push(`/revisions/new?clientId=${client.id}`)}
              />
            </View>
            <View style={styles.actionCell}>
              <AppButton label="Análisis" variant="surface" size="compact" onPress={() => router.push(`/clients/${client.id}/metrics`)} />
            </View>
            <View style={styles.actionCell}>
              <AppButton label="Fotos" variant="surface" size="compact" onPress={() => router.push(`/clients/${client.id}/photos`)} />
            </View>
          </View>
        </View>

        <View style={[styles.revisionsPanel, { borderColor: theme.backgroundSelected }]}>
          {revisions.length === 0 ? (
            <View style={styles.emptyRevisions}>
              <ThemedText type="small" themeColor="textSecondary">Sin revisiones registradas.</ThemedText>
            </View>
          ) : (
            <View>
              {revisions.map((revision, index) => (
                <RevisionRow
                  key={revision.id}
                  phase={revision.phase}
                  date={new Date(revision.reviewedAt).toLocaleDateString('es-ES')}
                  weight={revision.weightKg ? `${revision.weightKg} kg` : '-'}
                  onPress={() => router.push(`/revisions/${revision.id}`)}
                  last={index === revisions.length - 1}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: Spacing.two,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heroCopy: {
    gap: 4,
  },
  heroTitle: {
    color: '#10203B',
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonIcon: {
    color: Accent.primary,
  },
  backButtonText: {
    color: '#10203B',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuDots: {
    color: '#10203B',
    lineHeight: 24,
    marginTop: -2,
  },
  newRevisionIcon: {
    color: Accent.primary,
    lineHeight: 16,
    marginTop: -1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: 12,
    paddingHorizontal: Spacing.two,
    gap: 2,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    textAlign: 'left',
  },
  summaryValue: {
    textAlign: 'left',
    color: '#10203B',
  },
  levelPanel: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: 12,
    gap: 4,
  },
  levelPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  levelBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  levelBadgeText: {
    color: Accent.primary,
  },
  levelHint: {
    lineHeight: 18,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.16)',
    paddingHorizontal: Spacing.three,
    paddingTop: 96,
  },
  menuPanel: {
    alignSelf: 'flex-end',
    width: 220,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  section: {
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  revisionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  revisionCountText: {
    color: '#10203B',
  },
  actionsBlock: {
    borderWidth: 1,
    borderColor: Accent.border,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  actionsTopRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  actionCell: {
    flex: 1,
    minWidth: 96,
  },
  revisionsPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  emptyRevisions: {
    paddingVertical: Spacing.two,
  },
});