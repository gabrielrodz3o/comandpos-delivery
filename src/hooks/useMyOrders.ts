import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { getMyOrders } from '@services/delivery';
import { onRiderUpdate, connectRiderSocket } from '@services/socket';
import type { DeliveryOrder } from '@types/delivery';

export const MY_ORDERS_KEY = ['my-orders'];

export function useMyOrders() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: MY_ORDERS_KEY,
    queryFn: async () => (await getMyOrders(48)),
    refetchInterval: 120_000, // fallback lento; el socket es el primario
  });

  // Realtime: cada rider_order_update refresca + vibra.
  useEffect(() => {
    connectRiderSocket();
    const off = onRiderUpdate((payload) => {
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
      if (payload?.reason === 'assigned') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    });
    return off;
  }, [qc]);

  const orders: DeliveryOrder[] = query.data?.data ?? [];
  const accepting = query.data?.meta?.accepting_orders ?? null;

  // Solo activas (status 3..6)
  const active = orders.filter((o) => [3, 4, 5, 6].includes(o.status_tracker_id));

  // Viaje activo (comparten delivery_route_id)
  const routeOrders = active.filter((o) => o.delivery_route_id);
  const activeRouteId = routeOrders[0]?.delivery_route_id ?? null;
  const routeStops = activeRouteId
    ? active
        .filter((o) => o.delivery_route_id === activeRouteId)
        .sort((a, b) => (a.delivery_route_order ?? 0) - (b.delivery_route_order ?? 0))
    : [];
  const pendingPickup = routeStops.filter((o) => Number(o.status_tracker_id) < 6).length;

  return {
    ...query,
    orders,
    active,
    accepting,
    activeRouteId,
    routeStops,
    pendingPickup,
    tripStarted: !!activeRouteId && pendingPickup === 0,
  };
}
