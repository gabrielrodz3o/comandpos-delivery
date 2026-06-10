import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { focusManager } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '@store/useAuthStore';
import { ToastHost } from '@components/ui/ToastHost';
import { SyncBanner } from '@components/ui/SyncBanner';
import { registerForPushNotifications } from '@services/notifications';
import { connectRiderSocket, disconnectRiderSocket } from '@services/socket';
import { queryClient, persister, MY_ORDERS_KEY } from '@services/queryClient';
import { startSyncManager } from '@services/sync';

/** Refresca la lista de órdenes (la verdad del server). */
const refreshOrders = () => queryClient.invalidateQueries({ queryKey: MY_ORDERS_KEY });

/** Efectos de sesión: push + socket + cola offline cuando hay token. */
function SessionEffects() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    registerForPushNotifications();
    connectRiderSocket();
    const stopSync = startSyncManager();

    // React Query no cablea su focusManager al AppState en RN: lo hacemos nosotros
    // para que refetchOnWindowFocus dispare al volver la app a primer plano.
    const focusSub = AppState.addEventListener('change', (s) => {
      focusManager.setFocused(s === 'active');
    });

    // Tap en la notificación → refrescar AL ABRIR (el socket pudo perder el evento
    // en background) y luego ir a Mis órdenes.
    const tapSub = Notifications.addNotificationResponseReceivedListener(() => {
      refreshOrders();
      router.replace('/(tabs)/orders');
    });

    // Push recibido con la app en primer plano → refrescar la lista al instante.
    const fgSub = Notifications.addNotificationReceivedListener(() => {
      refreshOrders();
    });

    // Cold start: app abierta desde una notificación (estaba cerrada).
    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res) {
        refreshOrders();
        router.replace('/(tabs)/orders');
      }
    });

    return () => {
      tapSub.remove();
      fgSub.remove();
      focusSub.remove();
      disconnectRiderSocket();
      stopSync();
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
            <Stack.Screen name="select-location" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" options={{ presentation: 'card' }} />
          </Stack>
          <SessionEffects />
          <SyncBanner />
          <ToastHost />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
