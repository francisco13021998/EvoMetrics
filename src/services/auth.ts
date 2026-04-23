import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type SignInWithPasswordInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  metadata?: {
    fullName?: string;
    clinicName?: string;
  };
};

type DevLoginPreset = {
  email: string;
  password: string;
};

const DEV_LOGIN_ALIAS = process.env.EXPO_PUBLIC_DEV_LOGIN_ALIAS;
const DEV_LOGIN_EMAIL = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL;
const DEV_LOGIN_PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD;

function getDevLoginPreset(email: string): DevLoginPreset | null {
  if (!__DEV__) {
    return null;
  }

  if (!DEV_LOGIN_ALIAS || !DEV_LOGIN_EMAIL || !DEV_LOGIN_PASSWORD) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedAlias = DEV_LOGIN_ALIAS.trim().toLowerCase();
  const normalizedDevEmail = DEV_LOGIN_EMAIL.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  if (normalizedEmail !== normalizedAlias && normalizedEmail !== normalizedDevEmail) {
    return null;
  }

  return {
    email: DEV_LOGIN_EMAIL.trim(),
    password: DEV_LOGIN_PASSWORD,
  };
}

export function resolveSignInCredentials(input: SignInWithPasswordInput): SignInWithPasswordInput {
  const devLoginPreset = getDevLoginPreset(input.email);

  if (!devLoginPreset) {
    return {
      email: input.email.trim(),
      password: input.password,
    };
  }

  return {
    email: devLoginPreset.email,
    password: input.password.trim() || devLoginPreset.password,
  };
}

export const authService = {
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },

  getSession() {
    return supabase.auth.getSession();
  },

  getCurrentUser() {
    return supabase.auth.getUser();
  },

  signInWithPassword({ email, password }: SignInWithPasswordInput) {
    const credentials = resolveSignInCredentials({ email, password });

    return supabase.auth.signInWithPassword(credentials);
  },

  signUp({ email, password, metadata }: SignUpInput) {
    return supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
  },

  signOut() {
    return supabase.auth.signOut();
  },

  updateUser(attributes: Partial<Pick<User, 'email' | 'phone'>>) {
    return supabase.auth.updateUser(attributes);
  },
};