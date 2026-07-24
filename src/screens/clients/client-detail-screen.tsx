import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppCheckbox } from '@/components/forms/app-checkbox';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { RevisionRow } from '@/components/surface/revision-row';
import { ThemedText } from '@/components/themed-text';
import { formatAthleteLevelLabel } from '@/constants/athlete-level';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPayment, Revision, RevisionFrequencyUnit } from '@/types/domain';
import { formatClientAge } from '@/utils/client-age';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { INACTIVE_REVISION_FREQUENCY_VALUE, calculateClientRevisionStatus, isRevisionFrequencyActive } from '@/utils/client-revisions';

type ClientDetailScreenProps = {
  clientId: string;
};

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  return '-';
}

const REVISION_FREQUENCY_UNIT_OPTIONS = [
  { label: 'Semanas', value: 'week' },
  { label: 'Meses', value: 'month' },
];

function formatRevisionFrequencyLabel(value: number, unit: RevisionFrequencyUnit) {
  const label = unit === 'week' ? 'semana' : 'mes';

  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

function normalizeRevisionFrequencyValue(value: string) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [isRevisionSettingsOpen, setIsRevisionSettingsOpen] = useState(false);
  const [isSavingRevisionSettings, setIsSavingRevisionSettings] = useState(false);
  const [revisionFrequencyEnabled, setRevisionFrequencyEnabled] = useState(false);
  const [revisionFrequencyValueInput, setRevisionFrequencyValueInput] = useState('4');
  const [revisionFrequencyUnit, setRevisionFrequencyUnit] = useState<RevisionFrequencyUnit>('week');

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
        setRevisionFrequencyEnabled(isRevisionFrequencyActive(nextClient.revisionFrequencyValue, nextClient.revisionFrequencyUnit));
        setRevisionFrequencyValueInput(isRevisionFrequencyActive(nextClient.revisionFrequencyValue, nextClient.revisionFrequencyUnit) ? String(nextClient.revisionFrequencyValue) : '0');
        setRevisionFrequencyUnit(nextClient.revisionFrequencyUnit ?? 'week');
      }

      if (nextClient) {
        const [nextRevisions, nextPayments] = await Promise.all([
          revisionsService.listByClient(nextClient.id),
          clientPaymentsService.listByClient(nextClient.id),
        ]);
        setRevisions(nextRevisions);
        setPayments(nextPayments);
      } else {
        setRevisions([]);
        setPayments([]);
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

  const paymentStatus = useMemo(
    () => calculateClientPaymentStatus(client, payments),
    [client, payments]
  );

  const revisionStatus = useMemo(
    () => calculateClientRevisionStatus(client, revisions),
    [client, revisions]
  );

  const hasRevisionFrequency = isRevisionFrequencyActive(client?.revisionFrequencyValue, client?.revisionFrequencyUnit);

  const revisionFrequencySummary = hasRevisionFrequency
    ? formatRevisionFrequencyLabel(client.revisionFrequencyValue, client.revisionFrequencyUnit)
    : 'Sin frecuencia de revisiones';

  function openRevisionSettings() {
    if (!client || isAthlete) {
      return;
    }

    setRevisionFrequencyEnabled(isRevisionFrequencyActive(client.revisionFrequencyValue, client.revisionFrequencyUnit));
    setRevisionFrequencyValueInput(isRevisionFrequencyActive(client.revisionFrequencyValue, client.revisionFrequencyUnit) ? String(client.revisionFrequencyValue) : '0');
    setRevisionFrequencyUnit(client.revisionFrequencyUnit ?? 'week');
    setIsRevisionSettingsOpen(true);
  }

  function closeRevisionSettings() {
    setIsRevisionSettingsOpen(false);
  }

  async function handleSaveRevisionSettings() {
    if (!client || !user?.id || isAthlete || isSavingRevisionSettings) {
      return;
    }

    const parsedValue = normalizeRevisionFrequencyValue(revisionFrequencyValueInput);

    if (revisionFrequencyEnabled && !parsedValue) {
      setErrorMessage('El numero de revisiones debe ser un entero mayor que cero.');
      return;
    }

    setIsSavingRevisionSettings(true);
    setErrorMessage(null);

    try {
      await clientsService.update(client.id, user.id, {
        revisionFrequencyValue: revisionFrequencyEnabled ? parsedValue : INACTIVE_REVISION_FREQUENCY_VALUE,
        revisionFrequencyUnit: revisionFrequencyEnabled ? revisionFrequencyUnit : 'week',
      });
      await loadClient();
      closeRevisionSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la frecuencia de revisiones.';
      setErrorMessage(message);
    } finally {
      setIsSavingRevisionSettings(false);
    }
  }

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

        {paymentStatus.isPending ? (
          <StatusBanner
            tone="warning"
            title="Pendiente de pago"
            message="Este cliente no está al corriente de pago. Revisa su historial antes de continuar."
          />
        ) : null}

        {!isAthlete ? (
          <View style={[styles.paymentShortcutPanel, { borderColor: theme.backgroundSelected, backgroundColor: '#F8FBFF' }]}>
            <View style={styles.paymentShortcutCopy}>
              <ThemedText type="small" themeColor="textSecondary">Pagos</ThemedText>
              <ThemedText type="smallBold" style={styles.paymentShortcutTitle}>Accede a la gestión de cobros</ThemedText>
            </View>
            <AppButton
              label="Pagos"
              variant="surface"
              size="compact"
              fullWidth={false}
              onPress={() => router.push(`/clients/${client.id}/payments`)}
            />
          </View>
        ) : null}

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
          <View style={styles.revisionHeaderCopy}>
            <ThemedText type="headline">Revisiones</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.revisionFrequencyText}>
              {revisionFrequencySummary}
            </ThemedText>
          </View>
          <View style={styles.revisionHeaderActions}>
            {revisionStatus.isConfigured ? (
              <View
                style={[
                  styles.revisionStatusPill,
                  { backgroundColor: revisionStatus.isPending ? '#FFF7E8' : '#ECF9F3' },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.revisionStatusIcon,
                    { color: revisionStatus.isPending ? Accent.warning : Accent.success },
                  ]}>
                  {revisionStatus.isPending ? '!' : '✓'}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  style={{ color: revisionStatus.isPending ? Accent.warning : Accent.success }}>
                  {revisionStatus.isPending ? 'Pendiente' : 'Al día'}
                </ThemedText>
              </View>
            ) : null}
            {!isAthlete ? (
              <Pressable
                onPress={openRevisionSettings}
                accessibilityLabel="Configurar frecuencia de revisiones"
                style={({ pressed }) => [
                  styles.revisionSettingsButton,
                  {
                    borderColor: theme.backgroundSelected,
                    backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={styles.revisionSettingsIcon}>⚙</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.actionsBlock}>
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

        <Modal transparent visible={isRevisionSettingsOpen} animationType="fade" onRequestClose={closeRevisionSettings}>
          <Pressable style={styles.menuBackdrop} onPress={closeRevisionSettings}>
            <Pressable style={[styles.menuPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
              <View style={styles.revisionSettingsHeader}>
                <View>
                  <ThemedText type="smallBold">Frecuencia de revisiones</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Define cada cuánto debe volver este cliente a revisión.
                  </ThemedText>
                </View>
                <Pressable onPress={closeRevisionSettings} style={styles.revisionSettingsCloseButton}>
                  <ThemedText type="smallBold" style={styles.revisionSettingsCloseText}>×</ThemedText>
                </Pressable>
              </View>

              <AppInput
                label="Numero"
                placeholder="4"
                keyboardType="number-pad"
                inputMode="numeric"
                value={revisionFrequencyValueInput}
                onChangeText={setRevisionFrequencyValueInput}
                containerStyle={styles.revisionSettingsField}
              />
              <AppCheckbox
                label="Usar frecuencia de revisiones"
                checked={revisionFrequencyEnabled}
                onChange={setRevisionFrequencyEnabled}
                helper="Desmárcalo para quitar la frecuencia guardada."
              />
              {revisionFrequencyEnabled ? (
                <>
                  <AppSelect
                    label="Unidad"
                    value={revisionFrequencyUnit}
                    options={REVISION_FREQUENCY_UNIT_OPTIONS}
                    onChange={(value) => setRevisionFrequencyUnit(value as RevisionFrequencyUnit)}
                    containerStyle={styles.revisionSettingsField}
                  />
                  <View style={styles.revisionSettingsPreview}>
                    <ThemedText type="small" themeColor="textSecondary">Configuración actual</ThemedText>
                    <ThemedText type="smallBold">{formatRevisionFrequencyLabel(Number(revisionFrequencyValueInput) || 0, revisionFrequencyUnit)}</ThemedText>
                  </View>
                </>
              ) : (
                <StatusBanner tone="info" message="Al guardar, la frecuencia quedará desactivada para este cliente." />
              )}

              <View style={styles.revisionSettingsActions}>
                <AppButton
                  label="Cancelar"
                  variant="ghost"
                  size="compact"
                  fullWidth={false}
                  onPress={closeRevisionSettings}
                  disabled={isSavingRevisionSettings}
                />
                <AppButton
                  label="Guardar"
                  onPress={() => void handleSaveRevisionSettings()}
                  loading={isSavingRevisionSettings}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
  paymentShortcutPanel: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentShortcutCopy: {
    flex: 1,
    gap: 2,
  },
  paymentShortcutTitle: {
    color: '#10203B',
  },
  paymentMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMetaItem: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: Radius.small,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    gap: 2,
  },
  paymentMetaValue: {
    color: '#10203B',
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
  revisionHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  revisionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  revisionStatusIcon: {
    fontSize: 12,
    lineHeight: 14,
  },
  revisionSettingsButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  revisionSettingsIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
    marginTop: -1,
  },
  revisionFrequencyText: {
    lineHeight: 18,
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
  revisionSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  revisionSettingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  revisionSettingsCloseText: {
    color: Accent.primary,
    lineHeight: 20,
  },
  revisionSettingsField: {
    minHeight: 56,
    borderRadius: Radius.medium,
  },
  revisionSettingsPreview: {
    borderWidth: 1,
    borderColor: '#D9E6FB',
    borderRadius: Radius.medium,
    backgroundColor: '#F8FBFF',
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    gap: 2,
  },
  revisionSettingsActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});