import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '@store/useAuthStore';
import { ToastHost } from '@components/ui/ToastHost';
import { SyncBanner } from '@components/ui/SyncBanner';
import { registerForPushNotifications } from '@services/notifications';
import { connectRiderSocket, disconnectRiderSocket } from '@services/socket';
import { queryClient, persister } from '@services/queryClient';
import { startSyncManager } from '@services/sync';

/** Efectos de sesión: push + socket + cola offline cuando hay token. */
function SessionEffects() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    registerForPushNotifications();
    connectRiderSocket();
    const stopSync = startSyncManager();
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Tap en la notificación → ir a Mis órdenes (seguro: post-mount, acción del usuario).
      router.replace('/(tabs)/orders');
    });
    return () => {
      sub.remove();
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
