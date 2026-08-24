import { ClientPayment } from '@/types/domain';
import {
  calculateClientPaymentStatus,
  calculateMonthlyRevenueFromClients,
  calculateNextPaymentDate,
} from '@/utils/client-payments';
import { formatDateOnly } from '@/utils/date-only';

function makePayment(overrides: Partial<ClientPayment>): ClientPayment {
  return {
    id: 'pago-1',
    clientId: 'cliente-1',
    amount: 100,
    paymentDate: '2026-08-01',
    dueDate: '2026-08-01',
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

describe('ingreso mensual normalizado', () => {
  it('quincenal = 2 pagos al mes (24/12)', () => {
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 100, billingFrequency: 'biweekly' }])).toBeCloseTo(200, 2);
  });

  it('resto de frecuencias', () => {
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 100, billingFrequency: 'weekly' }])).toBeCloseTo(433.33, 1);
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 100, billingFrequency: 'monthly' }])).toBe(100);
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 300, billingFrequency: 'quarterly' }])).toBe(100);
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 1200, billingFrequency: 'yearly' }])).toBe(100);
    expect(calculateMonthlyRevenueFromClients([{ coachingPrice: 100, billingFrequency: 'one_time' }])).toBe(0);
  });
});

describe('próxima fecha de pago', () => {
  it('mensual desde el 31 de enero recorta a fin de febrero', () => {
    expect(formatDateOnly(calculateNextPaymentDate(new Date(2026, 0, 31), 'monthly')!)).toBe('2026-02-28');
  });

  it('quincenal suma 15 días', () => {
    expect(formatDateOnly(calculateNextPaymentDate(new Date(2026, 7, 1), 'biweekly')!)).toBe('2026-08-16');
  });

  it('pago único no tiene próxima fecha', () => {
    expect(calculateNextPaymentDate(new Date(2026, 7, 1), 'one_time')).toBeNull();
  });
});

describe('estado de pago del cliente', () => {
  const client = {
    createdAt: '2026-01-01T00:00:00Z',
    billingFrequency: 'monthly' as const,
    forcePaymentPending: false,
  };

  it('usa el pago con dueDate más reciente aunque no sea el primero del array (pagos registrados tarde)', () => {
    // El array simula el orden por created_at: el pago antiguo registrado tarde va primero.
    const payments = [
      makePayment({ id: 'antiguo', paymentDate: '2026-05-10', dueDate: '2026-05-10', createdAt: '2026-08-15T10:00:00Z' }),
      makePayment({ id: 'reciente', paymentDate: '2026-08-10', dueDate: '2026-08-10', createdAt: '2026-08-10T10:00:00Z' }),
    ];

    const status = calculateClientPaymentStatus(client, payments, new Date(2026, 7, 20));

    expect(formatDateOnly(status.nextPaymentDate!)).toBe('2026-09-10');
    expect(status.isPending).toBe(false);
  });

  it('pendiente cuando hoy alcanza el vencimiento', () => {
    const payments = [makePayment({ paymentDate: '2026-06-10', dueDate: '2026-06-10' })];
    const status = calculateClientPaymentStatus(client, payments, new Date(2026, 7, 20));

    expect(formatDateOnly(status.nextPaymentDate!)).toBe('2026-07-10');
    expect(status.isPending).toBe(true);
  });

  it('pago adelantado: dueDate futura manda sobre paymentDate', () => {
    const payments = [makePayment({ paymentDate: '2026-08-01', dueDate: '2026-09-01' })];
    const status = calculateClientPaymentStatus(client, payments, new Date(2026, 7, 20));

    expect(formatDateOnly(status.nextPaymentDate!)).toBe('2026-10-01');
    expect(status.isPending).toBe(false);
  });

  it('forcePaymentPending fuerza el estado pendiente', () => {
    const payments = [makePayment({ paymentDate: '2026-08-10', dueDate: '2026-08-10' })];
    const status = calculateClientPaymentStatus({ ...client, forcePaymentPending: true }, payments, new Date(2026, 7, 20));

    expect(status.isPending).toBe(true);
  });

  it('sin pagos usa createdAt del cliente como referencia', () => {
    const status = calculateClientPaymentStatus(client, [], new Date(2026, 7, 20));

    expect(formatDateOnly(status.nextPaymentDate!)).toBe('2026-02-01');
    expect(status.isPending).toBe(true);
  });
});
