import { supabase } from '@/lib/supabase';
import { ClientPayment } from '@/types/domain';

export const CLIENT_PAYMENTS_TABLE = 'client_payments';

type DbClientPaymentRow = {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  due_date?: string | null;
  created_at: string;
};

export type CreateClientPaymentInput = {
  clientId: string;
  amount: number;
  paymentDate: string;
  dueDate?: string;
};

export type UpdateClientPaymentInput = {
  amount?: number;
  paymentDate?: string;
  dueDate?: string;
};

function toDateOnlyIso(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)).toISOString();
}

function mapDbClientPayment(row: DbClientPaymentRow): ClientPayment {
  return {
    id: row.id,
    clientId: row.client_id,
    amount: row.amount,
    paymentDate: row.payment_date,
    dueDate: row.due_date ?? row.payment_date,
    createdAt: row.created_at,
  };
}

export const clientPaymentsService = {
  async listByClient(clientId: string) {
    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbClientPaymentRow[] | null)?.map(mapDbClientPayment) ?? [];
  },

  async create(payload: CreateClientPaymentInput) {
    const dueDateValue = payload.dueDate ?? payload.paymentDate;

    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .insert({
        client_id: payload.clientId,
        amount: payload.amount,
        payment_date: toDateOnlyIso(payload.paymentDate),
        due_date: toDateOnlyIso(dueDateValue),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbClientPayment(data as DbClientPaymentRow);
  },

  async update(paymentId: string, payload: UpdateClientPaymentInput) {
    const updatePayload: Record<string, unknown> = {};
    let nextPaymentDate: string | undefined;

    if (payload.amount !== undefined) {
      updatePayload.amount = payload.amount;
    }

    if (payload.paymentDate !== undefined) {
      nextPaymentDate = toDateOnlyIso(payload.paymentDate);
      updatePayload.payment_date = nextPaymentDate;
    }

    if (payload.dueDate !== undefined) {
      updatePayload.due_date = toDateOnlyIso(payload.dueDate);
    } else if (nextPaymentDate) {
      updatePayload.due_date = nextPaymentDate;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error('No se proporcionaron cambios para actualizar el pago.');
    }

    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .update(updatePayload)
      .eq('id', paymentId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbClientPayment(data as DbClientPaymentRow);
  },

  async remove(paymentId: string) {
    const { error } = await supabase.from(CLIENT_PAYMENTS_TABLE).delete().eq('id', paymentId);

    if (error) {
      throw new Error(error.message);
    }
  },
};