import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/components/auth/auth-route';
import { useAuth } from '@/hooks/use-auth';

export default function IndexRoute() {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={userRole === 'athlete' ? '/athlete' : '/clients'} />;
}
