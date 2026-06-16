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

const MAINTENANCE_MESSAGE = 'Soon: la invitacion por PIN atleta esta temporalmente en mantenimiento.';

export const athletePinsService = {
  async validatePin(pin: string): Promise<ValidatePinResult> {
    void pin;
    return { valid: false, trainerId: null, pinId: null, pinType: null, clientId: null };
  },

  async generatePin(): Promise<GeneratePinResult> {
    return { success: false, error: MAINTENANCE_MESSAGE };
  },

  async generateClientPin(clientId: string): Promise<GeneratePinResult> {
    void clientId;
    return { success: false, error: MAINTENANCE_MESSAGE };
  },

  async registerAthlete(input: RegisterAthleteInput): Promise<RegisterAthleteResult> {
    void input;
    return { success: false, error: MAINTENANCE_MESSAGE };
  },

  async registerAthleteExisting(pin: string): Promise<RegisterAthleteResult> {
    void pin;
    return { success: false, error: MAINTENANCE_MESSAGE };
  },
};
