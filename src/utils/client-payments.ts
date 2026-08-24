import { BillingFrequency, Client, ClientPayment } from '@/types/domain';
import { addMonths, startOfDay, toLocalDate } from '@/utils/date-only';

export const BILLING_FREQUENCY_OPTIONS: { label: string; value: BillingFrequency }[] = [
  { label: 'Pago único', value: 'one_time' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quincenal', value: 'biweekly' },
  { label: 'Mensual', value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' },
  { label: 'Anual', value: 'yearly' },
];

export function formatBillingFrequencyLabel(value: BillingFrequency) {
  return BILLING_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label ?? 'Pago único';
}

function getMonthlyMultiplier(billingFrequency: BillingFrequency) {
  if (billingFrequency === 'weekly') {
    return 52 / 12;
  }

  if (billingFrequency === 'biweekly') {
    // Decisión: "Quincenal" = 2 pagos al mes (la próxima fecha de pago suma 15 días).
    return 24 / 12;
  }

  if (billingFrequency === 'monthly') {
    return 1;
  }

  if (billingFrequency === 'quarterly') {
    return 1 / 3;
  }

  if (billingFrequency === 'yearly') {
    return 1 / 12;
  }

  return 0;
}

export function calculateMonthlyRevenueFromClients(clients: Pick<Client, 'coachingPrice' | 'billingFrequency'>[] | null | undefined) {
  return (clients ?? []).reduce((total, client) => total + client.coachingPrice * getMonthlyMultiplier(client.billingFrequency), 0);
}

export function calculateNextPaymentDate(referenceDate: Date, billingFrequency: BillingFrequency) {
  const baseDate = startOfDay(referenceDate);

  if (billingFrequency === 'one_time') {
    return null;
  }

  if (billingFrequency === 'weekly') {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 7, 0, 0, 0, 0);
  }

  if (billingFrequency === 'biweekly') {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 15, 0, 0, 0, 0);
  }

  if (billingFrequency === 'monthly') {
    return addMonths(baseDate, 1);
  }

  if (billingFrequency === 'quarterly') {
    return addMonths(baseDate, 3);
  }

  return addMonths(baseDate, 12);
}

export type ClientPaymentStatus = {
  label: 'Al corriente' | 'Pendiente de pago';
  isPending: boolean;
  lastPaymentDate: Date | null;
  nextPaymentDate: Date | null;
  referenceDate: Date;
};

// El pago de referencia es el de dueDate (o paymentDate) más reciente, no payments[0]:
// el servicio ordena por created_at y un pago antiguo registrado tarde ocuparía el primer puesto.
function findLatestPayment(payments: ClientPayment[] | null | undefined) {
  let latestPayment: ClientPayment | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const payment of payments ?? []) {
    const paymentTime = (toLocalDate(payment.dueDate) ?? toLocalDate(payment.paymentDate))?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (paymentTime > latestTime) {
      latestTime = paymentTime;
      latestPayment = payment;
    }
  }

  return latestPayment;
}

export function calculateClientPaymentStatus(
  client: Pick<Client, 'createdAt' | 'billingFrequency' | 'forcePaymentPending'> | null | undefined,
  payments: ClientPayment[] | null | undefined,
  referenceDate = new Date()
): ClientPaymentStatus {
  const normalizedReference = startOfDay(referenceDate);
  const latestPayment = findLatestPayment(payments);
  const latestPaymentDate = toLocalDate(latestPayment?.paymentDate ?? null);
  const latestDueDate = toLocalDate(latestPayment?.dueDate ?? null);
  const fallbackStartDate = toLocalDate(client?.createdAt ?? null) ?? normalizedReference;
  const startDate = latestDueDate ?? latestPaymentDate ?? fallbackStartDate;
  const nextPaymentDate = client?.billingFrequency ? calculateNextPaymentDate(startDate, client.billingFrequency) : null;
  const isPending = Boolean(client?.forcePaymentPending) || (nextPaymentDate !== null ? normalizedReference >= nextPaymentDate : false);

  return {
    label: isPending ? 'Pendiente de pago' : 'Al corriente',
    isPending,
    lastPaymentDate: latestPaymentDate,
    nextPaymentDate,
    referenceDate: normalizedReference,
  };
}
