import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useMyOrders, MY_ORDERS_KEY } from '@hooks/useMyOrders';
import { groupMine, optimizeRoute } from '@services/delivery';
import { showToast } from '@store/useToastStore';
import { Press } from '@components/ui/Press';
import { IcRoute, IcNavigation, IcMapPin } from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import type { DeliveryOrder } from '@types/delivery';

const c = palette.dark;

type LL = { lat: number; lng: number };
const coordOf = (o: DeliveryOrder): LL => ({ lat: Number(o.delivery_lat), lng: Number(o.delivery_lng) });

/** Distancia haversine en km. */
function haversine(a: LL, b: LL): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Vecino más cercano: reordena las paradas partiendo de `start`. */
function nearestNeighbor(start: LL, pts: DeliveryOrder[]): DeliveryOrder[] {
  const rem = [...pts], out: DeliveryOrder[] = [];
  let cur = start;
  while (rem.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = haversine(cur, coordOf(rem[i]));
      if (d < bd) { bd = d; bi = i; }
    }
    cur = coordOf(rem[bi]);
    out.push(rem.splice(bi, 1)[0]);
  }
  return out;
}

/** Distancia total de un recorrido (opcionalmente desde `start`). */
function routeDistance(stops: DeliveryOrder[], start?: LL | null): number {
  if (stops.length < 1) return 0;
  let total = 0;
  let prev = start ?? coordOf(stops[0]);
  for (const s of stops) { total += haversine(prev, coordOf(s)); prev = coordOf(s); }
  return total;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const { active, activeRouteId, tripStarted } = useMyOrders();
  const [me, setMe] = useState<LL | null>(null);
  const [busy, setBusy] = useState(false);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null); // orden optimizado optimista

  const stops = useMemo(() => {
    const list = active.filter((o) => o.delivery_lat != null && o.delivery_lng != null);
    if (localOrder) {
      const rank = new Map(localOrder.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    }
    return [...list].sort((a, b) => (a.delivery_route_order ?? 0) - (b.delivery_route_order ?? 0));
  }, [active, localOrder]);
  const distanceKm = useMemo(() => routeDistance(stops, me), [stops, me]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  const fitAll = () => {
    const pts = stops.map((o) => ({ latitude: Number(o.delivery_lat), longitude: Number(o.delivery_lng) }));
    if (me) pts.push({ latitude: me.lat, longitude: me.lng });
    if (pts.length && mapRef.current) {
      mapRef.current.fitToCoordinates(pts, { edgePadding: { top: 90, right: 60, bottom: 230, left: 60 }, animated: true });
    }
  };
  useEffect(() => { fitAll(); }, [stops.length, me]);

  /** Obtiene la ubicación actual (la pide en el momento si hace falta). */
  const ensureLocation = async (): Promise<LL | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(ll);
      return ll;
    } catch { return null; }
  };

  const armarRuta = async () => {
    if (stops.length < 2) return showToast({ message: 'Necesitás 2+ entregas con ubicación', variant: 'warning' });
    setBusy(true);
    try {
      // 1) Ubicación actual como punto de partida (la pedimos ahora si falta).
      const start = await ensureLocation();
      if (!start) {
        showToast({ message: 'Activá la ubicación para armar la ruta desde tu posición', variant: 'warning' });
        setBusy(false);
        return;
      }

      // 2) Optimización real (vecino más cercano) + reorden visible al instante.
      const ordered = nearestNeighbor(start, stops);
      const total = routeDistance(ordered, start);
      setLocalOrder(ordered.map((o) => o.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(fitAll, 350);

      // 3) Persistir en el backend (secundario; el mapa ya se actualizó).
      let routeId = activeRouteId;
      if (!routeId) {
        const g = await groupMine(ordered.map((o) => o.id));
        routeId = g?.data?.route_id ?? null;
      }
      if (routeId) {
        await optimizeRoute(
          routeId,
          ordered.map((o, i) => ({ account_id: o.id, order: i + 1 })),
          { total_distance_km: Number(total.toFixed(2)) },
        );
        qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
      }
      showToast({ message: `🧭 Ruta lista · ${ordered.length} paradas · ${total.toFixed(1)} km`, variant: 'success' });
    } catch {
      showToast({ message: 'No se pudo guardar la ruta en el servidor', variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const navigateAll = () => {
    if (!stops.length) return;
    const dest = `${stops[stops.length - 1].delivery_lat},${stops[stops.length - 1].delivery_lng}`;
    const wp = stops.slice(0, -1).map((o) => `${o.delivery_lat},${o.delivery_lng}`).join('|');
    const wpParam = wp ? `&waypoints=${wp}` : '';
    Linking.openURL(`https://www.google.com/maps/dir/?api=1${wpParam}&destination=${dest}`);
  };

  const initialRegion: Region = {
    latitude: stops[0] ? Number(stops[0].delivery_lat) : me?.lat ?? 19.4517,
    longitude: stops[0] ? Number(stops[0].delivery_lng) : me?.lng ?? -70.697,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const linePoints = [
    ...(me ? [{ latitude: me.lat, longitude: me.lng }] : []),
    ...stops.map((o) => ({ latitude: Number(o.delivery_lat), longitude: Number(o.delivery_lng) })),
  ];

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={MAP_STYLE}
      >
        {linePoints.length > 1 && (
          <Polyline coordinates={linePoints} strokeColor={c.primary} strokeWidth={4.5} lineDashPattern={me ? [1, 0] : undefined} geodesic />
        )}
        {stops.map((o, i) => {
          const done = o.status_tracker_id === 7;
          const enRoute = o.status_tracker_id === 6;
          const color = done ? c.success : enRoute ? c.info : c.primary;
          return (
            <Marker
              key={o.id}
              coordinate={{ latitude: Number(o.delivery_lat), longitude: Number(o.delivery_lng) }}
              title={`${i + 1}. ${o.delivery_contact_name || o.name || '#' + o.id}`}
              description={o.delivery_address ?? ''}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pin, { backgroundColor: color }]}>
                  <Text style={styles.pinTxt}>{i + 1}</Text>
                </View>
                <View style={[styles.pinTip, { borderTopColor: color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Recentrar */}
      <Press style={[styles.fab, { top: insets.top + 12 }]} onPress={fitAll} scaleTo={0.92}>
        <IcNavigation size={20} color={c.text} />
      </Press>

      {/* Panel inferior */}
      <View style={[styles.panel, { bottom: insets.bottom + 92 }]}>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <IcMapPin size={16} color={c.primary} />
            <Text style={styles.summaryVal}>{stops.length}</Text>
            <Text style={styles.summaryLbl}>parada{stops.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.summaryDot} />
          <View style={styles.summaryItem}>
            <IcRoute size={16} color={c.primary} />
            <Text style={styles.summaryVal}>{distanceKm.toFixed(1)}</Text>
            <Text style={styles.summaryLbl}>km</Text>
          </View>
          {tripStarted && (
            <>
              <View style={styles.summaryDot} />
              <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveTxt}>EN CAMINO</Text></View>
            </>
          )}
        </View>

        <View style={styles.btnRow}>
          <Press style={[styles.btn, styles.btnPrimary, (busy || stops.length < 2) && styles.btnDisabled]} onPress={armarRuta} disabled={busy || stops.length < 2} scaleTo={0.97}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <IcRoute size={19} color="#fff" />}
            <Text style={styles.btnPrimaryTxt}>{busy ? 'Optimizando…' : 'Armar ruta'}</Text>
          </Press>
          <Press style={[styles.btn, styles.btnNav, !stops.length && styles.btnDisabled]} onPress={navigateAll} disabled={!stops.length} scaleTo={0.97}>
            <IcNavigation size={19} color="#fff" />
            <Text style={styles.btnNavTxt}>Navegar</Text>
          </Press>
        </View>
      </View>

      {stops.length === 0 && (
        <View style={[styles.empty, { top: insets.top + 76 }]}>
          <View style={styles.emptyArt}><IcMapPin size={26} color={c.primary} /></View>
          <Text style={styles.emptyTitle}>Sin paradas en el mapa</Text>
          <Text style={styles.emptyTxt}>Tus entregas con ubicación aparecen acá para armar la ruta.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  // Marcadores
  pinWrap: { alignItems: 'center' },
  pin: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.md },
  pinTxt: { color: '#fff', fontWeight: '900', fontSize: 13.5, fontVariant: ['tabular-nums'] },
  pinTip: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },

  // FAB recentrar
  fab: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', ...shadow.md },

  // Panel
  panel: { position: 'absolute', left: 14, right: 14, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12, ...shadow.lg },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryVal: { fontSize: 16, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], marginLeft: 1 },
  summaryLbl: { fontSize: 13, color: c.textDim, fontWeight: '600' },
  summaryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.borderHi },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EAF6EE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.success },
  liveTxt: { fontSize: 10, fontWeight: '900', color: c.success, letterSpacing: 1 },

  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 15, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: c.primary, ...shadow.md, shadowColor: c.primary },
  btnPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnNav: { backgroundColor: c.info, ...shadow.md, shadowColor: c.info },
  btnNavTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },

  // Empty
  empty: { position: 'absolute', alignSelf: 'center', alignItems: 'center', backgroundColor: c.surface, paddingHorizontal: 24, paddingVertical: 20, borderRadius: 20, borderWidth: 1, borderColor: c.border, marginHorizontal: 24, ...shadow.md },
  emptyArt: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  emptyTxt: { fontSize: 13, color: c.textDim, textAlign: 'center', marginTop: 5, lineHeight: 18 },
});

/** Estilo de mapa cálido y desaturado, acorde a la identidad. */
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f7f4ef' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6258' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#faf8f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6ecdf' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f3ede4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fcd9b8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe3e8' }] },
];
