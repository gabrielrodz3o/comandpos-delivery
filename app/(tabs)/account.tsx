import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { useAuthStore } from "@store/useAuthStore";
import { useSyncQueue } from "@store/useSyncQueue";
import {
  useRiderOperations,
  useRiderFinances,
} from "@hooks/useRiderOperations";
import { currentScope, sessionKey } from "@services/session";
import { queuePresence, flushQueue } from "@services/sync";
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout } = useAuthStore();
  const scope = currentScope();
  const operations = useRiderOperations();
  const finances = useRiderFinances();
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
    Alert.alert(
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
      await reportArrival();
      refresh();
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
    Alert.alert(
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
            refreshing={operations.isRefetching || finances.isRefetching}
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
                busy={busy}
                onPress={arrival}
              />
            )}
        </View>
        <SectionLabel
          title="Mi caja"
          caption="Fondos recibidos y cobros pendientes de liquidar."
          icon={<IcWallet size={19} color={c.brandMid} />}
        />
        <QueryNotice
          loading={finances.isLoading}
          error={finances.error}
          stale={!!finances.data}
          onRetry={() => void finances.refetch()}
        />
        {finances.data?.summaries.map((summary) => (
          <View
            key={summary.currency_code}
            style={[
              ui.card,
              { backgroundColor: "#FFF6EC", borderColor: "#F1DCC7" },
            ]}
          >
            <View style={ui.between}>
              <Text style={ui.eyebrow}>PENDIENTE DE LIQUIDAR</Text>
              <Badge label={summary.currency_code} color={c.brandMid} />
            </View>
            <Text style={[ui.amount, { fontSize: 32, color: "#7C381B" }]}>
              {money(summary.pending_settlement, summary.currency_code)}
            </Text>
            <Text style={ui.muted}>Cobros que debes presentar en caja</Text>
            <View style={ui.divider} />
            <MoneyLine
              label="Fondo de cambio por devolver"
              value={money(summary.fund_to_return, summary.currency_code)}
            />

            <View style={ui.divider} />
            <MoneyLine
              label="Pendiente de cobrar a clientes"
              value={money(summary.pending_collection, summary.currency_code)}
            />
            {summary.pending_review > 0 && (
              <MoneyLine
                label="Importes que caja debe revisar"
                value={money(summary.pending_review, summary.currency_code)}
              />
            )}
            <Text style={ui.muted}>
              Caja confirma los medios de pago y el cierre. Estos importes no
              son tus ganancias.
            </Text>
          </View>
        ))}
        {finances.data && !finances.data.summaries.length && (
          <QueryNotice empty="Sin fondos ni liquidaciones pendientes" />
        )}
        {!!finances.data?.funds.length && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Fondos entregados por caja</Text>
            {finances.data.funds.map((f) => (
              <View
                key={f.id}
                style={{
                  gap: 5,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderColor: c.border,
                }}
              >
                <View style={ui.between}>
                  <Text style={[ui.body, { fontWeight: "800" }]}>
                    {money(f.amount, f.currency_code)}
                  </Text>
                  <Badge
                    label={
                      f.status === "open"
                        ? "Por devolver"
                        : f.status === "returned"
                          ? "Devuelto"
                          : "Cancelado"
                    }
                    color={f.status === "open" ? c.warning : c.textDim}
                  />
                </View>
                <Text style={ui.muted}>
                  {f.given_by_name || "Caja"}
                  {f.box_name ? ` · ${f.box_name}` : ""}
                </Text>
                <Text style={ui.muted}>
                  Entregado: {dateTime(f.created_at)}
                  {f.returned_at
                    ? `\nDevuelto: ${dateTime(f.returned_at)}`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
        {!!finances.data?.collections.length && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Órdenes con custodia pendiente</Text>
            {finances.data.collections.map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 7,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderColor: c.border,
                }}
              >
                <MoneyLine
                  label={`#${item.account_id} · ${item.customer_name || "Cliente"}`}
                  value={money(item.balance, item.currency_code)}
                />
                <Text style={ui.muted}>
                  {item.stage === "settlement"
                    ? "Pendiente de liquidar"
                    : item.stage === "review"
                      ? "Revisar con caja"
                      : "Pendiente de cobrar"}{" "}
                  · {item.payment_method || "Medio por confirmar"}
                </Text>
                <Button
                  secondary
                  label={`Ver orden #${item.account_id}`}
                  onPress={() => router.push(`/order/${item.account_id}`)}
                />
              </View>
            ))}
          </View>
        )}
        {finances.data && (
          <Text style={ui.muted}>
            Última consulta: {dateTime(finances.data.updated_at)}. Fondos
            cerrados: últimos 30 días.
          </Text>
        )}
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
                    Alert.alert(
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
    </View>
  );
}
function MoneyLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={[ui.between, { alignItems: "flex-start" }]}>
      <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
      <Text
        style={[ui.body, { fontWeight: "800", fontVariant: ["tabular-nums"] }]}
      >
        {value}
      </Text>
    </View>
  );
}
