import { api } from './apiClient';
import type { MyOrdersResponse } from '@types/delivery';

/** Órdenes del rider autenticado (scoped server-side). */
export const getMyOrders = async (hours = 48): Promise<MyOrdersResponse> => {
  const { data } = await api.get<MyOrdersResponse>('/api/restaurant/delivery/my-orders', {
    params: { hours },
  });
  return data;
};

/** Iniciar viaje: recoge todo (picked_up_at + En camino). */
export const pickupRoute = (opts: { routeId?: number; accountId?: number }) =>
  api
    .post('/api/restaurant/delivery/route/pickup', { route_id: opts.routeId, account_id: opts.accountId })
    .then((r) => r.data);

/** Agrupar órdenes ya asignadas en un viaje (al vuelo). */
export const groupMine = (accountIds: number[]) =>
  api.post('/api/restaurant/delivery/route/group-mine', { account_ids: accountIds }).then((r) => r.data);

/** Guardar la secuencia óptima de paradas. */
export const optimizeRoute = (
  routeId: number,
  stops: { account_id: number; order: number }[],
  totals?: { total_distance_km?: number; total_duration_seconds?: number },
) => api.post('/api/restaurant/delivery/route/optimize', { route_id: routeId, stops, ...totals }).then((r) => r.data);

/** Cambiar estado de una orden (ej. 5→6 En camino). */
export const changeStatus = (accountId: number, statusId: number) =>
  api
    .post('/api/restaurant/tables/update-account-status', {
      account_id: accountId,
      status_tracker_id: statusId,
    })
    .then((r) => r.data);

/** Marcar entregada (status 7). */
export const markDelivered = (accountId: number, locationId: number, userId: number) =>
  api
    .post('/api/restaurant/order/mark-delivery-completed', {
      account_id: accountId,
      location_id: locationId,
      user_id: userId,
    })
    .then((r) => r.data);

/** Disponibilidad del rider (recibir / no recibir nuevos pedidos). */
export const setAvailability = (accepting: boolean) =>
  api.post('/api/restaurant/delivery/availability', { accepting }).then((r) => r.data);
