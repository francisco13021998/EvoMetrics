import { Session, User } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { router } from 'expo-router';
import React, { createContext, ReactNode, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { authService, SignInWithPasswordInput, SignUpInput } from '@/services/auth';
import { ensureDeviceNotificationsPermission, supportsDeviceNotifications, syncDeviceNotificationsForUser } from '@/services/device-notifications';
import { UserRole } from '@/types/domain';

type NotificationsModule = typeof import('expo-notifications');

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!supportsDeviceNotifications()) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

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

  useEffect(() => {
    if (!supportsDeviceNotifications()) {
      return;
    }

    void ensureDeviceNotificationsPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!supportsDeviceNotifications()) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const Notifications = await loadNotificationsModule();

      if (!Notifications) {
        return;
      }

      if (!user?.id) {
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
        return;
      }

      await syncDeviceNotificationsForUser(user.id).catch(() => {
        if (isMounted) {
          // Local reminders are optional; the app can continue if sync fails.
        }
      });
    })().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!supportsDeviceNotifications()) {
      return;
    }

    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const Notifications = await loadNotificationsModule();

      if (!Notifications) {
        return;
      }

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { kind?: string; clientId?: string } | undefined;

        if (!data?.clientId || (data.kind !== 'payment' && data.kind !== 'revision')) {
          return;
        }

        if (data.kind === 'payment') {
          router.push(`/clients/${data.clientId}/payments`);
          return;
        }

        router.push(`/clients/${data.clientId}`);
      });

      void Notifications.getLastNotificationResponseAsync().then((response) => {
        const data = response?.notification.request.content.data as { kind?: string; clientId?: string } | undefined;

        if (!data?.clientId || (data.kind !== 'payment' && data.kind !== 'revision')) {
          return;
        }

        if (data.kind === 'payment') {
          router.push(`/clients/${data.clientId}/payments`);
          return;
        }

        router.push(`/clients/${data.clientId}`);
      });
    })().catch(() => {});

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!supportsDeviceNotifications()) {
      return;
    }

    let isMounted = true;
    let lastWasOffline = false;

    async function syncNotificationsWhenOnline() {
      if (!user?.id) {
        return;
      }

      const networkState = await Network.getNetworkStateAsync().catch(() => null);
      const isOnline = Boolean(networkState?.isConnected && networkState?.isInternetReachable !== false);

      if (!isMounted) {
        return;
      }

      if (!isOnline) {
        lastWasOffline = true;
        return;
      }

      lastWasOffline = false;
      await syncDeviceNotificationsForUser(user.id).catch(() => {});
    }

    void syncNotificationsWhenOnline();

    const subscription = Network.addNetworkStateListener((networkState) => {
      const isOnline = Boolean(networkState.isConnected && networkState.isInternetReachable !== false);

      if (!isOnline) {
        lastWasOffline = true;
        return;
      }

      if (!user?.id || !lastWasOffline) {
        return;
      }

      lastWasOffline = false;
      void syncDeviceNotificationsForUser(user.id).catch(() => {});
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [session?.user, user?.id]);

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