import { useMyOrders } from "@hooks/useMyOrders";
import { useConfirmation } from "@hooks/useConfirmation";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useDeliveryPreferences } from "@store/useDeliveryPreferences";
import { stopLocationSharing } from "@services/tracking";
import Constants from "expo-constants";
import { useAuthStore } from "@store/useAuthStore";
import { useSyncQueue } from "@store/useSyncQueue";
import { useRiderOperations } from "@hooks/useRiderOperations";
import { currentScope, sessionKey } from "@services/session";
import { queuePresence, flushQueue, queueArrival } from "@services/sync";
import { reportArrival } from "@services/delivery";
import { logoutRequest } from "@services/auth";
import { unregisterPushToken } from "@services/notifications";
import { showToast } from "@store/useToastStore";
import { ui, Button, Badge, QueryNotice } from "@components/ui/DeliveryUI";
import { money, initials } from "@utils/format";
import { dateTime, dispatchLabel } from "@utils/delivery";
import { openLink } from "@utils/contact";
import { palette } from "@theme/colors";
import {
  PageHeading,
  ProfileCard,
  SectionLabel,
} from "@components/ui/DeliveryDesign";
import {
  IcUser,
  IcWallet,
  IcPower,
  IcInfo,
  IcHeadset,
} from "@components/ui/icons";
const c = palette.dark;
export default function AccountScreen() {
  const { confirm, dialog } = useConfirmation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout } = useAuthStore();
  const scope = currentScope();
  const operations = useRiderOperations();
  const orders = useMyOrders();
  const preferences = useDeliveryPreferences();
  const tracking = !!preferences.tracking[scope || ""];
  const sync = useSyncQueue();
  const own = sync.items.filter((i) => i.owner === scope);
  const legacy = sync.items.filter((i) => !i.owner).length;
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState({
    location: "Consultando",
    push: "Consultando",
  });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Las pestañas no se desmontan al navegar, así que sin esto los fondos y el
      // estado operativo solo se refrescan por reloj (30/60 s) y caja parece no
      // haber entregado nada todavía.
      void qc.invalidateQueries({ queryKey: sessionKey(scope) });
      Promise.all([
        Location.getForegroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
      ])
        .then(([loc, push]) => {
          if (active)
            setPermissions({
              location: loc.granted ? "Permitida" : "No permitida",
              push: push.granted ? "Permitidas" : "No permitidas",
            });
        })
        .catch(() => {
          if (active)
            setPermissions({
              location: "No disponible",
              push: "No disponibles",
            });
        });
      return () => {
        active = false;
      };
    }, [qc, scope]),
  );
  const refresh = () =>
    void qc.invalidateQueries({ queryKey: sessionKey(scope) });
  const notify = (active: boolean) =>
    confirm(
      "Avisar a caja",
      `${active ? "Estoy activo y listo para trabajar." : "Estoy inactivo por el momento."} Caja mantiene el control de nuevas asignaciones.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar aviso",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await queuePresence(active);
              if (!result.queued)
                showToast({
                  message: "Caja recibió tu aviso de actividad.",
                  variant: "success",
                });
              refresh();
            } catch (e: any) {
              showToast({ message: e.message, variant: "error" });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  const arrival = async () => {
    setBusy(true);
    try {
      const result = await queueArrival();
      refresh();
      if (!result.queued)
        showToast({
          message: "Llegada registrada. Acércate a caja para liquidar.",
          variant: "success",
        });
    } catch (e: any) {
      showToast({ message: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };
  const exit = () =>
    confirm(
      "Cerrar sesión",
      own.length
        ? `Tienes ${own.length} cambios pendientes. Se conservarán para esta cuenta y sucursal; no se enviarán desde otra sesión. Vuelve a entrar para sincronizarlos.`
        : "¿Deseas cerrar tu sesión?",
      [
        { text: "Continuar aquí", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await unregisterPushToken();
              await logoutRequest();
            } catch {
            } finally {
              logout();
              setBusy(false);
              router.replace("/(auth)/login");
            }
          },
        },
      ],
    );
  const data = operations.data;
  const pendingPresence = own.find((i) => i.kind === "presence");
  const support = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || "").replace(
    /\D/g,
    "",
  );
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <PageHeading
        title="Mi cuenta"
        eyebrow="Todo para tu jornada"
        icon={<IcUser size={24} color={c.brandMid} />}
      />
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={operations.isRefetching}
            onRefresh={refresh}
          />
        }
      >
        <ProfileCard
          name={user?.use_fullname || "Repartidor"}
          username={user?.use_username}
          location={data?.location_name || "Sucursal por confirmar"}
          initials={initials(user?.use_fullname)}
        />
        <QueryNotice
          loading={operations.isLoading}
          error={operations.error}
          stale={!!data}
          onRetry={() => void operations.refetch()}
        />
        <View style={ui.card}>
          <SectionLabel
            title="Recepción de pedidos"
            icon={<IcPower size={18} color={c.brandMid} />}
          />
          <Badge
            label={
              data?.accepting_orders === true
                ? "Habilitada por caja"
                : data?.accepting_orders === false
                  ? "Pausada por caja"
                  : "Por confirmar"
            }
            color={data?.accepting_orders ? c.success : c.textDim}
          />
          <Text style={ui.body}>{dispatchLabel(data?.dispatch_status)}</Text>
          <Text style={ui.muted}>
            Solo caja puede activar o pausar tus nuevas asignaciones. Puedes
            avisarle cómo te encuentras.
          </Text>
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="Estoy activo"
                busy={busy}
                disabled={
                  !!pendingPresence || data?.mobile_contract_version !== 2
                }
                onPress={() => notify(true)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                label="Estoy inactivo"
                disabled={
                  busy ||
                  !!pendingPresence ||
                  data?.mobile_contract_version !== 2
                }
                onPress={() => notify(false)}
              />
            </View>
          </View>
          {pendingPresence ? (
            <Text style={ui.muted}>
              {pendingPresence.state === "failed"
                ? "Aviso no confirmado: revisa la sincronización."
                : "Aviso guardado, pendiente de enviar a caja."}
            </Text>
          ) : (
            data?.rider_presence && (
              <Text style={ui.muted}>
                Último aviso:{" "}
                {data.rider_presence.active ? "activo" : "inactivo"} ·{" "}
                {dateTime(data.rider_presence.reported_at)}
              </Text>
            )
          )}
          {data?.arrival_tracking_enabled &&
            ["assigned", "delivering"].includes(
              data?.dispatch_status || "",
            ) && (
              <Button
                secondary
                label="Llegué a la sucursal"
                disabled={
                  !orders.data ||
                  orders.active.length > 0 ||
                  !data?.capabilities?.arrival_queue ||
                  own.some((i) => i.kind === "arrival")
                }
                busy={busy}
                onPress={arrival}
              />
            )}
        </View>
        {Platform.OS !== "web" && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Ubicación durante el viaje</Text>
            <Text style={ui.body}>
              {tracking ? "Seguimiento autorizado" : "Seguimiento desactivado"}
            </Text>
            <Text style={ui.muted}>
              Despacho podrá consultar tu última ubicación mientras tengas
              pedidos en camino. Si permites segundo plano, continuará al abrir
              el navegador. Se detiene al terminar las entregas o cerrar sesión.
            </Text>
            <Button
              secondary
              disabled={!operations.data?.capabilities?.tracking}
              label={
                tracking
                  ? "Dejar de compartir ubicación"
                  : "Autorizar seguimiento en viajes"
              }
              onPress={() => {
                if (tracking) {
                  if (scope) preferences.setTracking(scope, false);
                  void stopLocationSharing();
                  return;
                }
                confirm(
                  "Compartir con despacho",
                  "Se enviará tu ubicación durante viajes activos. Puedes desactivarla aquí en cualquier momento.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Continuar",
                      onPress: () => {
                        void (async () => {
                          const foreground =
                            await Location.requestForegroundPermissionsAsync();
                          if (!foreground.granted)
                            throw new Error(
                              "Activa la ubicación para compartir tus viajes.",
                            );
                          await Location.requestBackgroundPermissionsAsync();
                          if (currentScope() === scope && scope)
                            preferences.setTracking(scope, true);
                        })().catch((e) =>
                          showToast({ message: e.message, variant: "warning" }),
                        );
                      },
                    },
                  ],
                );
              }}
            />
          </View>
        )}
        <Button
          secondary
          label="Ver cobros y liquidaciones"
          onPress={() => router.push("/(tabs)/money")}
        />
        <Button
          secondary
          label="Mis incidencias"
          onPress={() => router.push("/incidents")}
        />
        <View style={ui.card}>
          <SectionLabel
            title="Sincronización"
            icon={<IcInfo size={18} color={c.brandMid} />}
          />
          <Text style={ui.body}>
            {own.length
              ? `${own.length} cambio(s) guardado(s) en este dispositivo`
              : "Sin cambios pendientes en esta cuenta"}
          </Text>
          {own.map((item) => (
            <View key={item.id} style={{ gap: 4 }}>
              <Text style={ui.body}>{item.label}</Text>
              <Text style={ui.muted}>
                {item.state === "failed"
                  ? item.error
                  : "Pendiente de confirmación del servidor"}
              </Text>
              {item.state === "failed" && (
                <Button
                  secondary
                  label="Descartar cambio rechazado"
                  disabled={sync.flushing}
                  onPress={() =>
                    confirm(
                      "Revisar antes de descartar",
                      `${item.label}: este cambio no quedó confirmado. Verifica con caja antes de quitarlo de la cola. La orden conservará el estado del servidor.`,
                      [
                        { text: "Conservar", style: "cancel" },
                        {
                          text: "Descartar",
                          style: "destructive",
                          onPress: () => {
                            sync.remove(item.id);
                            refresh();
                            void flushQueue();
                          },
                        },
                      ],
                    )
                  }
                />
              )}
            </View>
          ))}
          {own.length > 0 && (
            <Button
              secondary
              label="Reintentar sincronización"
              busy={sync.flushing}
              onPress={() => {
                if (scope) sync.retry(scope);
                void flushQueue();
              }}
            />
          )}
          {legacy > 0 && (
            <Text style={ui.muted}>
              Hay registros de una versión anterior sin propietario verificable.
              No se enviarán automáticamente; solicita revisión a soporte.
            </Text>
          )}
        </View>
        <View style={ui.card}>
          <SectionLabel
            title="Permisos y soporte"
            icon={<IcHeadset size={18} color={c.brandMid} />}
          />
          <Text style={ui.body}>Ubicación: {permissions.location}</Text>
          <Text style={ui.body}>Notificaciones: {permissions.push}</Text>
          <Button
            secondary
            label="Abrir ajustes del dispositivo"
            onPress={() => {
              void Linking.openSettings().catch(() =>
                showToast({
                  message: "No se pudieron abrir los ajustes.",
                  variant: "error",
                }),
              );
            }}
          />
          {!!support && (
            <Button
              secondary
              label="Contactar soporte"
              onPress={() => void openLink(`https://wa.me/${support}`)}
            />
          )}
          <Text style={ui.muted}>
            ComandPOS Delivery · {Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </View>
        <Button secondary label="Cerrar sesión" busy={busy} onPress={exit} />
      </ScrollView>
      {dialog}
    </View>
  );
}
