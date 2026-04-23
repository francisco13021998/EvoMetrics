import { supabase } from '@/lib/supabase';
import { Client, ClientSex } from '@/types/domain';

export const CLIENTS_TABLE = 'clients';

type DbClientSex = ClientSex | 'mujer' | 'hombre' | 'otro';

type DbClientRow = {
  id: string;
  owner_id: string;
  name: string;
  sex: DbClientSex | null;
  height_cm: number | null;
  age: number | null;
  created_at: string;
};

export type CreateClientInput = {
  ownerId: string;
  name: string;
  sex?: ClientSex | null;
  heightCm?: number | null;
  age?: number | null;
};

export type UpdateClientInput = {
  name?: string;
  sex?: ClientSex | null;
  heightCm?: number | null;
  age?: number | null;
};

function normalizeClientSex(value: DbClientSex | null): ClientSex | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'female' || normalizedValue === 'mujer') {
    return 'female';
  }

  if (normalizedValue === 'male' || normalizedValue === 'hombre') {
    return 'male';
  }

  if (normalizedValue === 'other' || normalizedValue === 'otro') {
    return 'other';
  }

  return null;
}

function toDbClientSex(value: ClientSex | null, preferSpanish: boolean) {
  if (value === null) {
    return null;
  }

  if (!preferSpanish) {
    return value;
  }

  if (value === 'female') {
    return 'mujer';
  }

  if (value === 'male') {
    return 'hombre';
  }

  return 'otro';
}

function isSexConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { message?: string; details?: string; code?: string };
  const haystack = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.code ?? ''}`.toLowerCase();

  return haystack.includes('clients_sex_check') || haystack.includes('check constraint');
}

function mapDbClient(row: DbClientRow): Client {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    sex: normalizeClientSex(row.sex),
    heightCm: row.height_cm,
    age: row.age,
    createdAt: row.created_at,
  };
}

function mapCreatePayload(payload: CreateClientInput, preferSpanishSex = false) {
  return {
    owner_id: payload.ownerId,
    name: payload.name,
    sex: toDbClientSex(payload.sex ?? null, preferSpanishSex),
    height_cm: payload.heightCm ?? null,
    age: payload.age ?? null,
  };
}

function mapUpdatePayload(payload: UpdateClientInput, preferSpanishSex = false) {
  return {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.sex !== undefined ? { sex: toDbClientSex(payload.sex, preferSpanishSex) } : {}),
    ...(payload.heightCm !== undefined ? { height_cm: payload.heightCm } : {}),
    ...(payload.age !== undefined ? { age: payload.age } : {}),
  };
}

export const clientsService = {
  async listByOwner(ownerId: string) {
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbClientRow[] | null)?.map(mapDbClient) ?? [];
  },

  async getById(clientId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .select('*')
      .eq('id', clientId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapDbClient(data as DbClientRow) : null;
  },

  async create(payload: CreateClientInput) {
    const firstAttempt = await supabase
      .from(CLIENTS_TABLE)
      .insert(mapCreatePayload(payload, false))
      .select('*')
      .single();

    if (!firstAttempt.error) {
      return mapDbClient(firstAttempt.data as DbClientRow);
    }

    if (payload.sex && isSexConstraintError(firstAttempt.error)) {
      const retryAttempt = await supabase
        .from(CLIENTS_TABLE)
        .insert(mapCreatePayload(payload, true))
        .select('*')
        .single();

      if (!retryAttempt.error) {
        return mapDbClient(retryAttempt.data as DbClientRow);
      }

      throw new Error(retryAttempt.error.message);
    }

    throw new Error(firstAttempt.error.message);
  },

  async update(clientId: string, ownerId: string, payload: UpdateClientInput) {
    const firstAttempt = await supabase
      .from(CLIENTS_TABLE)
      .update(mapUpdatePayload(payload, false))
      .eq('id', clientId)
      .eq('owner_id', ownerId)
      .select('*')
      .single();

    if (!firstAttempt.error) {
      return mapDbClient(firstAttempt.data as DbClientRow);
    }

    if (payload.sex && isSexConstraintError(firstAttempt.error)) {
      const retryAttempt = await supabase
        .from(CLIENTS_TABLE)
        .update(mapUpdatePayload(payload, true))
        .eq('id', clientId)
        .eq('owner_id', ownerId)
        .select('*')
        .single();

      if (!retryAttempt.error) {
        return mapDbClient(retryAttempt.data as DbClientRow);
      }

      throw new Error(retryAttempt.error.message);
    }

    throw new Error(firstAttempt.error.message);
  },

  async remove(clientId: string, ownerId: string) {
    const { error } = await supabase
      .from(CLIENTS_TABLE)
      .delete()
      .eq('id', clientId)
      .eq('owner_id', ownerId);

    if (error) {
      throw new Error(error.message);
    }
  },
};