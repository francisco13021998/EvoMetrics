import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

function requireExpoPublicEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const supabaseUrl = requireExpoPublicEnv(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  'EXPO_PUBLIC_SUPABASE_URL'
);
export const supabaseAnonKey = requireExpoPublicEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
);

// Durante el prerender estático de la web (expo export, web.output "static") no hay window
// ni almacenamiento: en ese contexto la sesión no se persiste, en el cliente sí.
const isServerRender = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: !isServerRender,
    detectSessionInUrl: false,
    persistSession: !isServerRender,
    storage: isServerRender ? undefined : AsyncStorage,
  },
});