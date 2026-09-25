import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AthletePinModal } from '@/components/clients/athlete-pin-modal';
import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppCheckbox } from '@/components/forms/app-checkbox';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { ModalBackdrop } from '@/components/layout/modal-backdrop';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { RevisionRow } from '@/components/surface/revision-row';
import { ThemedText } from '@/components/themed-text';
import { formatAthleteLevelLabel } from '@/constants/athlete-level';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { athletePinsService } from '@/services/athlete-pins';
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

const REVISIONS_PER_PAGE = 5;

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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [isProfileDataOpen, setIsProfileDataOpen] = useState(false);
  const [isRevisionSettingsOpen, setIsRevisionSettingsOpen] = useState(false);
  const [isSavingRevisionSettings, setIsSavingRevisionSettings] = useState(false);
  const [revisionFrequencyEnabled, setRevisionFrequencyEnabled] = useState(false);
  const [revisionFrequencyValueInput, setRevisionFrequencyValueInput] = useState('4');
  const [revisionFrequencyUnit, setRevisionFrequencyUnit] = useState<RevisionFrequencyUnit>('week');
  const [revisionPage, setRevisionPage] = useState(1);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalPin, setPinModalPin] = useState('');
  const [pinModalExpiresAt, setPinModalExpiresAt] = useState('');
  const [isGeneratingPin, setIsGeneratingPin] = useState(false);

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
        setRevisionPage(1);
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

  const hasRevisionFrequency = client
    ? isRevisionFrequencyActive(client.revisionFrequencyValue, client.revisionFrequencyUnit)
    : false;

  const revisionFrequencySummary = client && hasRevisionFrequency
    ? formatRevisionFrequencyLabel(client.revisionFrequencyValue!, client.revisionFrequencyUnit!)
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

  async function handleToggleClientStatus() {
    if (!client || !user?.id || isAthlete || isUpdatingStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    setErrorMessage(null);

    try {
      await clientsService.update(client.id, user.id, {
        estado: client.estado === 'activo' ? 'baja' : 'activo',
      });
      await loadClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cambiar el estado del cliente.';
      setErrorMessage(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleGeneratePin() {
    if (!client || isAthlete) return;

    setIsGeneratingPin(true);
    const result = await athletePinsService.generateClientPin(client.id);
    setIsGeneratingPin(false);

    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }

    setPinModalPin(result.pin);
    setPinModalExpiresAt(result.expiresAt);
    setPinModalVisible(true);
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

  const clientStatusLabel = client.estado === 'activo' ? 'Activo' : 'Baja';
  const clientStatusIcon = client.estado === 'activo' ? 'checkmark-circle' : 'remove-circle';
  const clientStatusColor = client.estado === 'activo' ? Accent.success : Accent.warning;
  const initials = client.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CL';

  const profileMetrics = [
    { label: 'Sexo', value: formatSex(client.sex), icon: 'person-outline' as const },
    { label: 'Edad', value: formatClientAge(client), icon: 'calendar-outline' as const },
    { label: 'Altura', value: client.heightCm ? `${client.heightCm} cm` : '-', icon: 'resize-outline' as const },
    { label: 'Nivel', value: formatAthleteLevelLabel(client.athleteLevel), icon: 'barbell-outline' as const },
  ];
  const revisionPageCount = Math.max(1, Math.ceil(revisions.length / REVISIONS_PER_PAGE));
  const visibleRevisions = revisions.slice((revisionPage - 1) * REVISIONS_PER_PAGE, revisionPage * REVISIONS_PER_PAGE);

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [
            styles.backButton,
            {
              borderColor: theme.backgroundSelected,
              backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Clientes</ThemedText>
        </Pressable>

        {!isAthlete ? (
          <Pressable
            onPress={() => setIsClientMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Más opciones del cliente"
            style={({ pressed }) => [
              styles.menuIconButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#1F3D69" />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroIdentityRow}>
          <View style={styles.avatarWrap}>
            <ThemedText type="headline" style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <View style={styles.heroCopy}>
            <ThemedText type="headline" style={styles.heroTitle}>{client.name}</ThemedText>
          </View>
          <Pressable
            onPress={() => { void handleToggleClientStatus(); }}
            disabled={isAthlete || isUpdatingStatus}
            accessibilityRole="button"
            accessibilityLabel={client.estado === 'activo' ? 'Marcar cliente como baja' : 'Marcar cliente como activo'}
            style={({ pressed }) => [
              styles.statusToggleButton,
              {
                borderColor: client.estado === 'activo' ? '#BBF7D0' : '#FED7AA',
                backgroundColor: client.estado === 'activo' ? '#F0FDF4' : '#FFFBF3',
                opacity: pressed && !isAthlete ? 0.92 : 1,
              },
            ]}>
            <Ionicons name={clientStatusIcon} size={17} color={clientStatusColor} />
            <ThemedText type="smallBold" style={[styles.statusToggleText, { color: clientStatusColor }]}>
              {isUpdatingStatus ? 'Guardando...' : clientStatusLabel}
            </ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setIsProfileDataOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ver datos del cliente"
          style={({ pressed }) => [styles.dataButton, pressed && styles.dataButtonPressed]}>
          <View style={styles.dataButtonIcon}>
            <Ionicons name="person-outline" size={18} color={Accent.primary} />
          </View>
          <View style={styles.dataButtonCopy}>
            <ThemedText type="smallBold" style={styles.dataButtonTitle}>Datos del cliente</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Información general y nivel</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B7E9C" />
        </Pressable>
      </View>

      {paymentStatus.isPending ? (
        <StatusBanner
          tone="warning"
          title="Pendiente de pago"
          message="Este cliente no está al corriente de pago. Revisa su historial antes de continuar."
        />
      ) : null}

      <View style={styles.actionsSection}>
        <View>
          <ThemedText type="headline" style={styles.actionSectionTitle}>Acciones principales</ThemedText>
        </View>

        {!isAthlete ? (
          <Pressable
            onPress={() => router.push(`/revisions/new?clientId=${client.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Registrar nueva revisión"
            style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}>
            <View style={styles.primaryActionIcon}>
              <Ionicons name="add" size={24} color={Accent.primary} />
            </View>
            <View style={styles.primaryActionCopy}>
              <ThemedText type="smallBold" style={styles.primaryActionTitle}>Nueva revisión</ThemedText>
              <ThemedText type="small" style={styles.primaryActionSubtitle}>Registra medidas y evolución</ThemedText>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <View style={styles.secondaryActionsGrid}>
          <Pressable
            onPress={() => router.push(`/clients/${client.id}/photos`)}
            accessibilityRole="button"
            accessibilityLabel="Ver fotos del cliente"
            style={({ pressed }) => [styles.secondaryAction, { borderColor: theme.backgroundSelected }, pressed && styles.actionPressed]}>
            <View style={styles.secondaryActionIcon}><Ionicons name="images-outline" size={21} color={Accent.primary} /></View>
            <ThemedText type="smallBold" style={styles.secondaryActionTitle}>Fotos</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.secondaryActionSubtitle}>Progreso visual</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/clients/${client.id}/metrics`)}
            accessibilityRole="button"
            accessibilityLabel="Abrir análisis del cliente"
            style={({ pressed }) => [styles.secondaryAction, { borderColor: theme.backgroundSelected }, pressed && styles.actionPressed]}>
            <View style={styles.secondaryActionIcon}><Ionicons name="analytics-outline" size={21} color={Accent.primary} /></View>
            <ThemedText type="smallBold" style={styles.secondaryActionTitle}>Análisis</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.secondaryActionSubtitle}>Tendencias y métricas</ThemedText>
          </Pressable>
          {!isAthlete ? (
            <Pressable
              onPress={() => router.push(`/clients/${client.id}/payments`)}
              accessibilityRole="button"
              accessibilityLabel="Abrir pagos del cliente"
              style={({ pressed }) => [styles.secondaryAction, { borderColor: theme.backgroundSelected }, pressed && styles.actionPressed]}>
              <View style={styles.secondaryActionIcon}><Ionicons name="card-outline" size={21} color={Accent.primary} /></View>
              <ThemedText type="smallBold" style={styles.secondaryActionTitle}>Pagos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.secondaryActionSubtitle}>Historial y cobros</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.section, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText type="headline" style={styles.sectionTitle}>Revisiones</ThemedText>
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
                <Ionicons
                  name={revisionStatus.isPending ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={revisionStatus.isPending ? Accent.warning : Accent.success}
                />
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
                accessibilityRole="button"
                accessibilityLabel="Configurar frecuencia de revisiones"
                style={({ pressed }) => [
                  styles.revisionSettingsButton,
                  {
                    borderColor: theme.backgroundSelected,
                    backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}>
                <Ionicons name="settings-outline" size={18} color={Accent.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.revisionsPanel, { borderColor: theme.backgroundSelected }]}>
          {revisions.length === 0 ? (
            <View style={styles.emptyRevisions}>
              <Ionicons name="clipboard-outline" size={22} color="#7B8AA0" />
              <ThemedText type="small" themeColor="textSecondary">Sin revisiones registradas.</ThemedText>
            </View>
          ) : (
            <View>
              {visibleRevisions.map((revision, index) => (
                <RevisionRow
                  key={revision.id}
                  phase={revision.phase}
                  date={new Date(revision.reviewedAt).toLocaleDateString('es-ES')}
                  weight={revision.weightKg ? `${revision.weightKg} kg` : '-'}
                  onPress={() => router.push(`/revisions/${revision.id}`)}
                  last={index === visibleRevisions.length - 1}
                />
              ))}
              {revisionPageCount > 1 ? (
                <View style={styles.revisionPagination}>
                  <Pressable
                    onPress={() => setRevisionPage((page) => Math.max(1, page - 1))}
                    disabled={revisionPage === 1}
                    accessibilityRole="button"
                    accessibilityLabel="Página anterior de revisiones"
                    style={({ pressed }) => [styles.paginationButton, (revisionPage === 1 || pressed) && styles.paginationButtonMuted]}>
                    <Ionicons name="chevron-back" size={18} color={Accent.primary} />
                  </Pressable>
                  <ThemedText type="smallBold" style={styles.paginationLabel}>
                    Página {revisionPage} de {revisionPageCount}
                  </ThemedText>
                  <Pressable
                    onPress={() => setRevisionPage((page) => Math.min(revisionPageCount, page + 1))}
                    disabled={revisionPage === revisionPageCount}
                    accessibilityRole="button"
                    accessibilityLabel="Página siguiente de revisiones"
                    style={({ pressed }) => [styles.paginationButton, (revisionPage === revisionPageCount || pressed) && styles.paginationButtonMuted]}>
                    <Ionicons name="chevron-forward" size={18} color={Accent.primary} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <Modal transparent visible={isProfileDataOpen} animationType="fade" onRequestClose={() => setIsProfileDataOpen(false)}>
        <Pressable style={styles.dataBackdrop} onPress={() => setIsProfileDataOpen(false)}>
          <Pressable style={[styles.dataPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.dataPanelHeader}>
              <View>
                <ThemedText type="headline" style={styles.dataPanelTitle}>Datos del cliente</ThemedText>
              </View>
              <Pressable
                onPress={() => setIsProfileDataOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar datos del cliente"
                style={styles.dataPanelCloseButton}>
                <Ionicons name="close" size={20} color={Accent.primary} />
              </Pressable>
            </View>
            <View style={styles.dataPanelGrid}>
              {profileMetrics.map((item) => (
                <View key={item.label} style={styles.dataPanelItem}>
                  <View style={styles.dataPanelItemIcon}>
                    <Ionicons name={item.icon} size={17} color={Accent.primary} />
                  </View>
                  <View style={styles.dataPanelItemCopy}>
                    <ThemedText type="small" themeColor="textSecondary">{item.label}</ThemedText>
                    <ThemedText type="smallBold" style={styles.dataPanelItemValue}>{item.value}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
            {client.athleteUserId === null ? (
              <AppButton
                label={isGeneratingPin ? 'Generando PIN...' : 'Generar PIN de acceso'}
                variant="surface"
                size="compact"
                loading={isGeneratingPin}
                onPress={() => {
                  setIsClientMenuOpen(false);
                  void handleGeneratePin();
                }}
              />
            ) : (
              <View style={[styles.athleteLinkedBadge, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
                <View style={styles.timerDot} />
                <ThemedText type="small" style={{ color: '#15803D' }}>Atleta vinculado</ThemedText>
              </View>
            )}
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

      <Modal transparent visible={isRevisionSettingsOpen} animationType="fade" onRequestClose={closeRevisionSettings}>
        <ModalBackdrop style={styles.menuBackdrop} onPress={closeRevisionSettings}>
          <Pressable style={[styles.menuPanel, styles.revisionSettingsPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.revisionSettingsHeader}>
              <View style={styles.revisionSettingsCopy}>
                <ThemedText type="smallBold">Frecuencia de revisiones</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Define cada cuánto debe volver este cliente a revisión.
                </ThemedText>
              </View>
              <Pressable onPress={closeRevisionSettings} style={styles.revisionSettingsCloseButton} accessibilityLabel="Cerrar configuración de revisiones">
                <Ionicons name="close" size={18} color={Accent.primary} />
              </Pressable>
            </View>

            <AppInput
              label="Número"
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
        </ModalBackdrop>
      </Modal>

      <AthletePinModal
        visible={pinModalVisible}
        pin={pinModalPin}
        expiresAt={pinModalExpiresAt}
        pinType="existing_client"
        onClose={() => setPinModalVisible(false)}
      />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  screenContent: {
    gap: 14,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
  },
  backButtonText: {
    color: '#10203B',
    lineHeight: 16,
  },
  menuIconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 16,
    shadowColor: '#12336E',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: '#D2E0FA',
  },
  avatarText: {
    color: Accent.primary,
    fontSize: 24,
    lineHeight: 28,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroTitle: {
    color: '#10203B',
    fontSize: 28,
    lineHeight: 34,
  },
  statusToggleButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  statusToggleText: {
    lineHeight: 16,
  },
  dataButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF7',
    paddingHorizontal: 2,
  },
  dataButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FF',
  },
  dataButtonCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dataButtonTitle: {
    color: '#10203B',
    lineHeight: 18,
  },
  dataButtonPressed: {
    opacity: 0.72,
  },
  section: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionTitle: {
    color: '#10203B',
  },
  actionsSection: {
    gap: 12,
  },
  actionSectionTitle: {
    color: '#10203B',
    fontSize: 22,
    lineHeight: 27,
  },
  primaryAction: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: Accent.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionCopy: {
    flex: 1,
    gap: 2,
  },
  primaryActionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
  },
  primaryActionSubtitle: {
    color: '#DCE6FF',
    lineHeight: 17,
  },
  secondaryActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryAction: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 0,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 5,
  },
  secondaryActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  secondaryActionTitle: {
    color: '#10203B',
    lineHeight: 18,
  },
  secondaryActionSubtitle: {
    lineHeight: 17,
  },
  actionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  revisionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  revisionStatusPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  revisionSettingsButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  revisionFrequencyText: {
    lineHeight: 18,
  },
  revisionsPanel: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  revisionPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF7',
    paddingTop: 12,
    marginTop: 4,
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#D4E3FA',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonMuted: {
    opacity: 0.45,
  },
  paginationLabel: {
    color: '#304766',
    minWidth: 108,
    textAlign: 'center',
  },
  emptyRevisions: {
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.three,
  },
  dataBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 32, 59, 0.32)',
    paddingHorizontal: Spacing.three,
  },
  dataPanel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 16,
    shadowColor: '#10203B',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  dataPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dataPanelTitle: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 29,
  },
  dataPanelCloseButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FD',
  },
  dataPanelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dataPanelItem: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#F8FAFD',
    padding: 12,
  },
  dataPanelItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  dataPanelItemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dataPanelItemValue: {
    color: '#10203B',
    lineHeight: 18,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    paddingHorizontal: Spacing.three,
    paddingTop: 96,
  },
  menuPanel: {
    alignSelf: 'flex-end',
    width: 250,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
    shadowColor: '#12336E',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  revisionSettingsPanel: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 14,
    gap: 12,
  },
  revisionSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  revisionSettingsCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  revisionSettingsCloseButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
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
    backgroundColor: '#22C55E',
  },
  athleteLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
});
