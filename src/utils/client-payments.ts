import { BillingFrequency, Client, ClientPayment } from '@/types/domain';

export const BILLING_FREQUENCY_OPTIONS: { label: string; value: BillingFrequency }[] = [
  { label: 'Pago único', value: 'one_time' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quincenal', value: 'biweekly' },
  { label: 'Mensual', value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' },
  { label: 'Anual', value: 'yearly' },
];

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, maxDay));

  return startOfDay(result);
}

export function formatBillingFrequencyLabel(value: BillingFrequency) {
  return BILLING_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label ?? 'Pago único';
}

function getMonthlyMultiplier(billingFrequency: BillingFrequency) {
  if (billingFrequency === 'weekly') {
    return 52 / 12;
  }

  if (billingFrequency === 'biweekly') {
    return 26 / 12;
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

function toLocalDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

export type ClientPaymentStatus = {
  label: 'Al corriente' | 'Pendiente de pago';
  isPending: boolean;
  lastPaymentDate: Date | null;
  nextPaymentDate: Date | null;
  referenceDate: Date;
};

export function calculateClientPaymentStatus(
  client: Pick<Client, 'createdAt' | 'billingFrequency' | 'forcePaymentPending'> | null | undefined,
  payments: ClientPayment[] | null | undefined,
  referenceDate = new Date()
): ClientPaymentStatus {
  const normalizedReference = startOfDay(referenceDate);
  const latestPayment = payments?.[0] ?? null;
  const latestPaymentDate = toLocalDate(latestPayment?.paymentDate ?? null);
  const fallbackStartDate = toLocalDate(client?.createdAt ?? null) ?? normalizedReference;
  const startDate = latestPaymentDate ?? fallbackStartDate;
  const nextPaymentDate = client?.billingFrequency ? calculateNextPaymentDate(startDate, client.billingFrequency) : null;
  const isPending = Boolean(client?.forcePaymentPending) || (nextPaymentDate !== null ? normalizedReference > nextPaymentDate : false);

  return {
    label: isPending ? 'Pendiente de pago' : 'Al corriente',
    isPending,
    lastPaymentDate: latestPaymentDate,
    nextPaymentDate,
    referenceDate: normalizedReference,
  };
}