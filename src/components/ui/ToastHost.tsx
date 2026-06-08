import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastVariant } from '@store/useToastStore';
import { palette } from '@theme/colors';

const c = palette.dark;
const VARIANT: Record<ToastVariant, { bg: string; fg: string }> = {
  error: { bg: '#FEE2E2', fg: '#991B1B' },
  warning: { bg: '#FEF3C7', fg: '#92400E' },
  success: { bg: '#DCFCE7', fg: '#166534' },
  info: { bg: '#DBEAFE', fg: '#1E40AF' },
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} variant={t.variant} duration={t.duration} onDismiss={dismiss} />
      ))}
    </View>
  );
}

function ToastItem({
  id, message, variant, duration, onDismiss,
}: { id: string; message: string; variant: ToastVariant; duration: number; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(t);
  }, [id]);
  const v = VARIANT[variant];
  return (
    <Pressable onPress={() => onDismiss(id)} style={[styles.toast, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.fg }]} numberOfLines={3}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 9999, gap: 8 },
  toast: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  text: { fontSize: 13.5, fontWeight: '600' },
});
