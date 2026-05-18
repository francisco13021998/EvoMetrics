import { supabase } from '@/lib/supabase';

export type PinType = 'new_client' | 'existing_client';

export type ValidatePinResult =
  | { valid: true; trainerId: string; pinId: string; pinType: PinType; clientId: string | null }
  | { valid: false; trainerId: null; pinId: null; pinType: null; clientId: null };

export type GeneratePinResult =
  | { success: true; pin: string; expiresAt: string }
  | { success: false; error: string };

export type RegisterAthleteInput = {
  pin: string;
  name: string;
  sex?: string | null;
  athleteLevel?: string;
  heightCm?: number | null;
  age?: number | null;
};

export type RegisterAthleteResult =
  | { success: true; clientId: string }
  | { success: false; error: string };

export const athletePinsService = {
  async validatePin(pin: string): Promise<ValidatePinResult> {
    const { data, error } = await supabase.rpc('validate_athlete_pin', {
      p_pin: pin.trim().toUpperCase(),
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = data as {
      valid: boolean;
      trainer_id: string | null;
      pin_id: string | null;
      pin_type: PinType | null;
      client_id: string | null;
    };

    if (!result.valid) {
      return { valid: false, trainerId: null, pinId: null, pinType: null, clientId: null };
    }

    return {
      valid: true,
      trainerId: result.trainer_id!,
      pinId: result.pin_id!,
      pinType: result.pin_type!,
      clientId: result.client_id ?? null,
    };
  },

  async generatePin(): Promise<GeneratePinResult> {
    const { data, error } = await supabase.rpc('generate_athlete_pin');

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; pin?: string; expires_at?: string; error?: string };

    if (!result.success) {
      return { success: false, error: result.error ?? 'Error desconocido' };
    }

    return { success: true, pin: result.pin!, expiresAt: result.expires_at! };
  },

  async generateClientPin(clientId: string): Promise<GeneratePinResult> {
    const { data, error } = await supabase.rpc('generate_client_pin', {
      p_client_id: clientId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; pin?: string; expires_at?: string; error?: string };

    if (!result.success) {
      return { success: false, error: result.error ?? 'Error desconocido' };
    }

    return { success: true, pin: result.pin!, expiresAt: result.expires_at! };
  },

  async registerAthlete(input: RegisterAthleteInput): Promise<RegisterAthleteResult> {
    const { data, error } = await supabase.rpc('register_athlete', {
      p_pin: input.pin.trim().toUpperCase(),
      p_name: input.name.trim(),
      p_sex: input.sex ?? null,
      p_athlete_level: input.athleteLevel ?? 'beginner',
      p_height_cm: input.heightCm ?? null,
      p_age: input.age ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; client_id?: string; error?: string };

    if (!result.success) {
      return { success: false, error: result.error ?? 'Error desconocido' };
    }

    return { success: true, clientId: result.client_id! };
  },

  async registerAthleteExisting(pin: string): Promise<RegisterAthleteResult> {
    const { data, error } = await supabase.rpc('register_athlete_existing', {
      p_pin: pin.trim().toUpperCase(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; client_id?: string; error?: string };

    if (!result.success) {
      return { success: false, error: result.error ?? 'Error desconocido' };
    }

    return { success: true, clientId: result.client_id! };
  },
};
