import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { focusManager } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as Haptics from "expo-haptics";

import { useAuthStore } from "@store/useAuthStore";
import { ToastHost } from "@components/ui/ToastHost";
import { SyncBanner } from "@components/ui/SyncBanner";
import { registerForPushNotifications } from "@services/notifications";
import {
  connectRiderSocket,
  disconnectRiderSocket,
  onRiderUpdate,
} from "@services/socket";
import { queryClient, persister, MY_ORDERS_KEY } from "@services/queryClient";
import { startSyncManager } from "@services/sync";
import { TrackingEffects } from "@components/TrackingEffects";
import { DeliveryIntro } from "@components/brand/DeliveryIntro";
import { notificationOrderId } from "@utils/operations";
import { currentScope, sessionKey } from "@services/session";

// Mantener el splash nativo hasta que la escena animada tenga su primer layout.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Refresca la lista de órdenes (la verdad del server). */
const refreshOrders = () =>
  queryClient.invalidateQueries({ queryKey: MY_ORDERS_KEY });

/** Efectos de sesión: push + socket + cola offline cuando hay token. */
function SessionEffects() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const locationId = useAuthStore((s) => s.locationId);

  useEffect(() => {
    if (!token) return;
    registerForPushNotifications();
    connectRiderSocket();
    const off = onRiderUpdate((payload) => {
      queryClient.invalidateQueries({ queryKey: sessionKey(currentScope()) });
      if (payload?.reason === "assigned")
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
    });
    const stopSync = startSyncManager();

    // React Query no cablea su focusManager al AppState en RN: lo hacemos nosotros
    // para que refetchOnWindowFocus dispare al volver la app a primer plano.
    const focusSub = AppState.addEventListener("change", (s) => {
      focusManager.setFocused(s === "active");
    });

    // Tap en la notificación → refrescar AL ABRIR (el socket pudo perder el evento
    // en background) y luego ir a Mis órdenes.
    const opened = new Set<string>();
    const openNotification = (response: Notifications.NotificationResponse) => {
      const request = response.notification.request;
      if (
        opened.has(request.identifier) ||
        useAuthStore.getState().token !== token
      )
        return;
      opened.add(request.identifier);
      refreshOrders();
      const id = notificationOrderId(request.content.data);
      if (id) router.push(`/order/${id}`);
      else router.replace("/(tabs)/orders");
      void Notifications.clearLastNotificationResponseAsync();
    };
    const tapSub =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    // Push recibido con la app en primer plano → refrescar la lista al instante.
    const fgSub = Notifications.addNotificationReceivedListener(() => {
      refreshOrders();
    });

    // Cold start: app abierta desde una notificación (estaba cerrada).
    Notifications.getLastNotificationResponseAsync()
      .then((res) => {
        if (res) openNotification(res);
      })
      .catch(() => {});

    return () => {
      tapSub.remove();
      fgSub.remove();
      focusSub.remove();
      disconnectRiderSocket();
      stopSync();
      off();
    };
  }, [token, locationId]);

  return null;
}

export default function RootLayout() {
  const [introVisible, setIntroVisible] = useState(true);
  const hydrated = useAuthStore((state) => state.hydrated);
  const toLogin = useAuthStore((state) => !state.token);
  const finishIntro = useCallback(() => setIntroVisible(false), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            buster: "rider-scoped-v3",
            dehydrateOptions: {
              shouldDehydrateQuery: (query) =>
                query.state.status === "success" &&
                query.meta?.persist !== false,
            },
          }}
        >
          <View
            style={{ flex: 1 }}
            accessibilityElementsHidden={introVisible}
            importantForAccessibility={
              introVisible ? "no-hide-descendants" : "auto"
            }
          >
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="select-location" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="order/[id]"
                options={{ presentation: "card" }}
              />
            </Stack>
            <SyncBanner />
            <ToastHost />
          </View>
          <SessionEffects />
          <TrackingEffects />
          {introVisible && (
            <DeliveryIntro
              ready={hydrated}
              toLogin={toLogin}
              onFinish={finishIntro}
            />
          )}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
