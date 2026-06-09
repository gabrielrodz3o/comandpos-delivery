import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMyOrders } from '@hooks/useMyOrders';
import { queueChangeStatus, queueMarkDelivered } from '@services/sync';
import { useAuthStore } from '@store/useAuthStore';
import { showToast } from '@store/useToastStore';
import { Press } from '@components/ui/Press';
import { ConfirmSheet } from '@components/ui/ConfirmSheet';
import {
  IcArrowLeft, IcPhone, IcChat, IcNavigation, IcMapPin, IcWallet, IcCheck, IcInfo, IcBike,
} from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import { money, orderTotal } from '@utils/format';
import { STATUS_META, type DeliveryOrder } from '@types/delivery';

const c = palette.dark;

const STEPS = [
  { id: 5, label: 'Recogida' },
  { id: 6, label: 'En camino' },
  { id: 7, label: 'Entregada' },
];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orders } = useMyOrders();
  const { user, locationId } = useAuthStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const order = orders.find((o) => String(o.id) === String(id));
  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 80, alignItems: 'center' }]}>
        <View style={styles.notFoundArt}><IcInfo size={32} color={c.textMuted} /></View>
        <Text style={{ color: c.textDim, fontSize: 15, marginTop: 14 }}>Orden no encontrada.</Text>
        <Press onPress={() => router.back()} style={styles.back}><Text style={styles.backTxt}>Volver</Text></Press>
      </View>
    );
  }

  const st = STATUS_META[order.status_tracker_id] ?? { label: '—', color: c.textMuted };
  const custody = ['pending', 'collected', 'partial'].includes(order.rider_collection_status ?? '');
  const stepIdx = STEPS.findIndex((s) => s.id === order.status_tracker_id);

  const subtotal = Number(order.order_subtotal) || 0;
  const itbis = subtotal * 0.18;
  const delivery = Number(order.delivery_cost) || 0;
  const total = orderTotal(order);

  const navigate = () => {
    if (order.delivery_lat && order.delivery_lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`);
    } else {
      showToast({ message: 'La orden no tiene coordenadas', variant: 'warning' });
    }
  };
  const phone = String(order.delivery_phone || '').replace(/\D/g, '');
  const call = () => phone && Linking.openURL(`tel:${phone}`);
  const whatsapp = () => phone && Linking.openURL(`https://wa.me/${phone}`);

  const onEnCamino = async () => {
    try { await queueChangeStatus(order, 6); Haptics.selectionAsync(); } catch {}
  };
  const askDeliver = () => {
    if (!locationId || !user?.use_id) return showToast({ message: 'Falta sucursal/usuario', variant: 'error' });
    setConfirmOpen(true);
  };
  const doDeliver = async () => {
    if (!locationId || !user?.use_id) return;
    try {
      const res = await queueMarkDelivered(order, locationId, user.use_id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (!res.queued) showToast({ message: '✓ Entregada', variant: 'success' });
      router.back();
    } catch {}
  };

  return (
    <View style={styles.root}>
      {/* ───────── Topbar ───────── */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Press onPress={() => router.back()} style={styles.iconCircle} hitSlop={8}>
          <IcArrowLeft size={20} color={c.text} />
        </Press>
        <View style={[styles.badge, { backgroundColor: st.color + '1A' }]}>
          <View style={[styles.badgeDot, { backgroundColor: st.color }]} />
          <Text style={[styles.badgeTxt, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <Text style={styles.kicker}>ORDEN #{order.id}</Text>
          <Text style={styles.name}>{order.delivery_contact_name || order.name || `#${order.id}`}</Text>
        </Animated.View>

        {/* Timeline */}
        {stepIdx >= 0 && (
          <View style={styles.timeline}>
            {STEPS.map((s, i) => {
              const done = i < stepIdx, activeStep = i === stepIdx;
              const on = done || activeStep;
              return (
                <View key={s.id} style={styles.tlStep}>
                  <View style={styles.tlNodeRow}>
                    {i > 0 && <View style={[styles.tlBar, { backgroundColor: i <= stepIdx ? c.primary : c.border }]} />}
                    <View style={[styles.tlNode, on ? { backgroundColor: activeStep ? c.primary : c.success, borderColor: 'transparent' } : { backgroundColor: c.surface, borderColor: c.border }]}>
                      {done ? <IcCheck size={13} color="#fff" /> : <View style={[styles.tlInner, { backgroundColor: activeStep ? '#fff' : c.textMuted }]} />}
                    </View>
                    {i < STEPS.length - 1 && <View style={[styles.tlBar, { backgroundColor: i < stepIdx ? c.primary : c.border }]} />}
                  </View>
                  <Text style={[styles.tlLabel, on && { color: c.text, fontWeight: '800' }]}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Dirección */}
        <Animated.View entering={FadeInDown.delay(60).duration(360)} style={styles.section}>
          <View style={styles.addrHead}>
            <IcMapPin size={18} color={c.primary} />
            <Text style={styles.addrLabel}>Entregar en</Text>
          </View>
          {!!order.delivery_address && <Text style={styles.addr}>{order.delivery_address}</Text>}
          {!!order.delivery_neighborhood && <Text style={styles.addrMeta}>{order.delivery_neighborhood}</Text>}
          {!!order.delivery_reference_point && <Text style={styles.addrMeta}>Ref: {order.delivery_reference_point}</Text>}
          {!!order.delivery_notes && (
            <View style={styles.notes}>
              <IcInfo size={15} color={c.warning} />
              <Text style={styles.notesTxt}>{order.delivery_notes}</Text>
            </View>
          )}
        </Animated.View>

        {/* Acciones de contacto */}
        <Animated.View entering={FadeInDown.delay(110).duration(360)} style={styles.contactRow}>
          <Press style={[styles.contactBtn, !phone && styles.contactDisabled]} onPress={call} disabled={!phone}>
            <View style={[styles.bubble, { backgroundColor: '#EEF1F6' }]}><IcPhone size={19} color={c.text} /></View>
            <Text style={styles.contactTxt}>Llamar</Text>
          </Press>
          <Press style={[styles.contactBtn, !phone && styles.contactDisabled]} onPress={whatsapp} disabled={!phone}>
            <View style={[styles.bubble, { backgroundColor: '#E3F7EC' }]}><IcChat size={19} color="#1FA855" /></View>
            <Text style={styles.contactTxt}>WhatsApp</Text>
          </Press>
          <Press style={styles.navBtn} onPress={navigate} scaleTo={0.97}>
            <LinearGradient colors={['#3B82F6', c.info]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.navFill}>
              <View style={styles.navBubble}><IcNavigation size={19} color="#fff" /></View>
              <Text style={styles.navTxt}>Navegar</Text>
            </LinearGradient>
          </Press>
        </Animated.View>

        {/* Desglose de cobro */}
        <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.section}>
          <Text style={styles.moneyHead}>Resumen de cobro</Text>
          {subtotal > 0 && <Line label="Subtotal" value={money(subtotal)} />}
          {subtotal > 0 && <Line label="ITBIS (18%)" value={money(itbis)} />}
          {delivery > 0 && <Line label="Envío" value={money(delivery)} />}
          <View style={styles.totalRow}>
            <Text style={styles.totalLbl}>Total</Text>
            <Text style={styles.totalVal}>{money(total)}</Text>
          </View>
        </Animated.View>

        {/* Custodia / efectivo */}
        {custody && (
          <Animated.View entering={FadeInDown.delay(200).duration(360)} style={styles.custody}>
            <View style={styles.custodyIcon}><IcWallet size={20} color="#92400E" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.custodyLbl}>Cobrar en efectivo</Text>
              <Text style={styles.custodySub}>El cliente paga al recibir</Text>
            </View>
            <Text style={styles.custodyVal}>{money(order.rider_collection_amount)}</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* ───────── Acción sticky ───────── */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
        {order.status_tracker_id === 5 && (
          <Press style={[styles.action, { backgroundColor: c.primary }]} onPress={onEnCamino} scaleTo={0.98}>
            <IcBike size={20} color="#fff" />
            <Text style={styles.actionTxt}>Marcar En camino</Text>
          </Press>
        )}
        {order.status_tracker_id === 6 && (
          <Press style={[styles.action, { backgroundColor: c.success }]} onPress={askDeliver} scaleTo={0.98}>
            <IcCheck size={20} color="#fff" />
            <Text style={styles.actionTxt}>{custody ? `Cobrar y entregar · ${money(order.rider_collection_amount)}` : 'Marcar Entregada'}</Text>
          </Press>
        )}
        {order.status_tracker_id !== 5 && order.status_tracker_id !== 6 && (
          <View style={[styles.action, styles.actionMuted]}>
            <Text style={[styles.actionTxt, { color: c.textDim }]}>Sin acciones disponibles</Text>
          </View>
        )}
      </View>

      <ConfirmSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doDeliver}
        tone="success"
        icon={custody ? <IcWallet size={26} color={c.success} /> : <IcCheck size={26} color={c.success} />}
        title="Confirmar entrega"
        message={custody ? 'Confirmá que recibiste el efectivo del cliente antes de cerrar la orden.' : '¿Marcar esta orden como entregada? Esta acción no se puede deshacer.'}
        amount={custody ? money(order.rider_collection_amount) : undefined}
        amountLabel={custody ? 'Cobraste en efectivo' : undefined}
        confirmText={custody ? 'Cobré y entregué' : 'Sí, entregada'}
      />
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLbl}>{label}</Text>
      <Text style={styles.lineVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  iconCircle: { width: 40, height: 40, borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: { fontSize: 12.5, fontWeight: '800' },
  back: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 22, backgroundColor: c.primaryDim, borderRadius: 12 },
  backTxt: { color: c.brandMid, fontWeight: '800' },
  notFoundArt: { width: 70, height: 70, borderRadius: 22, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },

  kicker: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  name: { fontSize: 27, fontWeight: '900', color: c.text, marginTop: 4, letterSpacing: -0.6 },

  // Timeline
  timeline: { flexDirection: 'row', marginTop: 22, marginBottom: 4 },
  tlStep: { flex: 1, alignItems: 'center' },
  tlNodeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  tlBar: { flex: 1, height: 2.5, borderRadius: 2 },
  tlNode: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tlInner: { width: 8, height: 8, borderRadius: 4 },
  tlLabel: { fontSize: 12, color: c.textMuted, marginTop: 7, fontWeight: '600' },

  // Sections
  section: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, marginTop: 16, ...shadow.sm },
  addrHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrLabel: { fontSize: 12, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  addr: { fontSize: 16.5, color: c.text, marginTop: 10, fontWeight: '600', lineHeight: 23 },
  addrMeta: { fontSize: 13, color: c.textDim, marginTop: 4 },
  notes: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#FDE9C8' },
  notesTxt: { flex: 1, fontSize: 13.5, color: '#92400E', fontWeight: '600', lineHeight: 19 },

  // Contact
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'stretch' },
  contactBtn: { flex: 1, gap: 9, paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, ...shadow.sm },
  contactDisabled: { opacity: 0.4 },
  bubble: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  contactTxt: { fontSize: 12.5, fontWeight: '800', color: c.text },
  navBtn: { flex: 1, borderRadius: 18, overflow: 'hidden', ...shadow.md, shadowColor: c.info },
  navFill: { flex: 1, gap: 9, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  navBubble: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  navTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  // Money
  moneyHead: { fontSize: 12, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  lineLbl: { fontSize: 14, color: c.textDim },
  lineVal: { fontSize: 14.5, color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  totalLbl: { fontSize: 15, color: c.text, fontWeight: '700' },
  totalVal: { fontSize: 23, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },

  // Custody
  custody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: '#FEF3C7', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#FDE68A' },
  custodyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FDE9C8', alignItems: 'center', justifyContent: 'center' },
  custodyLbl: { fontSize: 14.5, fontWeight: '800', color: '#92400E' },
  custodySub: { fontSize: 12, color: '#B45309', marginTop: 1 },
  custodyVal: { fontSize: 21, fontWeight: '900', color: '#92400E', fontVariant: ['tabular-nums'] },

  // Sticky actions
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, shadowColor: '#1A1410', shadowOpacity: 0.08, shadowOffset: { width: 0, height: -4 }, shadowRadius: 16, elevation: 14 },
  action: { flexDirection: 'row', gap: 9, borderRadius: 16, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  actionMuted: { backgroundColor: c.soft, ...shadow.none },
  actionTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
