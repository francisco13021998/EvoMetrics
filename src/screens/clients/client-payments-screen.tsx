import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { BillingFrequency, Client, ClientPayment } from '@/types/domain';
import { BILLING_FREQUENCY_OPTIONS, calculateClientPaymentStatus, formatBillingFrequencyLabel } from '@/utils/client-payments';

type ClientPaymentsScreenProps = {
  clientId: string;
};

function formatPaymentDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(value: number) {
  return `${value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

function parsePaymentDate(value: string) {
  const [yearString, monthString, dayString] = value.slice(0, 10).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function ClientPaymentsScreen({ clientId }: ClientPaymentsScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isRegisterPaymentModalOpen, setIsRegisterPaymentModalOpen] = useState(false);
  const [isPaymentActionsModalOpen, setIsPaymentActionsModalOpen] = useState(false);
  const [isPaymentEditModalOpen, setIsPaymentEditModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<ClientPayment | null>(null);
  const [coachingPriceInput, setCoachingPriceInput] = useState('');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('one_time');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentDateInput, setPaymentDateInput] = useState<Date | null>(null);

  const loadContent = useCallback(async () => {
    if (!user?.id) {
      setClient(null);
      setPayments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = isAthlete
        ? await clientsService.getByIdForViewer(clientId)
        : await clientsService.getById(clientId, user.id);

      setClient(nextClient);

      if (!nextClient) {
        setPayments([]);
        return;
      }

      setCoachingPriceInput(nextClient.coachingPrice > 0 ? String(nextClient.coachingPrice) : '');
      setBillingFrequency(nextClient.billingFrequency);

      const nextPayments = await clientPaymentsService.listByClient(nextClient.id);
      setPayments(nextPayments);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los pagos.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, isAthlete, user?.id]);

  React.useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const paymentStatus = useMemo(
    () => calculateClientPaymentStatus(client, payments),
    [client, payments]
  );

  const canRegisterPayment = Boolean(client && !isAthlete && user?.id);

  function closePaymentActionsModal() {
    setIsPaymentActionsModalOpen(false);
    setSelectedPayment(null);
  }

  function closeRegisterPaymentModal() {
    setIsRegisterPaymentModalOpen(false);
  }

  function closePaymentEditModal() {
    setIsPaymentEditModalOpen(false);
    setSelectedPayment(null);
  }

  function openPaymentActions(payment: ClientPayment) {
    setSelectedPayment(payment);
    setIsPaymentActionsModalOpen(true);
  }

  function openPaymentEditModal() {
    if (!selectedPayment) {
      return;
    }

    setPaymentAmountInput(String(selectedPayment.amount));
    setPaymentDateInput(parsePaymentDate(selectedPayment.paymentDate));
    setIsPaymentActionsModalOpen(false);
    setIsPaymentEditModalOpen(true);
  }

  function openRegisterPaymentModal() {
    if (!client || isAthlete) {
      return;
    }

    setPaymentAmountInput(String(client.coachingPrice));
    setPaymentDateInput(paymentStatus.nextPaymentDate ?? new Date());
    setIsRegisterPaymentModalOpen(true);
  }

  async function confirmDeletePayment(payment: ClientPayment) {
    if (isDeletingPayment) {
      return;
    }

    setIsDeletingPayment(true);
    setErrorMessage(null);

    try {
      await clientPaymentsService.remove(payment.id);
      setSelectedPayment(null);
      await loadContent();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el pago.';
      setErrorMessage(message);
    } finally {
      setIsDeletingPayment(false);
    }
  }

  function handleDeletePayment() {
    const currentPayment = selectedPayment;

    if (!currentPayment) {
      return;
    }

    setIsPaymentActionsModalOpen(false);

    Alert.alert(
      'Eliminar pago',
      `Se eliminara el pago de ${formatAmount(currentPayment.amount)} del ${formatPaymentDate(currentPayment.paymentDate)}. Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void confirmDeletePayment(currentPayment); } },
      ]
    );
  }

  async function handleSavePaymentEdit() {
    if (!selectedPayment || !paymentDateInput || isSavingPayment) {
      return;
    }

    const parsedAmount = paymentAmountInput.trim() ? Number(paymentAmountInput.replace(',', '.')) : NaN;

    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setErrorMessage('El importe debe ser un valor valido.');
      return;
    }

    setIsSavingPayment(true);
    setErrorMessage(null);

    try {
      await clientPaymentsService.update(selectedPayment.id, {
        amount: parsedAmount,
        paymentDate: paymentDateInput.toISOString(),
      });
      closePaymentEditModal();
      await loadContent();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el pago.';
      setErrorMessage(message);
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleSaveConfiguration() {
    if (!user?.id || !client || isAthlete || isSavingConfig) {
      return;
    }

    const parsedCoachingPrice = coachingPriceInput.trim() ? Number(coachingPriceInput.replace(',', '.')) : 0;

    if (Number.isNaN(parsedCoachingPrice) || parsedCoachingPrice < 0) {
      setErrorMessage('El precio debe ser un valor valido.');
      return;
    }

    setIsSavingConfig(true);
    setErrorMessage(null);

    try {
      await clientsService.update(client.id, user.id, {
        coachingPrice: parsedCoachingPrice,
        billingFrequency,
      });
      await loadContent();
      setIsConfigModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la configuración de pagos.';
      setErrorMessage(message);
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleRegisterPayment() {
    if (!user?.id || !client || !paymentDateInput || isRegisteringPayment) {
      return;
    }

    const parsedAmount = paymentAmountInput.trim() ? Number(paymentAmountInput.replace(',', '.')) : NaN;

    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setErrorMessage('El importe debe ser un valor valido.');
      return;
    }

    setIsRegisteringPayment(true);
    setErrorMessage(null);

    try {
      await clientPaymentsService.create({
        clientId: client.id,
        amount: parsedAmount,
        paymentDate: paymentDateInput.toISOString(),
      });
      closeRegisterPaymentModal();
      void loadContent();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el pago.';
      setErrorMessage(message);
    } finally {
      setIsRegisteringPayment(false);
    }
  }

  if (isLoading && !client) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando pagos..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Sincronizando datos de pagos." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (errorMessage && !client) {
    return (
      <ScreenContainer>
        <PageHeader title="Error" />
        <PageSection first>
          <StatusBanner tone="danger" message={errorMessage} />
          <AppButton label="Reintentar" onPress={() => void loadContent()} variant="secondary" />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <PageHeader title="Pagos" />
        <PageSection first>
          <StatusBanner tone="warning" message="No se encontró el cliente seleccionado." />
        </PageSection>
      </ScreenContainer>
    );
  }

  const lastPayment = payments[0] ?? null;

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al cliente"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Cliente</ThemedText>
        </Pressable>
        {!isAthlete ? (
          <Pressable
            onPress={() => setIsConfigModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Configurar cobro"
            style={({ pressed }) => [styles.configButton, pressed && styles.pressed]}>
            <Ionicons name="settings-outline" size={20} color={Accent.primary} />
          </Pressable>
        ) : null}
      </View>

      {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

      <View style={[styles.billingHero, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.billingHeroHeader}>
          <View style={styles.clientAvatar}>
            <ThemedText type="smallBold" style={styles.clientAvatarText}>
              {client.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CL'}
            </ThemedText>
          </View>
          <View style={styles.billingHeroCopy}>
            <ThemedText type="label" style={styles.billingEyebrow}>Facturación</ThemedText>
            <ThemedText
              type="headline"
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.clientName}>
              {client.name}
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: paymentStatus.isPending ? '#FFF1D9' : '#E4F8EC' }]}>
            <View style={[styles.statusDot, { backgroundColor: paymentStatus.isPending ? Accent.warning : Accent.success }]} />
            <ThemedText type="smallBold" style={{ color: paymentStatus.isPending ? '#A65D00' : '#16803D' }}>{paymentStatus.label}</ThemedText>
          </View>
        </View>

        <View style={styles.amountSummary}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">Cuota</ThemedText>
            <ThemedText type="headline" style={styles.amountValue}>{formatAmount(client.coachingPrice)}</ThemedText>
          </View>
          <View style={styles.frequencyPill}>
            <Ionicons name="repeat-outline" size={15} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.frequencyPillText}>{formatBillingFrequencyLabel(client.billingFrequency)}</ThemedText>
          </View>
        </View>

        <View style={styles.nextPaymentRow}>
          <View style={styles.nextPaymentIcon}><Ionicons name="calendar-outline" size={20} color={Accent.primary} /></View>
          <View style={styles.nextPaymentCopy}>
            <ThemedText type="small" themeColor="textSecondary">Próximo cobro</ThemedText>
            <ThemedText type="smallBold" style={styles.nextPaymentValue}>
              {paymentStatus.nextPaymentDate ? formatPaymentDate(paymentStatus.nextPaymentDate.toISOString()) : 'Sin fecha programada'}
            </ThemedText>
          </View>
          {lastPayment ? <ThemedText type="small" themeColor="textSecondary">Último: {formatPaymentDate(lastPayment.paymentDate)}</ThemedText> : null}
        </View>

        {!isAthlete ? (
          <AppButton
            label="Registrar pago"
            onPress={openRegisterPaymentModal}
            disabled={!canRegisterPayment}
            loading={isRegisteringPayment}
            leadingIcon={<Ionicons name="add" size={18} color="#FFFFFF" />}
          />
        ) : null}
      </View>

      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <View>
            <ThemedText type="label" style={styles.sectionEyebrow}>Movimientos</ThemedText>
            <ThemedText type="headline" style={styles.historyTitle}>Historial de pagos</ThemedText>
          </View>
          <View style={styles.historyCount}><ThemedText type="smallBold" style={styles.historyCountText}>{payments.length}</ThemedText></View>
        </View>

        <View style={[styles.historyCard, { borderColor: theme.backgroundSelected }]}>
          {payments.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="receipt-outline" size={24} color="#7B8AA0" />
              <ThemedText type="small" themeColor="textSecondary">Todavía no hay pagos registrados.</ThemedText>
            </View>
          ) : (
            payments.map((payment, index) => (
              <View key={payment.id} style={[styles.paymentRow, { borderColor: theme.backgroundSelected }, index === payments.length - 1 && styles.paymentRowLast]}>
                <View style={styles.paymentRowIcon}><Ionicons name="card-outline" size={19} color={Accent.primary} /></View>
                <View style={styles.paymentRowInfo}>
                  <ThemedText type="smallBold" style={styles.paymentAmount}>{formatAmount(payment.amount)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatPaymentDate(payment.paymentDate)}</ThemedText>
                </View>
                {!isAthlete ? (
                  <Pressable
                    onPress={() => openPaymentActions(payment)}
                    accessibilityRole="button"
                    accessibilityLabel={`Opciones del pago de ${formatAmount(payment.amount)}`}
                    style={({ pressed }) => [styles.paymentOptionsButton, pressed && styles.pressed]}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={Accent.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>

      <Modal transparent visible={isPaymentActionsModalOpen} animationType="fade" onRequestClose={closePaymentActionsModal}>
        <Pressable style={styles.modalBackdrop} onPress={closePaymentActionsModal}>
          <Pressable style={[styles.configModalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.configModalHeader}>
              <View>
                <ThemedText type="smallBold">Opciones del pago</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Selecciona una acción para este registro.
                </ThemedText>
              </View>
              <Pressable onPress={closePaymentActionsModal} style={styles.configModalCloseButton}>
                <ThemedText type="smallBold" style={styles.configModalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            {selectedPayment ? (
              <View style={styles.paymentActionsSummary}>
                <ThemedText type="smallBold">{formatAmount(selectedPayment.amount)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Registrado el {formatPaymentDate(selectedPayment.createdAt)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Fecha de pago: {formatPaymentDate(selectedPayment.paymentDate)}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.paymentActionsButtons}>
              <AppButton
                label="Editar pago"
                variant="surface"
                size="compact"
                onPress={() => openPaymentEditModal()}
                disabled={!selectedPayment}
              />
              <AppButton
                label="Eliminar pago"
                variant="danger"
                size="compact"
                onPress={() => handleDeletePayment()}
                disabled={!selectedPayment || isDeletingPayment}
                loading={isDeletingPayment}
              />
            </View>

            <AppButton label="Cerrar" variant="ghost" size="compact" fullWidth={false} onPress={closePaymentActionsModal} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isRegisterPaymentModalOpen} animationType="fade" onRequestClose={closeRegisterPaymentModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeRegisterPaymentModal}>
          <Pressable style={[styles.configModalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.configModalHeader}>
              <View>
                <ThemedText type="smallBold">Registrar pago</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Registra el pago con la fecha de pago habitual. La fecha de registro se guarda sola.
                </ThemedText>
              </View>
              <Pressable onPress={closeRegisterPaymentModal} style={styles.configModalCloseButton}>
                <ThemedText type="smallBold" style={styles.configModalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

            <AppInput
              label="Importe"
              placeholder="0"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              unit="€"
              containerStyle={styles.configField}
            />
            <AppDateTimeInput
              label="Fecha de pago"
              value={paymentDateInput}
              mode="date"
              allowYearSelection
              minYear={1940}
              onChange={setPaymentDateInput}
              shellStyle={styles.configField}
            />

            <View style={styles.configModalActions}>
              <AppButton
                label="Cancelar"
                variant="ghost"
                size="compact"
                fullWidth={false}
                onPress={closeRegisterPaymentModal}
                disabled={isRegisteringPayment}
              />
              <AppButton
                label="Guardar pago"
                onPress={() => void handleRegisterPayment()}
                loading={isRegisteringPayment}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isPaymentEditModalOpen} animationType="fade" onRequestClose={closePaymentEditModal}>
        <Pressable style={styles.modalBackdrop} onPress={closePaymentEditModal}>
          <Pressable style={[styles.configModalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.configModalHeader}>
              <View>
                <ThemedText type="smallBold">Editar pago</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Cambia el importe o la fecha de pago.
                </ThemedText>
              </View>
              <Pressable onPress={closePaymentEditModal} style={styles.configModalCloseButton}>
                <ThemedText type="smallBold" style={styles.configModalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

            <AppInput
              label="Importe"
              placeholder="0"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={paymentAmountInput}
              onChangeText={setPaymentAmountInput}
              unit="€"
              containerStyle={styles.configField}
            />
            <AppDateTimeInput
              label="Fecha de pago"
              value={paymentDateInput}
              mode="date"
              allowYearSelection
              minYear={1940}
              onChange={setPaymentDateInput}
              shellStyle={styles.configField}
            />

            <View style={styles.configModalActions}>
              <AppButton
                label="Cancelar"
                variant="ghost"
                size="compact"
                fullWidth={false}
                onPress={closePaymentEditModal}
                disabled={isSavingPayment}
              />
              <AppButton
                label="Guardar cambios"
                onPress={() => void handleSavePaymentEdit()}
                loading={isSavingPayment}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isConfigModalOpen} animationType="fade" onRequestClose={() => setIsConfigModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsConfigModalOpen(false)}>
          <Pressable style={[styles.configModalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.configModalHeader}>
              <View>
                <ThemedText type="smallBold">Configuración de cobro</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Edita la cuota y la frecuencia del cliente.
                </ThemedText>
              </View>
              <Pressable onPress={() => setIsConfigModalOpen(false)} style={styles.configModalCloseButton}>
                <ThemedText type="smallBold" style={styles.configModalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            <AppInput
              label="Precio de coaching"
              placeholder="0"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={coachingPriceInput}
              onChangeText={setCoachingPriceInput}
              unit="€"
              containerStyle={styles.configField}
            />
            <AppSelect
              label="Frecuencia de cobro"
              value={billingFrequency}
              options={BILLING_FREQUENCY_OPTIONS}
              onChange={(value) => setBillingFrequency(value as BillingFrequency)}
              containerStyle={styles.configField}
            />

            <View style={styles.configModalActions}>
              <AppButton
                label="Cancelar"
                variant="ghost"
                size="compact"
                fullWidth={false}
                onPress={() => setIsConfigModalOpen(false)}
              />
              <AppButton
                label="Guardar configuración"
                onPress={() => void handleSaveConfiguration()}
                loading={isSavingConfig}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
  },
  backButtonText: {
    color: '#10203B',
  },
  configButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  billingHero: {
    borderWidth: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 16,
    ...Shadows.card,
  },
  billingHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 20,
  },
  billingHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  billingEyebrow: {
    color: Accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientName: {
    color: '#10203B',
    fontSize: 22,
    lineHeight: 27,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  amountSummary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF7',
  },
  amountValue: {
    color: '#10203B',
    fontSize: 29,
    lineHeight: 35,
  },
  frequencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#EEF5FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  frequencyPillText: {
    color: Accent.primary,
  },
  nextPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#F7FAFF',
    padding: 12,
  },
  nextPaymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPaymentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nextPaymentValue: {
    color: '#10203B',
    lineHeight: 18,
  },
  historySection: {
    gap: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    color: Accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyTitle: {
    color: '#10203B',
    fontSize: 22,
    lineHeight: 27,
  },
  historyCount: {
    minWidth: 30,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCountText: {
    color: Accent.primary,
  },
  configField: {
    minHeight: 56,
    borderRadius: Radius.medium,
  },
  configModalPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginHorizontal: Spacing.three,
  },
  configModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  configModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  configModalCloseText: {
    color: Accent.primary,
    lineHeight: 20,
  },
  configModalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  emptyHistory: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.three,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  paymentRowLast: {
    borderBottomWidth: 0,
  },
  paymentRowInfo: {
    flex: 1,
    gap: 2,
  },
  paymentRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentAmount: {
    color: '#10203B',
    lineHeight: 19,
  },
  paymentOptionsButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: '#F4F8FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentActionsSummary: {
    gap: 2,
  },
  paymentActionsButtons: {
    gap: Spacing.two,
  },
});
