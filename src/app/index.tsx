import { Redirect } from 'expo-router';

import { AuthLoadingScreen } from '@/components/auth/auth-route';
import { useAuth } from '@/hooks/use-auth';

export default function IndexRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return <Redirect href={isAuthenticated ? '/clients' : '/login'} />;
}
