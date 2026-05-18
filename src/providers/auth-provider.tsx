import { Session, User } from '@supabase/supabase-js';
import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { authService, SignInWithPasswordInput, SignUpInput } from '@/services/auth';
import { UserRole } from '@/types/domain';

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  userRole: UserRole | null;
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
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    setUserRole((data?.role as UserRole) ?? 'trainer');
  }

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
          setUserRole(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session?.user) {
            void fetchRole(data.session.user.id);
          }
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
      if (nextSession?.user) {
        void fetchRole(nextSession.user.id);
      } else {
        setUserRole(null);
      }
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
      userRole,
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
    [isLoading, session, user, userRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}