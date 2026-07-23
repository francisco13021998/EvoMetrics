import { supabase } from '@/lib/supabase';
import { ClientPayment } from '@/types/domain';

export const CLIENT_PAYMENTS_TABLE = 'client_payments';

type DbClientPaymentRow = {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  created_at: string;
};

export type CreateClientPaymentInput = {
  clientId: string;
  amount: number;
  paymentDate: string;
};

export type UpdateClientPaymentInput = {
  amount?: number;
  paymentDate?: string;
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
    createdAt: row.created_at,
  };
}

export const clientPaymentsService = {
  async listByClient(clientId: string) {
    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbClientPaymentRow[] | null)?.map(mapDbClientPayment) ?? [];
  },

  async create(payload: CreateClientPaymentInput) {
    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .insert({
        client_id: payload.clientId,
        amount: payload.amount,
        payment_date: toDateOnlyIso(payload.paymentDate),
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

    if (payload.amount !== undefined) {
      updatePayload.amount = payload.amount;
    }

    if (payload.paymentDate !== undefined) {
      updatePayload.payment_date = toDateOnlyIso(payload.paymentDate);
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