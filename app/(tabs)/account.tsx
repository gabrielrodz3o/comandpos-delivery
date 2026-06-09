import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { useAuthStore } from '@store/useAuthStore';
import { showToast } from '@store/useToastStore';
import { queueAvailability } from '@services/sync';
import { logoutRequest } from '@services/auth';
import { unregisterPushToken } from '@services/notifications';
import { disconnectRiderSocket } from '@services/socket';
import { useMyOrders } from '@hooks/useMyOrders';
import { Press } from '@components/ui/Press';
import { IcCheckCircle, IcWallet, IcHeadset, IcInfo, IcLogOut, IcChevronRight, IcPower } from '@components/ui/icons';
import { palette, shadow } from '@theme/colors';
import { money, initials, orderTotal } from '@utils/format';

const c = palette.dark;
const SUPPORT_WA = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, '') || '';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { accepting, orders } = useMyOrders();
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof accepting === 'boolean') setAvailable(accepting);
  }, [accepting]);

  const today = new Date().toDateString();
  const doneToday = orders.filter((o) => o.status_tracker_id === 7 && new Date(o.completed_at || o.updated_at || '').toDateString() === today);
  const earnedToday = doneToday.reduce((s, o) => s + orderTotal(o), 0);

  const toggle = async (val: boolean) => {
    setAvailable(val);
    setSaving(true);
    try {
      const res = await queueAvailability(val);
      if (!res.queued) showToast({ message: val ? 'Estás recibiendo pedidos' : 'No vas a recibir nuevos pedidos', variant: val ? 'success' : 'info' });
    } catch {
      setAvailable(!val);
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await unregisterPushToken();
    await logoutRequest();
    disconnectRiderSocket();
    logout();
    router.replace('/(auth)/login');
  };
  const onLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: doLogout },
    ]);
  };

  const role = user?.type_access?.[0]?.access?.access_profile_description ?? 'MOTORIZADO';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
      {/* ───────── Perfil ───────── */}
      <LinearGradient colors={[c.brandDeep, c.brandMid, c.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { paddingTop: insets.top + 24 }]}>
        <View style={styles.coverRing} pointerEvents="none" />
        <Animated.View entering={FadeInDown.duration(450).springify().damping(15)} style={styles.profile}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials(user?.use_fullname)}</Text></View>
          </View>
          <Text style={styles.name}>{user?.use_fullname ?? 'Motorizado'}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleTxt}>@{user?.use_username} · {role}</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ───────── Stats de hoy ───────── */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#EAF6EE' }]}><IcCheckCircle size={18} color={c.success} /></View>
          <Text style={styles.statVal}>{doneToday.length}</Text>
          <Text style={styles.statLbl}>Entregas hoy</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: c.primaryDim }]}><IcWallet size={18} color={c.brandMid} /></View>
          <Text style={styles.statVal}>{money(earnedToday)}</Text>
          <Text style={styles.statLbl}>Facturado hoy</Text>
        </View>
      </Animated.View>

      {/* ───────── Disponibilidad ───────── */}
      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={[styles.availCard, available ? styles.availOn : styles.availOff]}>
        <View style={[styles.availIcon, { backgroundColor: available ? '#DCFCE7' : c.soft }]}>
          <IcPower size={20} color={available ? c.success : c.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.availTitle}>{available ? 'Recibiendo pedidos' : 'No disponible'}</Text>
          <Text style={styles.availSub}>{available ? 'Te llegan nuevas asignaciones' : 'No vas a recibir asignaciones'}</Text>
        </View>
        <Switch value={available} onValueChange={toggle} disabled={saving} trackColor={{ true: c.success, false: c.borderHi }} thumbColor="#fff" ios_backgroundColor={c.borderHi} />
      </Animated.View>

      {/* ───────── Ajustes ───────── */}
      <Animated.View entering={FadeIn.delay(200)} style={styles.group}>
        <Text style={styles.groupLabel}>SOPORTE</Text>
        <View style={styles.card}>
          {SUPPORT_WA ? (
            <>
              <Row icon={<IcHeadset size={19} color={c.info} />} title="Contactar soporte" sub="Te respondemos por WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WA}`)} />
              <Divider />
            </>
          ) : null}
          <Row icon={<IcInfo size={19} color={c.textDim} />} title="Versión de la app" value={`v${APP_VERSION}`} />
        </View>
      </Animated.View>

      {/* ───────── Logout ───────── */}
      <Animated.View entering={FadeIn.delay(240)}>
        <Press style={styles.logout} onPress={onLogout} scaleTo={0.98}>
          <IcLogOut size={19} color={c.danger} />
          <Text style={styles.logoutTxt}>Cerrar sesión</Text>
        </Press>
      </Animated.View>

      <Text style={styles.footer}>ComandPOS · Delivery</Text>
    </ScrollView>
  );
}

function Row({ icon, title, sub, value, onPress }: { icon: React.ReactNode; title: string; sub?: string; value?: string; onPress?: () => void }) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : onPress ? <IcChevronRight size={20} color={c.textMuted} /> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress} haptic scaleTo={0.99}>{body}</Press> : body;
}
const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  // Cover / perfil
  cover: { paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  coverRing: { position: 'absolute', top: -70, right: -50, width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)' },
  profile: { alignItems: 'center' },
  avatarRing: { padding: 5, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  avatar: { width: 78, height: 78, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  avatarTxt: { fontSize: 30, fontWeight: '900', color: c.brandMid },
  name: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 14, letterSpacing: -0.4 },
  roleChip: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 5 },
  roleTxt: { color: '#FFF3E8', fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 11, paddingHorizontal: 16, marginTop: -18 },
  statCard: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 15, ...shadow.md },
  statIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal: { fontSize: 22, fontWeight: '900', color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statLbl: { fontSize: 12, color: c.textDim, marginTop: 3, fontWeight: '600' },

  // Disponibilidad
  availCard: { flexDirection: 'row', alignItems: 'center', gap: 13, marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16, borderWidth: 1.5 },
  availOn: { backgroundColor: '#F2FBF5', borderColor: '#BBF7D0' },
  availOff: { backgroundColor: c.surface, borderColor: c.border },
  availIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  availTitle: { fontSize: 16, fontWeight: '800', color: c.text, letterSpacing: -0.2 },
  availSub: { fontSize: 12.5, color: c.textDim, marginTop: 2 },

  // Grupos / ajustes
  group: { marginTop: 22, paddingHorizontal: 16 },
  groupLabel: { fontSize: 11.5, fontWeight: '800', color: c.textMuted, letterSpacing: 1, marginBottom: 9, marginLeft: 4 },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, overflow: 'hidden', ...shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  rowSub: { fontSize: 12.5, color: c.textDim, marginTop: 1 },
  rowValue: { fontSize: 14, color: c.textMuted, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: c.soft, marginLeft: 66 },

  // Logout
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginHorizontal: 16, marginTop: 22, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  logoutTxt: { color: c.danger, fontWeight: '800', fontSize: 15 },
  footer: { textAlign: 'center', color: c.textMuted, fontSize: 12, marginTop: 22, fontWeight: '600' },
});
