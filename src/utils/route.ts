import type { DeliveryOrder } from "@/types/delivery";
export type Point = { lat: number; lng: number };
export function distance(a: Point, b: Point) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function nearbyOrder(start: Point, stops: DeliveryOrder[]) {
  const left = [...stops],
    out: DeliveryOrder[] = [];
  let p = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++)
      if (
        distance(p, {
          lat: Number(left[i].delivery_lat),
          lng: Number(left[i].delivery_lng),
        }) <
        distance(p, {
          lat: Number(left[best].delivery_lat),
          lng: Number(left[best].delivery_lng),
        })
      )
        best = i;
    const [next] = left.splice(best, 1);
    out.push(next);
    p = { lat: Number(next.delivery_lat), lng: Number(next.delivery_lng) };
  }
  return out;
}

/** Oldest ready/assigned order first; missing timestamps are placed last. */
export function oldestFirst(stops: DeliveryOrder[]) {
  const time = (o: DeliveryOrder) =>
    Date.parse(o.ready_at || o.driver_assigned_at || o.created_at || "") ||
    Number.MAX_SAFE_INTEGER;
  return [...stops].sort((a, b) => time(a) - time(b) || a.id - b.id);
}
