import { api } from "./apiClient";
import { currentScope } from "./session";
import { useAuthStore } from "@store/useAuthStore";
export interface LatLng {
  latitude: number;
  longitude: number;
}
export interface DrivingRoute {
  coordinates: LatLng[];
  distanceKm: number;
  durationSec: number;
  accountIds: number[];
}
const decodePolyline = (encoded: string): LatLng[] => {
  const pts: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
};

/** Authenticated backend proxy calculates routes; the map uses its browser key separately. */
export async function fetchDrivingRoute(
  origin: LatLng,
  accountIds: number[],
  signal?: AbortSignal,
  optimize = false,
): Promise<DrivingRoute | null> {
  if (!accountIds.length) return null;
  const { data } = await api.post(
    "/api/restaurant/delivery/directions",
    {
      location_id: useAuthStore.getState().locationId,
      origin,
      account_ids: accountIds,
      optimize,
    },
    {
      signal,
      deliveryScope: currentScope() || "signed-out",
      skipErrorToast: true,
    },
  );
  if (!data.data) return null;
  return {
    coordinates: decodePolyline(data.data.polyline),
    distanceKm: data.data.distanceKm,
    durationSec: data.data.durationSec,
    accountIds: data.data.account_ids,
  };
}
