import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { getHistory } from "@services/delivery";
import { currentScope, sessionKey } from "@services/session";
import { useAuthStore } from "@store/useAuthStore";
import {
  ui,
  Button,
  Chips,
  SearchField,
  QueryNotice,
  OrderCard,
} from "@components/ui/DeliveryUI";
import { dayLabel, matchesSearch } from "@utils/delivery";
import { useMyOrders } from "@hooks/useMyOrders";
import { PageHeading } from "@components/ui/DeliveryDesign";
import { IcReceipt, IcClock } from "@components/ui/icons";
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const scope = currentScope();
  const operational = useMyOrders();
  const [days, setDays] = useState("1");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const today = new Date().toDateString();
  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (Number(days) - 1));
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days, today]);
  const query = useInfiniteQuery({
    queryKey: sessionKey(scope, "history", range, filter, term),
    enabled: !!token,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getHistory(
        { ...range, offset: pageParam, search: term, status: filter },
        signal,
      ),
    getNextPageParam: (last) => last.next_offset ?? undefined,
  });
  // La pestaña no se desmonta al navegar y esta consulta no tiene refetchInterval:
  // sin esto, una entrega recién completada no aparece hasta hacer pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const localDeliveries = operational.orders.filter(
    (o) =>
      o.pending_sync &&
      ["all", "delivered"].includes(filter) &&
      matchesSearch(o, term) &&
      (o.completed_at || "") >= range.from &&
      (o.completed_at || "") < range.to,
  );
  const orders = [
    ...new Map(
      [
        ...(query.data?.pages.flatMap((p) => p.data) || []),
        ...localDeliveries,
      ].map((o) => [o.id, o]),
    ).values(),
  ].sort(
    (a, b) =>
      Date.parse(b.activity_at || b.completed_at || "") -
      Date.parse(a.activity_at || a.completed_at || ""),
  );
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <PageHeading
        title="Historial"
        eyebrow="El recorrido de tu jornada"
        subtitle="Entregas y cobros, con cada detalle a mano."
        icon={<IcReceipt size={25} color="#B65D28" />}
      />
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={ui.content}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <Chips
              value={days}
              onChange={setDays}
              items={[
                { id: "1", label: "Hoy" },
                { id: "7", label: "7 días" },
                { id: "30", label: "30 días" },
              ]}
            />
            <SearchField value={search} onChangeText={setSearch} />
            <Chips
              value={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: "Todas" },
                { id: "delivered", label: "Entregadas" },
                { id: "cancelled", label: "Canceladas" },
                { id: "incidents", label: "Incidencias" },
              ]}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingTop: 7,
                paddingBottom: 4,
              }}
            >
              <IcClock size={15} color="#A07D61" />
              <Text style={[ui.muted, { fontWeight: "700" }]}>
                {query.data
                  ? `${orders.length} ${orders.length === 1 ? "orden" : "órdenes"} en esta vista`
                  : "Historial por cargar"}
                {query.hasNextPage ? " · hay más resultados" : ""}
              </Text>
              <View
                style={{
                  height: 1,
                  flex: 1,
                  backgroundColor: "#E8DFD4",
                  marginLeft: 6,
                }}
              />
            </View>
            <QueryNotice
              loading={query.isLoading}
              error={query.error}
              stale={!!query.data}
              onRetry={() => void query.refetch()}
            />
          </View>
        }
        ListEmptyComponent={
          !query.isLoading && !query.error ? (
            <QueryNotice empty="No hay órdenes en este período" />
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <View style={{ marginTop: 16 }}>
              <Button
                secondary
                label="Cargar más órdenes"
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const day = dayLabel(item.activity_at || item.completed_at);
          const previous = index
            ? dayLabel(
                orders[index - 1].activity_at || orders[index - 1].completed_at,
              )
            : null;
          return (
            <View style={{ gap: 10 }}>
              {day !== previous && <Text style={ui.eyebrow}>{day}</Text>}
              <OrderCard order={item} history />
            </View>
          );
        }}
      />
    </View>
  );
}
