/**
 * Google Directions API — ruteo por calles para el mapa del rider.
 *
 * Usa la `google_maps_api_key` de la unidad de negocio (ver useBusinessConfig).
 * El consumo se cobra a la cuenta de Google de cada negocio. Si no hay key,
 * falla la red o la respuesta no es OK, devuelve null → el mapa cae al
 * trazo recto (haversine) sin romperse.
 *
 * Requisito en Google Cloud de cada negocio: "Directions API" habilitada y la
 * key sin restricción de app (o restringida a Directions API).
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface DrivingRoute {
  /** Geometría de la ruta (overview_polyline decodificada). */
  coordinates: LatLng[];
  distanceKm: number;
  durationSec: number;
}

/** Decodifica un encoded polyline de Google a coordenadas. */
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

const fmt = (p: LatLng) => `${p.latitude},${p.longitude}`;

/**
 * Pide a Directions la ruta `origin → ...stops` respetando el orden recibido
 * (NO reordena: el orden ya lo decide la app con nearestNeighbor). Devuelve la
 * geometría por calles + distancia/duración totales, o null si no se pudo.
 */
export const fetchDrivingRoute = async (
  apiKey: string,
  origin: LatLng,
  stops: LatLng[],
): Promise<DrivingRoute | null> => {
  if (!apiKey || stops.length < 1) return null;

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);

  const params = new URLSearchParams({
    origin: fmt(origin),
    destination: fmt(destination),
    mode: 'driving',
    key: apiKey,
  });
  // Directions admite hasta 25 waypoints; el delivery siempre está muy por debajo.
  if (waypoints.length) params.set('waypoints', waypoints.map(fmt).join('|'));

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    const json: any = await res.json();
    if (json.status !== 'OK' || !json.routes?.length) return null;

    const route = json.routes[0];
    const coordinates = decodePolyline(route.overview_polyline?.points ?? '');
    if (!coordinates.length) return null;

    let distanceKm = 0;
    let durationSec = 0;
    for (const leg of route.legs ?? []) {
      distanceKm += (leg.distance?.value ?? 0) / 1000;
      durationSec += leg.duration?.value ?? 0;
    }
    return { coordinates, distanceKm, durationSec };
  } catch {
    return null;
  }
};
