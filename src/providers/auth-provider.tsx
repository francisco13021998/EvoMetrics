import { Session, User } from '@supabase/supabase-js';
import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

import { authService, SignInWithPasswordInput, SignUpInput } from '@/services/auth';

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (input: SignInWithPasswordInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    authService
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = authService.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      async signIn(input) {
        const { error } = await authService.signInWithPassword(input);

        if (error) {
          throw new Error(error.message);
        }
      },
      async signUp(input) {
        const { data, error } = await authService.signUp(input);

        if (error) {
          throw new Error(error.message);
        }

        return {
          needsEmailConfirmation: Boolean(data.user && !data.session),
        };
      },
      async signOut() {
        const { error } = await authService.signOut();

        if (error) {
          throw new Error(error.message);
        }
      },
    }),
    [isLoading, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}