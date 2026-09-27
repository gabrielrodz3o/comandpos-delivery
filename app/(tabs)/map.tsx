import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { useMyOrders } from "@hooks/useMyOrders";
import { useBusinessConfig } from "@hooks/useBusinessConfig";
import { currentScope, sessionKey } from "@services/session";
import { optimizeRoute, groupMine } from "@services/delivery";
import { fetchDrivingRoute, type DrivingRoute } from "@services/directions";
import { showToast } from "@store/useToastStore";
import MapWeb, {
  type MapWebHandle,
  type MapScene,
} from "@components/map/MapWeb";
import {
  ui,
  Button,
  Chips,
  QueryNotice,
  OrderCard,
} from "@components/ui/DeliveryUI";
import { hasCoordinates, isActive, customerName } from "@utils/delivery";
import { nearbyOrder, oldestFirst, type Point } from "@utils/route";
import { navigateOrder } from "@utils/contact";
import { palette } from "@theme/colors";
import { IconAction, RouteArt } from "@components/ui/DeliveryDesign";
import { Press } from "@components/ui/Press";
import {
  IcNavigation,
  IcMapPin,
  IcRoute,
  IcChevronRight,
  IcClock,
} from "@components/ui/icons";
const c = palette.dark;
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F4EFE7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#82776B" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F7F3ED" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E9DFD1" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#F3DEC1" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#CDDEE2" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#E5EACF" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = useState(window.height - 90);
  const [expanded, setExpanded] = useState(false);
  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderRelease: (_, g) => {
          if (g.dy < -25) setExpanded(true);
          if (g.dy > 25) setExpanded(false);
        },
      }),
    [],
  );
  const router = useRouter();
  const qc = useQueryClient();
  const query = useMyOrders();
  const business = useBusinessConfig();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [me, setMe] = useState<Point | null>(null);
  const [locationError, setLocationError] = useState("");
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [road, setRoad] = useState<DrivingRoute | null>(null);
  const [roadLoading, setRoadLoading] = useState(false);
  const [routeStrategy, setRouteStrategy] = useState("roads");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const mapRef = useRef<MapWebHandle>(null);
  const ungrouped = query.active.filter((o) => !o.delivery_route_id);
  const choices = [
    ...query.routes
      .filter((r) => !r.closed)
      .map((r) => ({ id: String(r.id), label: `Viaje #${r.id}` })),
    ...(ungrouped.length ? [{ id: "loose", label: "Sin agrupar" }] : []),
  ];
  const routeId = choices.some((x) => x.id === selectedRoute)
    ? selectedRoute
    : choices[0]?.id;
  const route = query.routes.find((r) => String(r.id) === routeId);
  const all = route?.stops ?? (routeId === "loose" ? ungrouped : []);
  const active = all.filter(isActive);
  const mapped = all.filter(hasCoordinates);
  const missing = active.filter((o) => !hasCoordinates(o));
  const next = active.find((o) => o.status_tracker_id === 6) ?? active[0];
  const selected = all.find((o) => o.id === selectedId) ?? next;
  const panelHeight = expanded
    ? Math.max(250, Math.round(availableHeight * 0.62))
    : Math.min(active.length ? 290 : 210, availableHeight * 0.46);
  const mapPaddingTop = insets.top + (choices.length > 1 ? 148 : 96);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let sub: Location.LocationSubscription | undefined;
      setFocused(true);
      (async () => {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!alive) return;
          if (!permission.granted) {
            setLocationError(
              "Permite la ubicación para calcular la ruta desde tu posición.",
            );
            return;
          }
          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 50,
              timeInterval: 15000,
            },
            (p) => {
              if (alive) {
                setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
                setLocationError("");
              }
            },
          );
          if (!alive) sub.remove();
        } catch {
          if (alive)
            setLocationError(
              "No se pudo obtener tu ubicación. Puedes navegar usando la dirección.",
            );
        }
      })();
      return () => {
        alive = false;
        sub?.remove();
        setFocused(false);
      };
    }, [locationAttempt]),
  );
  const coordsKey = active
    .filter(hasCoordinates)
    .map((o) => `${o.id}:${o.delivery_lat}:${o.delivery_lng}`)
    .join("|");
  useEffect(() => {
    const abort = new AbortController();
    setRoad(null);
    const stops = active.filter(hasCoordinates).map((o) => ({
      latitude: Number(o.delivery_lat),
      longitude: Number(o.delivery_lng),
    }));
    if (
      !focused ||
      !business.config?.directions_available ||
      !me ||
      !stops.length
    ) {
      setRoadLoading(false);
      return;
    }
    setRoadLoading(true);
    fetchDrivingRoute(
      { latitude: me.lat, longitude: me.lng },
      active.filter(hasCoordinates).map((o) => o.id),
      abort.signal,
    )
      .then((result) => {
        if (!abort.signal.aborted) {
          setRoad(result);
          setRoadLoading(false);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setRoad(null);
          setRoadLoading(false);
        }
      });
    return () => abort.abort();
  }, [
    business.config?.directions_available,
    me ? Math.round(me.lat * 300) : null,
    me ? Math.round(me.lng * 300) : null,
    coordsKey,
    focused,
  ]);
  const scene: MapScene = useMemo(
    () => ({
      center: me ?? {
        lat: mapped[0] ? Number(mapped[0].delivery_lat) : 19.45,
        lng: mapped[0] ? Number(mapped[0].delivery_lng) : -70.69,
      },
      me,
      padding: { top: mapPaddingTop, right: 38, bottom: 35, left: 38 },
      stops: mapped.map((o) => ({
        id: o.id,
        lat: Number(o.delivery_lat),
        lng: Number(o.delivery_lng),
        label: String(all.findIndex((s) => s.id === o.id) + 1),
        color:
          o.status_tracker_id === 7
            ? c.success
            : o.id === selected?.id
              ? c.brandMid
              : c.text,
        size: o.id === selected?.id ? 38 : 30,
        halo: o.id === next?.id,
        check: o.status_tracker_id === 7,
      })),
      line:
        road?.coordinates.map((p) => ({ lat: p.latitude, lng: p.longitude })) ??
        active.filter(hasCoordinates).map((o) => ({
          lat: Number(o.delivery_lat),
          lng: Number(o.delivery_lng),
        })),
      dashed: !road,
    }),
    [
      coordsKey,
      me,
      road,
      selected?.id,
      mapPaddingTop,
      all.map((o) => `${o.id}:${o.status_tracker_id}`).join("|"),
    ],
  );
  const reorder = async () => {
    if (!me)
      return showToast({
        message: "Activa tu ubicación para ordenar las paradas.",
        variant: "warning",
      });
    if (missing.length)
      return showToast({
        message:
          "Hay órdenes sin ubicación. Confirma sus direcciones con caja.",
        variant: "warning",
      });
    if (active.length > 10)
      return showToast({
        message: "Un viaje admite hasta 10 órdenes.",
        variant: "warning",
      });
    if (active.some((o) => o.status_tracker_id === 12))
      return showToast({
        message: "Resuelve las incidencias con caja antes de reorganizar.",
        variant: "warning",
      });
    setBusy(true);
    try {
      let ordered =
        routeStrategy === "oldest"
          ? oldestFirst(active)
          : nearbyOrder(me, active);
      let optimized: DrivingRoute | null = null;
      if (business.config?.directions_available) {
        optimized = await fetchDrivingRoute(
          { latitude: me.lat, longitude: me.lng },
          ordered.map((o) => o.id),
          undefined,
          routeStrategy === "roads",
        );
        if (optimized)
          ordered = optimized.accountIds.map((id) =>
            active.find((o) => o.id === id)!,
          );
      }
      let id = route?.id;
      if (!id) id = (await groupMine(ordered.map((o) => o.id)))?.data?.route_id;
      if (!id) throw new Error("No se confirmó la creación del viaje.");
      const closed = all.filter((o) => !isActive(o));
      const stops = [...closed, ...ordered];
      await optimizeRoute(
        id,
        stops.map((o, i) => ({ account_id: o.id, order: i + 1 })),
        optimized
          ? {
              total_distance_km: optimized.distanceKm,
              total_duration_seconds: Math.round(optimized.durationSec),
            }
          : undefined,
      );
      await qc.invalidateQueries({ queryKey: sessionKey(currentScope()) });
      setSelectedRoute(String(id));
      showToast({
        message:
          routeStrategy === "oldest"
            ? "Paradas guardadas por antigüedad."
            : optimized
              ? "Paradas ordenadas por recorrido en calles."
              : "Paradas ordenadas por cercanía estimada.",
        variant: "success",
      });
    } catch (e: any) {
      showToast({
        message: e.message || "No se pudo guardar el recorrido.",
        variant: "error",
      });
      await query.refetch();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={ui.page}
      onLayout={(e) => setAvailableHeight(e.nativeEvent.layout.height)}
    >
      <View style={[StyleSheet.absoluteFill, { bottom: panelHeight }]}>
        <MapWeb
          ref={mapRef}
          apiKey={business.googleMapsApiKey}
          scene={scene}
          mapStyle={MAP_STYLE}
          onMarkerPress={(id) => {
            setSelectedId(id);
            setExpanded(false);
          }}
          onMapPress={() => setSelectedId(null)}
        />
      </View>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          gap: 10,
        }}
      >
        <View style={mapStyles.topbar}>
          <View style={mapStyles.brandIcon}>
            <IcRoute size={24} color="#B84D19" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={mapStyles.kicker}>COMANDPOS / DELIVERY</Text>
            <Text style={mapStyles.title}>Tu recorrido</Text>
          </View>
          <View style={mapStyles.count}>
            <Text style={mapStyles.countValue}>{active.length}</Text>
            <Text style={mapStyles.countLabel}>
              {active.length === 1 ? "PARADA" : "PARADAS"}
            </Text>
          </View>
        </View>
        {choices.length > 1 && (
          <Chips
            items={choices}
            value={routeId || ""}
            onChange={(v) => {
              setSelectedRoute(v);
              setSelectedId(null);
            }}
          />
        )}
      </View>
      <View
        style={{
          position: "absolute",
          right: 18,
          bottom: panelHeight + 34,
          gap: 10,
        }}
      >
        <IconAction
          label="Centrar mi recorrido"
          onPress={() => mapRef.current?.fit()}
        >
          <IcNavigation size={21} color={c.brandMid} />
        </IconAction>
      </View>
      <View style={[mapStyles.sheet, { height: panelHeight }]}>
        <View {...sheetPan.panHandlers}>
          <Press
            accessibilityLabel={
              expanded ? "Mostrar más mapa" : "Mostrar todas las paradas"
            }
            onPress={() => setExpanded((v) => !v)}
            style={mapStyles.sheetHandle}
          >
            <View style={mapStyles.grip} />
            <View style={ui.between}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: active.length ? "#DF691F" : "#BBA893",
                  }}
                />
                <Text style={[mapStyles.sheetTitle, { flex: 1 }]}>
                  {active.length
                    ? route
                      ? `Viaje #${route.id}`
                      : "Tus entregas"
                    : "Tu próxima ruta"}
                </Text>
              </View>
              <Text style={mapStyles.expandText}>
                {expanded ? "Ver mapa" : "Ver paradas"} {expanded ? "⌄" : "⌃"}
              </Text>
            </View>
          </Press>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
        >
          <QueryNotice
            loading={query.isLoading}
            error={query.error}
            stale={!!query.data}
            onRetry={() => void query.refetch()}
          />
          {!!locationError && (
            <View style={mapStyles.note}>
              <Text style={[ui.muted, { flex: 1 }]}>{locationError}</Text>
              <Press
                accessibilityLabel="Reintentar ubicación"
                onPress={() => setLocationAttempt((v) => v + 1)}
                style={{ padding: 8 }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: c.brandMid }}
                >
                  Reintentar
                </Text>
              </Press>
            </View>
          )}
          {!!active.length && (
            <>
              <View style={mapStyles.metrics}>
                <View style={mapStyles.metric}>
                  <IcMapPin size={15} color="#956340" />
                  <Text style={mapStyles.metricText}>
                    {active.length}{" "}
                    {active.length === 1 ? "pendiente" : "pendientes"}
                  </Text>
                </View>
                <View style={mapStyles.metricDivider} />
                <View style={mapStyles.metric}>
                  <IcClock size={15} color="#956340" />
                  {roadLoading ? (
                    <ActivityIndicator size="small" color={c.brandMid} />
                  ) : (
                    <Text style={mapStyles.metricText}>
                      {road
                        ? `${road.distanceKm.toFixed(1)} km · ${Math.max(1, Math.ceil(road.durationSec / 60))} min`
                        : "Sin estimación"}
                    </Text>
                  )}
                </View>
              </View>
              {selected && (
                <>
                  <Press
                    accessibilityLabel={`Abrir entrega ${selected.id}`}
                    onPress={() => router.push(`/order/${selected.id}`)}
                    style={{ gap: 5 }}
                  >
                    <Text style={ui.eyebrow}>
                      {selected.id === next?.id
                        ? "PRÓXIMA ENTREGA"
                        : "PARADA SELECCIONADA"}{" "}
                      · #{selected.id}
                    </Text>
                    <View style={ui.between}>
                      <Text
                        style={[ui.sectionTitle, { flex: 1, fontSize: 21 }]}
                        numberOfLines={1}
                      >
                        {customerName(selected)}
                      </Text>
                      <IcChevronRight size={20} color={c.brandMid} />
                    </View>
                    <Text
                      style={ui.muted}
                      numberOfLines={expanded ? undefined : 2}
                    >
                      {selected.delivery_address || "Dirección por confirmar"}
                    </Text>
                  </Press>
                  <Button
                    label={
                      hasCoordinates(selected) || selected.delivery_address
                        ? "Navegar a esta entrega"
                        : "Consultar entrega"
                    }
                    icon={
                      hasCoordinates(selected) || selected.delivery_address ? (
                        <IcNavigation size={18} color="#fff" />
                      ) : (
                        <IcChevronRight size={18} color="#fff" />
                      )
                    }
                    onPress={() =>
                      hasCoordinates(selected) || selected.delivery_address
                        ? navigateOrder(selected)
                        : router.push(`/order/${selected.id}`)
                    }
                  />
                </>
              )}
              {expanded && (
                <>
                  <Text style={ui.muted}>
                    {road
                      ? "Tiempo estimado del recorrido por calles."
                      : "El trazo une las ubicaciones; el recorrido por calles no está disponible."}
                  </Text>
                  {active.length > 1 && (
                    <Chips
                      value={routeStrategy}
                      onChange={setRouteStrategy}
                      items={[
                        { id: "roads", label: "Por recorrido" },
                        { id: "oldest", label: "Más antiguos primero" },
                      ]}
                    />
                  )}
                  {active.length > 1 && (
                    <Button
                      secondary
                      label="Guardar orden de paradas"
                      busy={busy}
                      disabled={
                        !query.compatible ||
                        missing.length > 0 ||
                        active.length > 10
                      }
                      onPress={reorder}
                    />
                  )}
                  {!!missing.length && (
                    <View style={mapStyles.note}>
                      <IcMapPin size={20} color="#B87525" />
                      <Text style={[ui.muted, { flex: 1 }]}>
                        {missing.length} orden(es) sin ubicación. Abre el
                        detalle para consultar su dirección.
                      </Text>
                    </View>
                  )}
                  {active.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      position={all.findIndex((x) => x.id === o.id) + 1}
                    />
                  ))}
                </>
              )}
            </>
          )}
          {!active.length && !query.isLoading && !query.error && (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                paddingVertical: 8,
              }}
            >
              <RouteArt width={95} />
              <View style={{ flex: 1, gap: 7 }}>
                <Text style={ui.sectionTitle}>Sin paradas pendientes</Text>
                <Text style={ui.muted}>
                  Cuando caja te asigne entregas, podrás seguir todo el
                  recorrido desde aquí.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 22,
    backgroundColor: "#FFFFFFF5",
    borderWidth: 1,
    borderColor: "#E9E0D5",
    shadowColor: "#2B2015",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  brandIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0DE",
  },
  kicker: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#947459",
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.7,
    color: c.text,
  },
  count: {
    alignItems: "center",
    paddingHorizontal: 9,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#EDE5DA",
    gap: 1,
  },
  countValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#A94617",
    fontVariant: ["tabular-nums"],
  },
  countLabel: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: "#A08269",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    shadowColor: "#2B2015",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.11,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#EBE2D7",
  },
  sheetHandle: {
    paddingHorizontal: 21,
    paddingTop: 9,
    paddingBottom: 17,
    gap: 14,
    minHeight: 65,
  },
  grip: {
    width: 35,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DCD1C4",
    alignSelf: "center",
  },
  sheetTitle: { fontSize: 14, fontWeight: "800", color: c.text },
  expandText: { fontSize: 11, fontWeight: "800", color: "#A85427" },
  metrics: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    backgroundColor: "#FAF5EE",
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 13,
  },
  metric: { flexDirection: "row", gap: 6, alignItems: "center" },
  metricText: { fontSize: 11, fontWeight: "700", color: "#755137" },
  metricDivider: { width: 1, height: 15, backgroundColor: "#E4D6C3" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF7E9",
  },
});
