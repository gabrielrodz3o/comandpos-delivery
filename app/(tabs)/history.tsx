import { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useMyOrders } from '@hooks/useMyOrders';
import { Press } from '@components/ui/Press';
import { IcCheckCircle, IcTrendingUp, IcWallet, IcReceipt, IcClock } from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import { money, orderTotal } from '@utils/format';
import type { DeliveryOrder } from '@types/delivery';

const c = palette.dark;

type Period = 'today' | 'all';
const whenOf = (o: DeliveryOrder) => o.completed_at || o.updated_at || '';
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const hadCustody = (o: DeliveryOrder) => ['collected', 'settled', 'partial'].includes(o.rider_collection_status ?? '');

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { orders } = useMyOrders();
  const [period, setPeriod] = useState<Period>('today');

  const today = new Date().toDateString();
  const delivered = orders
    .filter((o) => o.status_tracker_id === 7)
    .filter((o) => (period === 'today' ? new Date(whenOf(o)).toDateString() === today : true))
    .sort((a, b) => new Date(whenOf(b)).getTime() - new Date(whenOf(a)).getTime());

  const earnings = delivered.reduce((s, o) => s + orderTotal(o), 0);
  const cash = delivered.filter(hadCustody).reduce((s, o) => s + (Number(o.rider_collection_amount) || 0), 0);
  const avg = delivered.length ? earnings / delivered.length : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Tu rendimiento</Text>
        <Text style={styles.title}>Historial</Text>
      </View>

      {/* Segmento de período */}
      <View style={styles.segment}>
        {(['today', 'all'] as Period[]).map((p) => {
          const on = period === p;
          return (
            <Press key={p} style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => setPeriod(p)} scaleTo={0.97}>
              <Text style={[styles.segTxt, on && styles.segTxtOn]}>{p === 'today' ? 'Hoy' : 'Últimas 48h'}</Text>
            </Press>
          );
        })}
      </View>

      <FlatList
        data={delivered}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 9 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 14, gap: 11 }}>
            {/* Hero facturación */}
            <Animated.View entering={FadeInDown.springify().damping(16)}>
              <LinearGradient colors={[c.primaryHi, c.brandMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroGlow} pointerEvents="none" />
                <View style={styles.heroTop}>
                  <Text style={styles.heroLbl}>Facturado {period === 'today' ? 'hoy' : '· 48h'}</Text>
                  <View style={styles.heroChip}><IcTrendingUp size={13} color="#fff" /><Text style={styles.heroChipTxt}>{delivered.length} entregas</Text></View>
                </View>
                <Text style={styles.heroVal}>{money(earnings)}</Text>
                <Text style={styles.heroSub}>Ticket promedio {money(avg)}</Text>
              </LinearGradient>
            </Animated.View>

            {/* KPIs */}
            <View style={styles.kpis}>
              <Kpi icon={<IcCheckCircle size={18} color={c.success} />} value={String(delivered.length)} label="Entregas" tint="#EAF6EE" />
              <Kpi icon={<IcWallet size={18} color={c.warning} />} value={money(cash)} label="Efectivo cobrado" tint="#FEF3C7" />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.duration(450)} style={styles.empty}>
            <View style={styles.emptyArt}><IcReceipt size={40} color={c.primary} /></View>
            <Text style={styles.emptyTitle}>Sin entregas {period === 'today' ? 'hoy' : 'aún'}</Text>
            <Text style={styles.emptyTxt}>Tus entregas completadas van a aparecer acá con su detalle.</Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 45, 300)).springify().damping(15)} style={styles.card}>
            <View style={styles.checkDot}><IcCheckCircle size={20} color={c.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.delivery_contact_name || item.name || `#${item.id}`}</Text>
              <View style={styles.metaRow}>
                {!!timeLabel(whenOf(item)) && (
                  <View style={styles.timeWrap}><IcClock size={12} color={c.textMuted} /><Text style={styles.time}>{timeLabel(whenOf(item))}</Text></View>
                )}
                {!!item.delivery_neighborhood && <Text style={styles.addr} numberOfLines={1}>· {item.delivery_neighborhood}</Text>}
              </View>
            </View>
            <Text style={styles.money}>{money(orderTotal(item))}</Text>
          </Animated.View>
        )}
      />
    </View>
  );
}

function Kpi({ icon, value, label, tint }: { icon: React.ReactNode; value: string; label: string; tint: string }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.kpiVal} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 18, paddingBottom: 12 },
  kicker: { fontSize: 13, color: c.textMuted, fontWeight: '700' },
  title: { fontSize: 30, fontWeight: '900', color: c.text, letterSpacing: -0.8, marginTop: 2 },

  segment: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.soft, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segBtnOn: { backgroundColor: c.surface, ...shadow.sm },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: c.textDim },
  segTxtOn: { color: c.text, fontWeight: '800' },

  // Hero
  hero: { borderRadius: 22, padding: 20, overflow: 'hidden', ...shadow.md, shadowColor: c.primary },
  heroGlow: { position: 'absolute', top: -60, right: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLbl: { color: 'rgba(255,255,255,0.92)', fontSize: 13.5, fontWeight: '700' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroChipTxt: { color: '#fff', fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroVal: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginTop: 12, fontVariant: ['tabular-nums'] },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },

  // KPIs
  kpis: { flexDirection: 'row', gap: 11 },
  kpi: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 15, ...shadow.sm },
  kpiIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiVal: { fontSize: 20, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  kpiLbl: { fontSize: 12, color: c.textDim, marginTop: 3, fontWeight: '600' },

  // Card
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 13, gap: 12, ...shadow.sm },
  checkDot: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF6EE', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800', color: c.text, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  time: { fontSize: 12, color: c.textMuted, fontWeight: '600', fontVariant: ['tabular-nums'] },
  addr: { fontSize: 12, color: c.textMuted, flexShrink: 1 },
  money: { fontSize: 16, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },

  // Empty
  empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 44 },
  emptyArt: { width: 90, height: 90, borderRadius: 28, backgroundColor: c.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: c.text },
  emptyTxt: { color: c.textDim, fontSize: 14, textAlign: 'center', marginTop: 7, lineHeight: 20 },
});
