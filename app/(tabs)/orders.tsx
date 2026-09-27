import { useConfirmation } from "@hooks/useConfirmation";
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMyOrders } from "@hooks/useMyOrders";
import { useRiderOperations } from "@hooks/useRiderOperations";
import { useAuthStore } from "@store/useAuthStore";
import { currentScope, sessionKey } from "@services/session";
import { pickupRoute } from "@services/delivery";
import { queueArrival } from "@services/sync";
import { useIncidents } from "@hooks/useIncidents";
import { useSyncQueue } from "@store/useSyncQueue";
import { showToast } from "@store/useToastStore";
import {
  ui,
  Button,
  Badge,
  Chips,
  SearchField,
  QueryNotice,
  OrderCard,
} from "@components/ui/DeliveryUI";
import { customerName, dispatchLabel, matchesSearch } from "@utils/delivery";
import { palette } from "@theme/colors";
import { PageHeading, JourneyOverview } from "@components/ui/DeliveryDesign";
import { IcBike, IcUser } from "@components/ui/icons";
import { Press } from "@components/ui/Press";
const c = palette.dark;
export default function OrdersScreen() {
  const { confirm, dialog } = useConfirmation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useMyOrders();
  const operations = useRiderOperations();
  const incidents = useIncidents();
  const pendingArrival = useSyncQueue((s) => s.items).some(
    (i) => i.owner === currentScope() && i.kind === "arrival",
  );
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const route = query.routes.find((r) => r.id === selected) ?? query.routes[0];
  const next =
    route?.active.find((o) => o.status_tracker_id === 6) ?? route?.active[0];
  const matches = (status: number) =>
    filter === "all" ||
    (filter === "pickup" && [3, 4, 5].includes(status)) ||
    (filter === "route" && status === 6) ||
    (filter === "incident" && status === 12);
  const list = query.active.filter(
    (o) => matches(o.status_tracker_id) && matchesSearch(o, search),
  );
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: sessionKey(currentScope()) });
  };
  const pickup = () => {
    if (!route) return;
    const count = route.stops.filter((o) =>
      [4, 5].includes(o.status_tracker_id),
    ).length;
    confirm(
      "Confirmar recogida",
      `Verifica los ${count} pedidos del viaje #${route.id}: bolsas, bebidas, identificación y observaciones. Confirma que llevas todos los pedidos listos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, iniciar viaje",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await pickupRoute({ routeId: route.id });
              refresh();
              // El servidor puede responder 200 sin sellar nada (viaje ya en camino,
              // paradas no listas): no anunciar éxito si no recogió ninguna.
              const picked = res?.data?.picked?.length ?? 0;
              showToast({
                message: picked
                  ? "Recogida registrada. Buen viaje."
                  : res?.message ||
                    "El servidor no registró ninguna recogida. Revisa el estado del viaje.",
                variant: picked ? "success" : "warning",
              });
            } catch (e: any) {
              showToast({
                message: e.message || "No se pudo iniciar el viaje.",
                variant: "error",
              });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };
  const arrival = async () => {
    setBusy(true);
    try {
      const result = await queueArrival();
      refresh();
      if (!result.queued)
        showToast({
          message: "Llegada registrada. Acércate a caja.",
          variant: "success",
        });
    } catch (e: any) {
      showToast({ message: e.message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };
  const canArrive =
    operations.data?.arrival_tracking_enabled &&
    ["assigned", "delivering"].includes(
      operations.data?.dispatch_status || "",
    ) &&
    !query.active.length &&
    !pendingArrival &&
    operations.data?.capabilities?.arrival_queue;
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <PageHeading
        title="Mis órdenes"
        eyebrow="Cada entrega cuenta"
        icon={<IcBike size={25} color={c.brandMid} />}
        action={
          <Press
            accessibilityLabel="Abrir mi cuenta"
            onPress={() => router.push("/(tabs)/account")}
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              backgroundColor: "#F1E7DC",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IcUser size={17} color={c.brandDeep} />
          </Press>
        }
      />
      <FlatList
        data={list}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={ui.content}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={refresh}
            tintColor={c.brandMid}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 8 }}>
            {!route && (
              <JourneyOverview
                name={user?.use_fullname?.split(" ")[0] || "repartidor"}
                location={operations.data?.location_name || "Tu sucursal"}
                pickup={
                  query.active.filter((o) =>
                    [3, 4, 5].includes(o.status_tracker_id),
                  ).length
                }
                transit={
                  query.active.filter((o) => o.status_tracker_id === 6).length
                }
                incidents={incidents.data?.open_count || 0}
                known={!!query.data}
              />
            )}
            <View style={[ui.between, { flexWrap: "wrap", gap: 8 }]}>
              <Badge
                label={dispatchLabel(operations.data?.dispatch_status)}
                color={c.brandMid}
              />
              <Text style={ui.muted}>
                {query.accepting === null
                  ? "Recepción por confirmar"
                  : query.accepting
                    ? "Caja: recepción activa"
                    : "Caja: recepción pausada"}
              </Text>
            </View>
            <QueryNotice
              error={query.error}
              stale={!!query.data}
              onRetry={refresh}
            />
            {route && (
              <View
                style={[
                  ui.card,
                  {
                    backgroundColor: "#211B17",
                    borderColor: "#211B17",
                    gap: 14,
                  },
                ]}
              >
                <View style={ui.between}>
                  <Text style={[ui.eyebrow, { color: "#FDBA74" }]}>
                    VIAJE #{route.id}
                  </Text>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>
                    {route.done} de {route.stops.length} entregadas
                  </Text>
                </View>
                <View
                  style={{
                    height: 5,
                    backgroundColor: "#4D4238",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 5,
                      width: `${route.stops.length ? (route.done / route.stops.length) * 100 : 0}%`,
                      backgroundColor: "#FB923C",
                    }}
                  />
                </View>
                <Text
                  style={{ fontSize: 21, fontWeight: "800", color: "#fff" }}
                >
                  {route.closed
                    ? "Viaje finalizado"
                    : next
                      ? customerName(next)
                      : "Viaje en revisión"}
                </Text>
                <Text
                  style={{ fontSize: 13, color: "#DED5CD", lineHeight: 20 }}
                >
                  {route.closed
                    ? "Tus entregas quedan disponibles en Historial."
                    : next?.delivery_address ||
                      "Revisa la dirección antes de salir."}
                </Text>
                {!route.closed &&
                route.stops.some((o) =>
                  [4, 5].includes(o.status_tracker_id),
                ) ? (
                  <Button
                    label="Confirmar recogida e iniciar"
                    busy={busy}
                    disabled={!query.compatible}
                    onPress={pickup}
                  />
                ) : next ? (
                  <Button
                    label="Ver próxima entrega"
                    onPress={() => router.push(`/order/${next.id}`)}
                  />
                ) : null}
                {canArrive && (
                  <Button
                    label="Llegué a la sucursal"
                    onPress={arrival}
                    busy={busy}
                  />
                )}
              </View>
            )}
            {query.routes.length > 1 && (
              <Chips
                value={String(route?.id)}
                onChange={(v) => setSelected(Number(v))}
                items={query.routes.map((r) => ({
                  id: String(r.id),
                  label: `Viaje #${r.id}${r.closed ? " · finalizado" : ""}`,
                }))}
              />
            )}
            {canArrive && !route && (
              <Button
                label="Llegué a la sucursal"
                onPress={arrival}
                busy={busy}
              />
            )}
            <View style={ui.row}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  label={`Incidencias${incidents.data ? ` (${incidents.data.open_count})` : ""}`}
                  onPress={() => router.push("/incidents")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  label="Historial"
                  onPress={() => router.push("/(tabs)/history")}
                />
              </View>
            </View>
            {operations.data?.dispatch_status === "awaiting_settlement" && (
              <View style={ui.card}>
                <Text style={ui.sectionTitle}>
                  Siguiente paso: liquidar en caja
                </Text>
                <Text style={ui.body}>
                  Tu llegada está registrada. Revisa los cobros y el fondo de
                  cambio antes de entregarlos.
                </Text>
                <Button
                  label="Revisar mi dinero"
                  onPress={() => router.push("/(tabs)/money")}
                />
              </View>
            )}
            {pendingArrival && (
              <Text style={ui.body}>
                Llegada guardada, pendiente de confirmar con la sucursal.
              </Text>
            )}
            <Text style={ui.muted}>
              Última actualización:{" "}
              {query.dataUpdatedAt
                ? new Date(query.dataUpdatedAt).toLocaleTimeString("es-DO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "pendiente"}
            </Text>
            <SearchField value={search} onChangeText={setSearch} />
            <Chips
              value={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: `Todas · ${query.active.length}` },
                { id: "pickup", label: "Por recoger" },
                { id: "route", label: "En camino" },
                { id: "incident", label: "Con problema" },
              ]}
            />
            <QueryNotice loading={query.isLoading} />
          </View>
        }
        ListEmptyComponent={
          !query.isLoading && !query.error ? (
            <QueryNotice
              empty={
                search || filter !== "all"
                  ? "Sin coincidencias"
                  : "No tienes entregas pendientes"
              }
            />
          ) : null
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
      {dialog}
    </View>
  );
}
