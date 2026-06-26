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
import { formatClientAge } from '@/utils/client-age';

type ClientDetailScreenProps = {
  clientId: string;
};

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

export function ClientDetailScreen({ clientId }: ClientDetailScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
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
      const nextClient = isAthlete
        ? await clientsService.getByIdForViewer(clientId)
        : await clientsService.getById(clientId, user.id!);
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
  }, [clientId, user?.id, isAthlete]);

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
    { label: 'Edad', value: formatClientAge(client) },
    { label: 'Altura', value: client.heightCm ? `${client.heightCm} cm` : '-' },
  ];

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroTopAccent} />

        <View style={styles.brandRow}>
          <View style={styles.brandCopy}>
            <ThemedText type="label" style={styles.brandEyebrow}>Ficha de cliente</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Control y seguimiento profesional</ThemedText>
          </View>
          <View style={styles.brandActions}>
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

            {!isAthlete && (
              <Pressable
                onPress={() => setIsClientMenuOpen(true)}
                accessibilityLabel="Más opciones"
                style={({ pressed }) => [
                  styles.menuIconButton,
                  {
                    borderColor: theme.backgroundSelected,
                    backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}>
                <ThemedText type="headline" style={styles.menuDots}>⋯</ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="label" style={styles.heroEyebrow}>Perfil activo</ThemedText>
          <View style={styles.heroTitleRow}>
            <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
          </View>
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

      <View style={[styles.section, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="headline">Revisiones</ThemedText>
          <View style={styles.revisionHeaderActions}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.revisionCountText}>
              {revisions.length} {revisions.length === 1 ? 'revisión' : 'revisiones'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.actionsBlock}>
          {!isAthlete && client.athleteUserId === null && (
            <StatusBanner
              tone="warning"
              title="PIN Atleta"
              message="Función en mantenimiento"
            />
          )}
          <View style={styles.actionsTopRow}>
            <View style={styles.actionCell}>
              <AppButton label="Fotos" variant="surface" size="compact" onPress={() => router.push(`/clients/${client.id}/photos`)} />
            </View>
            <View style={styles.actionCell}>
              <AppButton label="Análisis" variant="surface" size="compact" onPress={() => router.push(`/clients/${client.id}/metrics`)} />
            </View>
            {!isAthlete && (
              <View style={styles.actionCell}>
                <AppButton
                  label="Revision"
                  size="compact"
                  leadingIcon={<ThemedText type="smallBold" style={styles.newRevisionIcon}>+</ThemedText>}
                  onPress={() => router.push(`/revisions/new?clientId=${client.id}`)}
                />
              </View>
            )}
          </View>
          {!isAthlete && client.athleteUserId === null && (
            <AppButton
              label="PIN Atleta"
              variant="surface"
              size="compact"
              disabled
            />
          )}
          {!isAthlete && client.athleteUserId !== null && (
            <View style={[styles.athleteLinkedBadge, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
              <View style={[styles.timerDot, { backgroundColor: '#22C55E' }]} />
              <ThemedText type="small" style={{ color: '#15803D' }}>Atleta vinculado</ThemedText>
            </View>
          )}
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
    backgroundColor: '#2D66E0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#E1EAF8',
    paddingBottom: 8,
  },
  brandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  brandEyebrow: {
    color: '#1E4FBF',
  },
  heroCopy: {
    gap: 2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  heroTitle: {
    flex: 1,
    color: '#10203B',
    fontSize: 32,
    lineHeight: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backButtonIcon: {
    color: Accent.primary,
    fontSize: 12,
    lineHeight: 14,
  },
  backButtonText: {
    color: '#10203B',
    fontSize: 12,
    lineHeight: 14,
  },
  menuIconButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuDots: {
    color: '#1F3D69',
    marginTop: -2,
    lineHeight: 20,
  },
  newRevisionIcon: {
    color: Accent.primary,
    lineHeight: 16,
    marginTop: -1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
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
    width: 240,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
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
    gap: 10,
    flexWrap: 'wrap',
  },
  actionCell: {
    flex: 1,
    minWidth: 96,
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
  athleteLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});