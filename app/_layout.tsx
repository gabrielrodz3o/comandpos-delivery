import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '@store/useAuthStore';
import { ToastHost } from '@components/ui/ToastHost';
import { registerForPushNotifications } from '@services/notifications';
import { connectRiderSocket, disconnectRiderSocket } from '@services/socket';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/** Efectos de sesión: push + socket cuando hay token. NO navega (salvo tap de push). */
function SessionEffects() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    registerForPushNotifications();
    connectRiderSocket();
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Tap en la notificación → ir a Mis órdenes (seguro: post-mount, acción del usuario).
      router.replace('/(tabs)/orders');
    });
    return () => {
      sub.remove();
      disconnectRiderSocket();
    };
  }, [token]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
          </Stack>
          <SessionEffects />
          <ToastHost />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
