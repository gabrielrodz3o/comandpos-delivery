import type { DeliveryOrder } from "@/types/delivery";

export const isActive = (o: DeliveryOrder) =>
  [3, 4, 5, 6, 12].includes(Number(o.status_tracker_id));
export const isClosed = (o: DeliveryOrder) =>
  [7, 8, 9, 10, 11].includes(Number(o.status_tracker_id));
export const hasCoordinates = (o: DeliveryOrder) =>
  o.delivery_lat != null &&
  o.delivery_lng != null &&
  Number.isFinite(Number(o.delivery_lat)) &&
  Number.isFinite(Number(o.delivery_lng)) &&
  Math.abs(Number(o.delivery_lat)) <= 90 &&
  Math.abs(Number(o.delivery_lng)) <= 180;
export const customerName = (o: DeliveryOrder) =>
  o.delivery_contact_name || o.name || `Orden #${o.id}`;
export const dueAmount = (o: DeliveryOrder): number | null =>
  o.amount_due != null && Number.isFinite(Number(o.amount_due))
    ? Number(o.amount_due)
    : null;
export const matchesSearch = (o: DeliveryOrder, search: string) =>
  `${o.id} ${o.name || ""} ${o.delivery_contact_name || ""} ${o.delivery_address || ""}`
    .toLocaleLowerCase()
    .includes(search.trim().toLocaleLowerCase());
export const collectionLabel = (o: DeliveryOrder) => {
  if (o.pending_sync) return "Pendiente de sincronizar";
  if (o.rider_collection_status === "settled") return "Liquidada en caja";
  if (o.rider_collection_status === "cancelled") return "Custodia cancelada";
  if (
    o.status_tracker_id === 7 &&
    o.rider_collection_id &&
    (dueAmount(o) ?? 0) > 0
  )
    return "Pendiente de liquidar";
  if (dueAmount(o) === 0) return "Sin saldo pendiente";
  return (
    o.expected_payment_type_name ||
    (o.rider_collection_id ? "Cobro por confirmar" : "Sin custodia de cobro")
  );
};

export function deriveRoutes(orders: DeliveryOrder[]) {
  const groups = new Map<number, DeliveryOrder[]>();
  for (const order of orders)
    if (order.delivery_route_id) {
      const list = groups.get(order.delivery_route_id) || [];
      list.push(order);
      groups.set(order.delivery_route_id, list);
    }
  return [...groups]
    .map(([id, stops]) => {
      stops.sort(
        (a, b) =>
          (a.delivery_route_order ?? 999) - (b.delivery_route_order ?? 999),
      );
      return {
        id,
        stops,
        active: stops.filter(isActive),
        done: stops.filter((o) => o.status_tracker_id === 7).length,
        closed: stops.every(isClosed),
        inTransit: stops.some((o) => o.status_tracker_id === 6),
        latest: Math.max(
          ...stops.map(
            (o) =>
              Date.parse(
                o.completed_at || o.updated_at || o.created_at || "",
              ) || 0,
          ),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(a.closed) - Number(b.closed) ||
        Number(b.inTransit) - Number(a.inTransit) ||
        b.latest - a.latest,
    );
}

export const dateTime = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("es-DO", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Fecha pendiente";
export const dayLabel = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString("es-DO", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "Fecha pendiente";
export const dispatchLabel = (value?: string | null) =>
  ({
    available: "Disponible para despacho",
    assigned: "Con órdenes asignadas",
    delivering: "En ruta",
    awaiting_settlement: "Pendiente de liquidación",
    unavailable: "Recepción pausada",
  })[value || ""] || "Estado por confirmar";
