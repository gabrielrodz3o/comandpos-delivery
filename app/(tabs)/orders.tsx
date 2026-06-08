import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMyOrders, MY_ORDERS_KEY } from '@hooks/useMyOrders';
import { pickupRoute } from '@services/delivery';
import { showToast } from '@store/useToastStore';
import { useAuthStore } from '@store/useAuthStore';
import { Press } from '@components/ui/Press';
import {
  IcNavigation, IcCheck, IcChevronRight, IcMapPin, IcWallet, IcZap, IcRoute, IcPackage,
} from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import { money, orderTotal } from '@utils/format';
import { STATUS_META, type DeliveryOrder } from '@types/delivery';

const c = palette.dark;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};
const hasCustody = (o: DeliveryOrder) => ['pending', 'collected', 'partial'].includes(o.rider_collection_status ?? '');

/** Punto "en vivo" con anillo expansivo (hilo de UI, sin re-render). */
function LiveDot({ color = '#fff', size = 9 }: { color?: string; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1700 }), -1, false); }, []);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 2.6 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { active, routeStops, pendingPickup, tripStarted, isFetching, refetch } = useMyOrders();

  const currentStop = tripStarted ? routeStops.find((o) => o.status_tracker_id !== 7) ?? null : null;
  const currentIdx = currentStop ? routeStops.findIndex((o) => o.id === currentStop.id) + 1 : 0;
  const doneStops = routeStops.filter((o) => o.status_tracker_id === 7).length;
  const cashToCollect = active.filter(hasCustody).reduce((s, o) => s + (Number(o.rider_collection_amount) || 0), 0);
  const firstName = user?.use_fullname?.trim().split(/\s+/)[0];

  const onIniciar = useCallback(async () => {
    const routeId = routeStops[0]?.delivery_route_id;
    if (!routeId) return;
    try {
      await pickupRoute({ routeId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast({ message: '🚀 Viaje iniciado — ¡en camino!', variant: 'success' });
      qc.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    } catch {/* toast del interceptor */}
  }, [routeStops]);

  const navigate = (o: DeliveryOrder) => {
    if (o.delivery_lat && o.delivery_lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}`);
    } else {
      showToast({ message: 'La orden no tiene coordenadas', variant: 'warning' });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      {/* ───────── Header ───────── */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
          <Text style={styles.title}>Mis órdenes</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countNum}>{active.length}</Text>
          <Text style={styles.countLbl}>activa{active.length !== 1 ? 's' : ''}</Text>
        </View>
      </Animated.View>

      <FlatList
        data={active}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 6, paddingBottom: insets.bottom + 28, gap: 11 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={c.primary} colors={[c.primary]} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: active.length ? 4 : 0 }}>
            {/* Panel EN CAMINO */}
            {tripStarted && currentStop && (
              <Animated.View entering={FadeInDown.springify().damping(16)}>
                <LinearGradient colors={['#1E1B2E', '#15131F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cmd}>
                  <View style={styles.cmdGlow} pointerEvents="none" />
                  <View style={styles.cmdTop}>
                    <View style={styles.live}><LiveDot color={c.primaryHi} /><Text style={styles.liveTxt}>EN CAMINO</Text></View>
                    <Text style={styles.parada}>Parada {currentIdx} de {routeStops.length}</Text>
                  </View>

                  {/* Progreso de ruta */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(6, (doneStops / routeStops.length) * 100)}%` }]} />
                  </View>

                  <Text style={styles.cmdName} numberOfLines={1}>{currentStop.delivery_contact_name || currentStop.name || `#${currentStop.id}`}</Text>
                  {!!currentStop.delivery_address && (
                    <View style={styles.cmdAddrRow}>
                      <IcMapPin size={15} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.cmdAddr} numberOfLines={2}>{currentStop.delivery_address}</Text>
                    </View>
                  )}

                  <View style={styles.cmdBtns}>
                    <Press style={[styles.cmdBtn, styles.cmdBtnNav]} onPress={() => navigate(currentStop)}>
                      <IcNavigation size={18} color="#fff" />
                      <Text style={styles.cmdBtnNavTxt}>Navegar</Text>
                    </Press>
                    <Press style={[styles.cmdBtn, styles.cmdBtnDone]} onPress={() => router.push(`/order/${currentStop.id}`)}>
                      <IcCheck size={18} color="#15131F" />
                      <Text style={styles.cmdBtnDoneTxt}>Entregar</Text>
                    </Press>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {/* CTA Iniciar viaje */}
            {pendingPickup > 0 && (
              <Animated.View entering={FadeInDown.springify().damping(16)}>
                <Press onPress={onIniciar} scaleTo={0.975}>
                  <LinearGradient colors={[c.primaryHi, c.brandMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startBtn}>
                    <View style={styles.startIcon}><IcZap size={20} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.startTxt}>Iniciar viaje</Text>
                      <Text style={styles.startSub}>{pendingPickup} parada{pendingPickup !== 1 ? 's' : ''} por recoger</Text>
                    </View>
                    <IcChevronRight size={22} color="rgba(255,255,255,0.85)" />
                  </LinearGradient>
                </Press>
              </Animated.View>
            )}

            {/* Resumen efectivo a cobrar */}
            {cashToCollect > 0 && (
              <Animated.View entering={FadeIn.delay(120)} style={styles.cashStrip}>
                <View style={styles.cashIcon}><IcWallet size={17} color={c.warning} /></View>
                <Text style={styles.cashLbl}>Efectivo a cobrar hoy</Text>
                <Text style={styles.cashVal}>{money(cashToCollect)}</Text>
              </Animated.View>
            )}
          </View>
        }
        ListEmptyComponent={
          isFetching ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 80 }} />
          ) : (
            <Animated.View entering={FadeIn.duration(500)} style={styles.empty}>
              <View style={styles.emptyArt}>
                <IcRoute size={46} color={c.primary} />
              </View>
              <Text style={styles.emptyTitle}>Todo al día</Text>
              <Text style={styles.emptyTxt}>No tenés entregas activas.{'\n'}Cuando te asignen un pedido aparece acá al instante.</Text>
            </Animated.View>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 55, 330)).springify().damping(15)}>
            <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function OrderCard({ order, onPress }: { order: DeliveryOrder; onPress: () => void }) {
  const st = STATUS_META[order.status_tracker_id] ?? { label: '—', color: c.textMuted };
  const custody = hasCustody(order);
  return (
    <Press onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        {order.delivery_route_order != null ? (
          <View style={styles.num}><Text style={styles.numTxt}>{order.delivery_route_order}</Text></View>
        ) : (
          <View style={styles.numAlt}><IcPackage size={17} color={c.primary} /></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{order.delivery_contact_name || order.name || `#${order.id}`}</Text>
          {!!order.delivery_neighborhood && <Text style={styles.cardZone} numberOfLines={1}>{order.delivery_neighborhood}</Text>}
        </View>
        <View style={[styles.badge, { backgroundColor: st.color + '1A' }]}>
          <View style={[styles.badgeDot, { backgroundColor: st.color }]} />
          <Text style={[styles.badgeTxt, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {!!order.delivery_address && (
        <View style={styles.cardAddrRow}>
          <IcMapPin size={14} color={c.textMuted} />
          <Text style={styles.cardAddr} numberOfLines={2}>{order.delivery_address}</Text>
        </View>
      )}

      <View style={styles.cardBottom}>
        <View style={styles.cardMoneyWrap}>
          <Text style={styles.cardMoney}>{money(orderTotal(order))}</Text>
          {custody && (
            <View style={styles.cardCustody}>
              <IcWallet size={13} color={c.warning} />
              <Text style={styles.cardCustodyTxt}>cobrar {money(order.rider_collection_amount)}</Text>
            </View>
          )}
        </View>
        <IcChevronRight size={20} color={c.textMuted} />
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  kicker: { fontSize: 13, color: c.textMuted, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 30, fontWeight: '900', color: c.text, letterSpacing: -0.8, marginTop: 2 },
  countPill: { alignItems: 'center', backgroundColor: c.primaryDim, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  countNum: { fontSize: 20, fontWeight: '900', color: c.brandMid, fontVariant: ['tabular-nums'], lineHeight: 22 },
  countLbl: { fontSize: 10, fontWeight: '800', color: c.brandMid, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Command panel
  cmd: { borderRadius: 22, padding: 18, overflow: 'hidden' },
  cmdGlow: { position: 'absolute', top: -50, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(249,115,22,0.18)' },
  cmdTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  liveTxt: { color: c.primaryHi, fontWeight: '900', fontSize: 11.5, letterSpacing: 2.5 },
  parada: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 12.5, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: c.primaryHi },
  cmdName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16, letterSpacing: -0.3 },
  cmdAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 6 },
  cmdAddr: { flex: 1, color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 19 },
  cmdBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cmdBtn: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  cmdBtnNav: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cmdBtnNavTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cmdBtnDone: { backgroundColor: '#fff' },
  cmdBtnDoneTxt: { color: '#15131F', fontWeight: '800', fontSize: 15 },

  // Start CTA
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, padding: 15, ...shadow.md, shadowColor: c.primary },
  startIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  startTxt: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: -0.2 },
  startSub: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 12.5, marginTop: 1 },

  // Cash strip
  cashStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE9C8', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13 },
  cashIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  cashLbl: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  cashVal: { fontSize: 16, fontWeight: '900', color: '#92400E', fontVariant: ['tabular-nums'] },

  // Card
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 15, ...shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  num: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  numTxt: { fontWeight: '900', color: '#fff', fontSize: 15, fontVariant: ['tabular-nums'] },
  numAlt: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '800', color: c.text, letterSpacing: -0.2 },
  cardZone: { fontSize: 12.5, color: c.textMuted, marginTop: 1, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  cardAddrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 11 },
  cardAddr: { flex: 1, fontSize: 13, color: c.textDim, lineHeight: 18 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.soft },
  cardMoneyWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardMoney: { fontSize: 16, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  cardCustody: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  cardCustodyTxt: { fontSize: 11.5, fontWeight: '800', color: c.warning, fontVariant: ['tabular-nums'] },

  // Empty
  empty: { alignItems: 'center', marginTop: 70, paddingHorizontal: 40 },
  emptyArt: { width: 96, height: 96, borderRadius: 30, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: c.text },
  emptyTxt: { color: c.textDim, fontSize: 14, textAlign: 'center', marginTop: 7, lineHeight: 20 },
});
