import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@store/useAuthStore';

export default function AuthLayout() {
  const { token, hydrated } = useAuthStore();
  // Si ya hay sesión, no mostrar login.
  if (hydrated && token) return <Redirect href="/(tabs)/orders" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
