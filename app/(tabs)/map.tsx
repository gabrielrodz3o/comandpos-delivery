import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useMyOrders, MY_ORDERS_KEY } from '@hooks/useMyOrders';
import { groupMine, optimizeRoute, changeStatus } from '@services/delivery';
import { showToast } from '@store/useToastStore';
import { Press } from '@components/ui/Press';
import { IcRoute, IcNavigation, IcMapPin, IcWallet, IcChevronRight, IcX, IcBike, IcCheck } from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import { money } from '@utils/format';
import { STATUS_META, type DeliveryOrder } from '@types/delivery';

const c = palette.dark;

type LL = { lat: number; lng: number };
const coordOf = (o: DeliveryOrder): LL => ({ lat: Number(o.delivery_lat), lng: Number(o.delivery_lng) });
const hasCustody = (o: DeliveryOrder) => ['pending', 'collected', 'partial'].includes(o.rider_collection_status ?? '');

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
  const router = useRouter();
  const qc = useQueryClient();
  const mapRef = useRef<MapView>(null);
  const { active, activeRouteId, tripStarted } = useMyOrders();
  const [me, setMe] = useState<LL | null>(null);
  const [busy, setBusy] = useState(false);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null); // orden optimizado optimista
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);             // modo "salir a entregar" (multi-selección)
  const [picked, setPicked] = useState<Set<number>>(new Set());    // paradas elegidas para marcar En camino

  const stops = useMemo(() => {
    const list = active.filter((o) => o.delivery_lat != null && o.delivery_lng != null);
    if (localOrder) {
      const rank = new Map(localOrder.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    }
    return [...list].sort((a, b) => (a.delivery_route_order ?? 0) - (b.delivery_route_order ?? 0));
  }, [active, localOrder]);
  const distanceKm = useMemo(() => routeDistance(stops, me), [stops, me]);

  const selIdx = stops.findIndex((o) => o.id === selectedId);
  const selected = selIdx >= 0 ? stops[selIdx] : null;

  // Próxima entrega = primera parada no entregada (foco del rider).
  const nextIdx = stops.findIndex((o) => o.status_tracker_id !== 7);
  const nextStop = nextIdx >= 0 ? stops[nextIdx] : null;
  // Paradas que se pueden marcar "En camino" al salir (Lista / Recogida).
  const eligibleIds = useMemo(() => stops.filter((o) => [4, 5].includes(o.status_tracker_id)).map((o) => o.id), [stops]);

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

  /** Marca una parada como "En camino" (salgo hacia esa entrega). */
  const onEnCamino = async (orderId: number) => {
    try {
      await changeStatus(orderId, 6);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({ message: '🛵 En camino a la entrega', variant: 'success' });
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    } catch {
      showToast({ message: 'No se pudo actualizar el estado', variant: 'error' });
    }
  };

  /** Acción principal de una parada según su estado (reutilizada en las tarjetas). */
  const primaryActionFor = (o: DeliveryOrder) => {
    const custody = hasCustody(o);
    if (o.status_tracker_id === 5)
      return { label: 'En camino', icon: <IcBike size={17} color="#fff" />, style: styles.selBtnRoute, chevron: false, onPress: () => onEnCamino(o.id) };
    if (o.status_tracker_id === 6)
      return { label: custody ? 'Cobrar' : 'Entregar', icon: custody ? <IcWallet size={17} color="#fff" /> : <IcCheck size={17} color="#fff" />, style: styles.selBtnDeliver, chevron: true, onPress: () => router.push(`/order/${o.id}`) };
    return { label: 'Ver orden', icon: null, style: styles.selBtnPrimary, chevron: true, onPress: () => router.push(`/order/${o.id}`) };
  };

  // ── Modo "salir a entregar": elegir varias paradas y marcarlas En camino ──
  const enterSelect = () => {
    setSelectedId(null);
    setPicked(new Set(eligibleIds)); // por defecto, todas las elegibles
    setSelectMode(true);
    Haptics.selectionAsync().catch(() => {});
  };
  const exitSelect = () => { setSelectMode(false); setPicked(new Set()); };
  const togglePick = (id: number) => {
    setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    Haptics.selectionAsync().catch(() => {});
  };
  const marcharEnCamino = async () => {
    const ids = [...picked];
    if (!ids.length) return;
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => changeStatus(id, 6)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({ message: `🛵 ${ids.length} entrega${ids.length > 1 ? 's' : ''} En camino`, variant: 'success' });
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
      exitSelect();
    } catch {
      showToast({ message: 'No se pudieron actualizar todas las entregas', variant: 'error' });
    } finally { setBusy(false); }
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
        onPress={() => setSelectedId(null)}
      >
        {linePoints.length > 1 && (
          <Polyline coordinates={linePoints} strokeColor={c.primary} strokeWidth={4.5} lineDashPattern={me ? [1, 0] : undefined} geodesic />
        )}
        {stops.map((o, i) => {
          const done = o.status_tracker_id === 7;
          const enRoute = o.status_tracker_id === 6;
          const eligible = [4, 5].includes(o.status_tracker_id);
          const isPicked = picked.has(o.id);
          const isSel = o.id === selectedId;
          const isNext = !selectMode && nextStop?.id === o.id;
          const color = selectMode
            ? (isPicked ? c.primary : eligible ? c.textMuted : done ? c.success : c.info)
            : done ? c.success : enRoute ? c.info : c.primary;
          const dim = selectMode && eligible && !isPicked;
          return (
            <Marker
              key={o.id}
              coordinate={{ latitude: Number(o.delivery_lat), longitude: Number(o.delivery_lng) }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                if (selectMode) { if (eligible) togglePick(o.id); return; }
                setSelectedId(o.id); Haptics.selectionAsync().catch(() => {});
              }}
              zIndex={isSel || isPicked ? 99 : i}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pinHaloBox, isNext && styles.pinHaloOn]}>
                  <View style={[styles.pin, { backgroundColor: color }, (isSel || isPicked) && styles.pinSel, dim && styles.pinDim]}>
                    {selectMode && isPicked ? <IcCheck size={16} color="#fff" /> : <Text style={styles.pinTxt}>{i + 1}</Text>}
                  </View>
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

      {/* Área inferior: tarjeta de parada (si hay) + panel de ruta */}
      <View style={[styles.bottomWrap, { bottom: insets.bottom + 92 }]}>
        {!selectMode && selected && (() => {
          const sm = STATUS_META[selected.status_tracker_id] ?? { label: '—', color: c.textMuted };
          const selColor = selected.status_tracker_id === 7 ? c.success : selected.status_tracker_id === 6 ? c.info : c.primary;
          const custody = hasCustody(selected);
          return (
            <View style={styles.selCard}>
              <View style={styles.selTop}>
                <View style={[styles.selNum, { backgroundColor: selColor }]}><Text style={styles.selNumTxt}>{selIdx + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selName} numberOfLines={1}>{selected.delivery_contact_name || selected.name || `#${selected.id}`}</Text>
                  <View style={[styles.selBadge, { backgroundColor: sm.color + '1A' }]}>
                    <View style={[styles.selBadgeDot, { backgroundColor: sm.color }]} />
                    <Text style={[styles.selBadgeTxt, { color: sm.color }]}>{sm.label}</Text>
                  </View>
                </View>
                <Press style={styles.selClose} onPress={() => setSelectedId(null)} hitSlop={8} haptic={false}><IcX size={15} color={c.textMuted} /></Press>
              </View>

              {!!selected.delivery_address && (
                <View style={styles.selAddrRow}>
                  <IcMapPin size={14} color={c.textMuted} />
                  <Text style={styles.selAddr} numberOfLines={2}>{selected.delivery_address}</Text>
                </View>
              )}

              {custody && (
                <View style={styles.selCash}>
                  <IcWallet size={15} color={c.warning} />
                  <Text style={styles.selCashLbl}>A cobrar</Text>
                  <Text style={styles.selCashVal}>{money(selected.rider_collection_amount)}</Text>
                </View>
              )}

              <View style={styles.selBtns}>
                <Press
                  style={[styles.selBtn, styles.selBtnGhost]}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.delivery_lat},${selected.delivery_lng}`)}
                  scaleTo={0.97}
                >
                  <IcNavigation size={17} color={c.text} />
                  <Text style={styles.selBtnGhostTxt}>Navegar</Text>
                </Press>

                {(() => {
                  const a = primaryActionFor(selected);
                  return (
                    <Press style={[styles.selBtn, a.style]} onPress={a.onPress} scaleTo={0.97}>
                      {a.icon}
                      <Text style={styles.selBtnPrimaryTxt}>{a.label}</Text>
                      {a.chevron && <IcChevronRight size={18} color="rgba(255,255,255,0.9)" />}
                    </Press>
                  );
                })()}
              </View>
            </View>
          );
        })()}

        {/* Próxima entrega: acción de cobro/entrega siempre a mano (sin tocar el pin). */}
        {!selectMode && !selected && nextStop && (() => {
          const nextColor = nextStop.status_tracker_id === 6 ? c.info : c.primary;
          const custody = hasCustody(nextStop);
          const a = primaryActionFor(nextStop);
          return (
            <View style={styles.nextCard}>
              <View style={styles.nextHead}>
                <View style={[styles.selNum, { backgroundColor: nextColor }]}><Text style={styles.selNumTxt}>{nextIdx + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLbl}>PRÓXIMA ENTREGA</Text>
                  <Text style={styles.selName} numberOfLines={1}>{nextStop.delivery_contact_name || nextStop.name || `#${nextStop.id}`}</Text>
                </View>
                {custody && (
                  <View style={styles.nextCashChip}>
                    <IcWallet size={13} color="#92400E" />
                    <Text style={styles.nextCashTxt}>{money(nextStop.rider_collection_amount)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.selBtns}>
                <Press
                  style={[styles.selBtn, styles.selBtnGhost]}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${nextStop.delivery_lat},${nextStop.delivery_lng}`)}
                  scaleTo={0.97}
                >
                  <IcNavigation size={17} color={c.text} />
                  <Text style={styles.selBtnGhostTxt}>Navegar</Text>
                </Press>
                <Press style={[styles.selBtn, a.style]} onPress={a.onPress} scaleTo={0.97}>
                  {a.icon}
                  <Text style={styles.selBtnPrimaryTxt}>{a.label}</Text>
                  {a.chevron && <IcChevronRight size={18} color="rgba(255,255,255,0.9)" />}
                </Press>
              </View>
            </View>
          );
        })()}

        <View style={styles.panel}>
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

        {selectMode ? (
          <>
            <Text style={styles.selectHint}>Tocá los pines para elegir cuáles salen En camino</Text>
            <View style={styles.btnRow}>
              <Press style={[styles.btn, styles.btnGhost]} onPress={exitSelect} disabled={busy} scaleTo={0.97}>
                <IcX size={18} color={c.text} />
                <Text style={styles.btnGhostTxt}>Cancelar</Text>
              </Press>
              <Press style={[styles.btn, styles.btnPrimary, (busy || picked.size === 0) && styles.btnDisabled]} onPress={marcharEnCamino} disabled={busy || picked.size === 0} scaleTo={0.97}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <IcBike size={19} color="#fff" />}
                <Text style={styles.btnPrimaryTxt}>En camino{picked.size > 0 ? ` (${picked.size})` : ''}</Text>
              </Press>
            </View>
          </>
        ) : (
          <>
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
            {eligibleIds.length > 0 && (
              <Press style={styles.salirBtn} onPress={enterSelect} scaleTo={0.98}>
                <IcBike size={18} color={c.primary} />
                <Text style={styles.salirTxt}>Salir a entregar · marcar varias En camino</Text>
                <IcChevronRight size={17} color={c.primary} />
              </Press>
            )}
          </>
        )}
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
  pinSel: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, transform: [{ translateY: -2 }] },
  pinTxt: { color: '#fff', fontWeight: '900', fontSize: 13.5, fontVariant: ['tabular-nums'] },
  pinTip: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  pinHaloBox: { borderRadius: 24, padding: 0 },
  pinHaloOn: { padding: 5, backgroundColor: c.primary + '33', borderWidth: 1, borderColor: c.primary + '66' },
  pinDim: { opacity: 0.5 },

  // FAB recentrar
  fab: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', ...shadow.md },

  // Área inferior
  bottomWrap: { position: 'absolute', left: 14, right: 14, gap: 10 },

  // Tarjeta de parada seleccionada
  selCard: { backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 15, gap: 12, ...shadow.lg },
  selTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  selNum: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  selNumTxt: { color: '#fff', fontWeight: '900', fontSize: 15, fontVariant: ['tabular-nums'] },
  selName: { fontSize: 16, fontWeight: '800', color: c.text, letterSpacing: -0.2 },
  selBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  selBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  selBadgeTxt: { fontSize: 11, fontWeight: '800' },
  selClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  selAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  selAddr: { flex: 1, fontSize: 13, color: c.textDim, lineHeight: 18 },
  selCash: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE9C8', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  selCashLbl: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  selCashVal: { fontSize: 15, fontWeight: '900', color: '#92400E', fontVariant: ['tabular-nums'] },
  selBtns: { flexDirection: 'row', gap: 10 },
  selBtn: { flex: 1, flexDirection: 'row', gap: 7, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  selBtnGhost: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  selBtnGhostTxt: { color: c.text, fontWeight: '800', fontSize: 14.5 },
  selBtnPrimary: { backgroundColor: c.primary, ...shadow.md, shadowColor: c.primary },
  selBtnRoute: { backgroundColor: c.primary, ...shadow.md, shadowColor: c.primary },
  selBtnDeliver: { backgroundColor: c.success, ...shadow.md, shadowColor: c.success },
  selBtnPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14.5 },

  // Tarjeta "Próxima entrega"
  nextCard: { backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12, ...shadow.lg },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  nextLbl: { fontSize: 10, fontWeight: '900', color: c.primary, letterSpacing: 1, marginBottom: 2 },
  nextCashChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE9C8', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9 },
  nextCashTxt: { fontSize: 13, fontWeight: '900', color: '#92400E', fontVariant: ['tabular-nums'] },

  // Panel
  panel: { backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 14, gap: 12, ...shadow.lg },
  selectHint: { fontSize: 12.5, color: c.textDim, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
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
  btnGhost: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  btnGhostTxt: { color: c.text, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },

  // "Salir a entregar"
  salirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, backgroundColor: c.primaryDim, borderWidth: 1, borderColor: c.primary + '33' },
  salirTxt: { color: c.primary, fontWeight: '800', fontSize: 13.5 },

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
