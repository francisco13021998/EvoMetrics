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
import { BILLING_FREQUENCY_OPTIONS, calculateClientPaymentStatus, calculateNextPaymentDate, formatBillingFrequencyLabel } from '@/utils/client-payments';

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

  const canRegisterPayment = Boolean(client && !isAthlete && paymentStatus.isPending && user?.id);

  function closePaymentActionsModal() {
    setIsPaymentActionsModalOpen(false);
    setSelectedPayment(null);
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
    if (!user?.id || !client || !canRegisterPayment || isRegisteringPayment) {
      return;
    }

    const paymentDateReference = lastPayment ? parsePaymentDate(lastPayment.paymentDate) : new Date();
    const nextPaymentDate = calculateNextPaymentDate(paymentDateReference, client.billingFrequency);

    if (!nextPaymentDate) {
      setErrorMessage('No se pudo calcular la fecha del siguiente pago.');
      return;
    }

    setIsRegisteringPayment(true);
    setErrorMessage(null);

    try {
      await clientPaymentsService.create({
        ownerId: user.id,
        clientId: client.id,
        amount: client.coachingPrice,
        paymentDate: nextPaymentDate.toISOString(),
      });
      await loadContent();
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
      <PageHeader
        eyebrow="Pagos"
        title={client.name}
        subtitle="Control de cobros y configuración de la cuota"
        rightSlot={
          <AppButton
            variant="surface"
            size="compact"
            fullWidth={false}
            onPress={() => router.back()}
            leadingIcon={<ThemedText type="smallBold" style={styles.backIcon}>←</ThemedText>}
            accessibilityLabel="Volver"
          />
        }
      />

      <PageSection first style={styles.sectionSpacing}>
        <View style={[styles.statusCard, { borderColor: theme.backgroundSelected, backgroundColor: paymentStatus.isPending ? '#FFF7E8' : '#ECF9F3' }]}>
          <View style={styles.statusTopRow}>
            <View>
              <ThemedText type="label" style={styles.statusEyebrow}>Estado</ThemedText>
              <ThemedText type="headline" style={styles.statusTitle}>{paymentStatus.label}</ThemedText>
            </View>
            {!isAthlete ? (
              <AppButton
                variant="surface"
                size="compact"
                fullWidth={false}
                onPress={() => setIsConfigModalOpen(true)}
                accessibilityLabel="Configurar cobro"
                leadingIcon={<ThemedText type="smallBold" style={styles.settingsIcon}>⚙</ThemedText>}
              />
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: paymentStatus.isPending ? Accent.warning : Accent.success }]}>
                <ThemedText type="smallBold" style={styles.statusBadgeText}>{paymentStatus.label}</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.statusMetaGrid}>
            <View style={[styles.metaItem, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Último pago</ThemedText>
              <ThemedText type="smallBold" style={styles.metaValue}>
                {lastPayment ? formatPaymentDate(lastPayment.paymentDate) : 'Sin pagos'}
              </ThemedText>
            </View>
            <View style={[styles.metaItem, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Siguiente pago</ThemedText>
              <ThemedText type="smallBold" style={styles.metaValue}>
                {paymentStatus.nextPaymentDate ? formatPaymentDate(paymentStatus.nextPaymentDate.toISOString()) : 'No aplica'}
              </ThemedText>
            </View>
            <View style={[styles.metaItem, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Precio</ThemedText>
              <ThemedText type="smallBold" style={styles.metaValue}>{formatAmount(client.coachingPrice)}</ThemedText>
            </View>
            <View style={[styles.metaItem, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Frecuencia</ThemedText>
              <ThemedText type="smallBold" style={styles.metaValue}>{formatBillingFrequencyLabel(client.billingFrequency)}</ThemedText>
            </View>
          </View>

          {!isAthlete ? (
            <View style={styles.statusActions}>
              <AppButton
                label="Pago realizado"
                onPress={() => void handleRegisterPayment()}
                disabled={!canRegisterPayment}
                loading={isRegisteringPayment}
              />
              {paymentStatus.isPending ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.statusHint}>
                  Se registrará un pago por {formatAmount(client.coachingPrice)} con fecha de hoy.
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>
      </PageSection>

      <PageSection title="Historial de pagos" style={styles.sectionSpacing}>
        <View style={[styles.historyCard, { borderColor: theme.backgroundSelected }]}>
          {payments.length === 0 ? (
            <View style={styles.emptyHistory}>
              <ThemedText type="small" themeColor="textSecondary">
                Todavía no hay pagos registrados.
              </ThemedText>
            </View>
          ) : (
            payments.map((payment, index) => (
              <View
                key={payment.id}
                style={[
                  styles.paymentRow,
                  { borderColor: theme.backgroundSelected },
                  index === payments.length - 1 && styles.paymentRowLast,
                ]}>
                <View style={styles.paymentRowInfo}>
                  <ThemedText type="smallBold">{formatAmount(payment.amount)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatPaymentDate(payment.paymentDate)}</ThemedText>
                </View>
                <View style={styles.paymentRowActions}>
                  <View style={styles.paymentDatePill}>
                    <ThemedText type="small" style={styles.paymentDatePillText}>
                      {payment.paymentDate}
                    </ThemedText>
                  </View>
                  {!isAthlete ? (
                    <AppButton
                      label="Opciones"
                      variant="surface"
                      size="compact"
                      fullWidth={false}
                      onPress={() => openPaymentActions(payment)}
                    />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </PageSection>

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
                  {formatPaymentDate(selectedPayment.paymentDate)}
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

      <Modal transparent visible={isPaymentEditModalOpen} animationType="fade" onRequestClose={closePaymentEditModal}>
        <Pressable style={styles.modalBackdrop} onPress={closePaymentEditModal}>
          <Pressable style={[styles.configModalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.configModalHeader}>
              <View>
                <ThemedText type="smallBold">Editar pago</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Cambia el importe o la fecha del registro.
                </ThemedText>
              </View>
              <Pressable onPress={closePaymentEditModal} style={styles.configModalCloseButton}>
                <ThemedText type="smallBold" style={styles.configModalCloseText}>×</ThemedText>
              </Pressable>
            </View>

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
              label="Fecha del pago"
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
    gap: 8,
  },
  backIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionSpacing: {
    gap: Spacing.two,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
    ...Shadows.soft,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusEyebrow: {
    color: Accent.primary,
  },
  statusTitle: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 30,
  },
  statusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
  },
  settingsIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
  statusMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  metaItem: {
    width: '49%',
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: 4,
  },
  metaValue: {
    color: '#10203B',
  },
  statusActions: {
    gap: Spacing.one,
  },
  statusHint: {
    lineHeight: 18,
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
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  emptyHistory: {
    padding: Spacing.three,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  paymentRowLast: {
    borderBottomWidth: 0,
  },
  paymentRowInfo: {
    flex: 1,
    gap: 2,
  },
  paymentRowActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  paymentDatePill: {
    borderRadius: Radius.pill,
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  paymentDatePillText: {
    color: Accent.primary,
  },
  paymentActionsSummary: {
    gap: 2,
  },
  paymentActionsButtons: {
    gap: Spacing.two,
  },
});