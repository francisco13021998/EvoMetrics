import { supabase } from '@/lib/supabase';
import { ClientPayment } from '@/types/domain';
import { toDateOnlyString } from '@/utils/date-only';

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
  ownerId: string;
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
  const dateOnly = toDateOnlyString(value);

  if (!dateOnly) {
    throw new Error('Fecha de pago no válida.');
  }

  return dateOnly;
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
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbClientPaymentRow[] | null)?.map(mapDbClientPayment) ?? [];
  },

  async listByClients(clientIds: string[]) {
    const paymentsByClientId: Record<string, ClientPayment[]> = {};

    for (const clientId of clientIds) {
      paymentsByClientId[clientId] = [];
    }

    if (clientIds.length === 0) {
      return paymentsByClientId;
    }

    const { data, error } = await supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .select('*')
      .in('client_id', clientIds)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data as DbClientPaymentRow[] | null) ?? []) {
      const payment = mapDbClientPayment(row);
      (paymentsByClientId[payment.clientId] ??= []).push(payment);
    }

    return paymentsByClientId;
  },

  async create(payload: CreateClientPaymentInput) {
    const dueDateValue = payload.dueDate ?? payload.paymentDate;

    // RPC security definer: valida owner_id = auth.uid() y rellena owner_id (NOT NULL) en servidor.
    const { data, error } = await supabase.rpc('create_client_payment', {
      p_owner_id: payload.ownerId,
      p_client_id: payload.clientId,
      p_amount: payload.amount,
      p_payment_date: toDateOnlyIso(payload.paymentDate),
      p_due_date: toDateOnlyIso(dueDateValue),
    });

    if (error) {
      throw new Error(error.message);
    }

    return mapDbClientPayment(data as DbClientPaymentRow);
  },

  async update(paymentId: string, payload: UpdateClientPaymentInput, ownerId?: string) {
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

    let updateQuery = supabase
      .from(CLIENT_PAYMENTS_TABLE)
      .update(updatePayload)
      .eq('id', paymentId);

    if (ownerId) {
      updateQuery = updateQuery.eq('owner_id', ownerId);
    }

    const { data, error } = await updateQuery.select('*').single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbClientPayment(data as DbClientPaymentRow);
  },

  async remove(paymentId: string, ownerId?: string) {
    let deleteQuery = supabase.from(CLIENT_PAYMENTS_TABLE).delete().eq('id', paymentId);

    if (ownerId) {
      deleteQuery = deleteQuery.eq('owner_id', ownerId);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw new Error(error.message);
    }
  },
};