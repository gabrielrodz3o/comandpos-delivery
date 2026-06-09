import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSyncQueue } from '@store/useSyncQueue';
import { IcInfo, IcCheck } from '@components/ui/icons';

/**
 * Tira superior que refleja el estado de la cola offline:
 *  - sin conexión (acciones guardadas localmente)
 *  - sincronizando (reenviando al reconectar)
 */
export function SyncBanner() {
  const insets = useSafeAreaInsets();
  const items = useSyncQueue((s) => s.items);
  const online = useSyncQueue((s) => s.online);
  const flushing = useSyncQueue((s) => s.flushing);

  const pending = items.length;
  if (online && pending === 0) return null; // todo sincronizado → oculto

  const syncing = flushing;
  const offline = !online && !flushing;

  const bg = syncing ? '#DBEAFE' : offline ? '#FEF3C7' : '#DCFCE7';
  const fg = syncing ? '#1E40AF' : offline ? '#92400E' : '#166534';
  const text = syncing
    ? `Sincronizando${pending ? ` ${pending}` : ''}…`
    : offline
    ? `Sin conexión${pending ? ` · ${pending} pendiente${pending > 1 ? 's' : ''}` : ''}`
    : `${pending} cambio${pending > 1 ? 's' : ''} por enviar`;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.bar, { backgroundColor: bg, paddingTop: insets.top + 4 }]}
    >
      <View style={styles.row}>
        {syncing ? (
          <ActivityIndicator size="small" color={fg} />
        ) : offline ? (
          <IcInfo size={15} color={fg} />
        ) : (
          <IcCheck size={15} color={fg} />
        )}
        <Text style={[styles.txt, { color: fg }]}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9000, paddingBottom: 7, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  txt: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1 },
});
