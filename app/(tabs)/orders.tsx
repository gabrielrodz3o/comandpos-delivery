import { useState } from "react";
import { View, Text, FlatList, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMyOrders } from "@hooks/useMyOrders";
import { useRiderOperations } from "@hooks/useRiderOperations";
import { useAuthStore } from "@store/useAuthStore";
import { currentScope, sessionKey } from "@services/session";
import { pickupRoute, reportArrival } from "@services/delivery";
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useMyOrders();
  const operations = useRiderOperations();
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
    Alert.alert(
      "Confirmar recogida",
      `¿Recogiste las ${count} órdenes listas del viaje #${route.id}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, iniciar viaje",
          onPress: async () => {
            setBusy(true);
            try {
              await pickupRoute({ routeId: route.id });
              refresh();
              showToast({
                message: "Recogida registrada. Buen viaje.",
                variant: "success",
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
      await reportArrival();
      refresh();
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
    !query.active.length;
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
              width: 34,
              height: 34,
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
            <JourneyOverview
              name={user?.use_fullname?.split(" ")[0] || "repartidor"}
              location={
                operations.data?.location_name || "Tu centro de entregas"
              }
              pickup={
                query.active.filter((o) =>
                  [3, 4, 5].includes(o.status_tracker_id),
                ).length
              }
              transit={
                query.active.filter((o) => o.status_tracker_id === 6).length
              }
              incidents={
                query.active.filter((o) => o.status_tracker_id === 12).length
              }
              known={!!query.data}
            />
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
            <SearchField value={search} onChangeText={setSearch} />
            <Chips
              value={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: `Todas · ${query.active.length}` },
                { id: "pickup", label: "Por recoger" },
                { id: "route", label: "En camino" },
                { id: "incident", label: "Incidencias" },
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
    </View>
  );
}
