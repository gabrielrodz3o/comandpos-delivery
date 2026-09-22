import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getMyOrders } from "@services/delivery";
import { currentScope, ordersKey } from "@services/session";
import { useAuthStore } from "@store/useAuthStore";
import { useSyncQueue } from "@store/useSyncQueue";
import { applyPending } from "@services/sync";
import { deriveRoutes, isActive } from "@utils/delivery";
export { MY_ORDERS_KEY } from "@services/queryClient";

export function useMyOrders() {
  const { token, locationId, user, apiBaseUrl } = useAuthStore();
  const scope = currentScope();
  const items = useSyncQueue((s) => s.items);
  const query = useQuery({
    queryKey: ordersKey(scope),
    queryFn: ({ signal }) => getMyOrders(48, signal),
    enabled: !!token && !!user && !!locationId && !!apiBaseUrl,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (query.isSuccess) useSyncQueue.getState().setOnline(true);
  }, [query.isSuccess, query.dataUpdatedAt]);
  const orders = useMemo(
    () => applyPending(query.data?.data ?? [], items, scope),
    [query.data, items, scope],
  );
  const active = orders.filter(isActive);
  const routes = deriveRoutes(orders);
  const route = routes.find((r) => !r.closed) ?? routes[0];
  const routeStops = route?.stops ?? [];
  return {
    ...query,
    orders,
    active,
    routes,
    accepting: query.data?.meta?.accepting_orders ?? null,
    compatible: query.data?.meta?.contract_version === 2,
    activeRouteId: route?.id ?? null,
    routeStops,
    pendingPickup: routeStops.filter((o) =>
      [4, 5].includes(o.status_tracker_id),
    ).length,
    tripStarted: !!route?.inTransit,
  };
}
