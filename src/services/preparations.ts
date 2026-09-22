import { supabase } from '@/lib/supabase';
import { Preparation } from '@/types/domain';

export const PREPARATIONS_TABLE = 'preparations';

type DbPreparationRow = {
  id: string;
  owner_id: string;
  client_id: string;
  phase: string | null;
  name: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type StartPreparationInput = {
  clientId: string;
  phase?: string | null;
  startDate: string;
  name?: string | null;
};

function mapDbPreparation(row: DbPreparationRow): Preparation {
  return {
    id: row.id,
    clientId: row.client_id,
    ownerId: row.owner_id,
    phase: row.phase,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const preparationsService = {
  // Entrenador: solo sus propios clientes (RLS ya lo exige, pero se filtra explícito para consistencia).
  async listByClient(clientId: string, ownerId: string) {
    const { data, error } = await supabase
      .from(PREPARATIONS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .eq('owner_id', ownerId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbPreparationRow[] | null)?.map(mapDbPreparation) ?? [];
  },

  // Atleta: la política athletes_read_own_preparations restringe a su propio cliente vinculado.
  async listByClientForViewer(clientId: string) {
    const { data, error } = await supabase
      .from(PREPARATIONS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbPreparationRow[] | null)?.map(mapDbPreparation) ?? [];
  },

  // Cierra la preparación abierta del cliente (si existe) y abre una nueva; las revisiones nuevas
  // se asignan a ella automáticamente vía trigger.
  async startPreparation(input: StartPreparationInput) {
    const { data, error } = await supabase.rpc('start_preparation', {
      p_client_id: input.clientId,
      p_phase: input.phase ?? null,
      p_start_date: input.startDate,
      p_name: input.name ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return mapDbPreparation(data as DbPreparationRow);
  },
};
