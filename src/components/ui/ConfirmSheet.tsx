/**
 * Hoja de confirmación (bottom-sheet) con estética propia, reemplaza al
 * Alert nativo. Soporta un monto destacado (ej. efectivo a cobrar) y tonos
 * semánticos (success / danger / primary).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, Easing } from 'react-native-reanimated';
import { Press } from './Press';
import { palette, shadow } from '@theme/colors';

const EXIT_MS = 220; // debe coincidir con la duración del exiting de la hoja

const c = palette.dark;

const TONES = {
  success: { color: c.success, tint: '#DCFCE7' },
  danger: { color: c.danger, tint: '#FEE2E2' },
  primary: { color: c.primary, tint: c.primaryDim },
} as const;

type ConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  icon?: ReactNode;
  amount?: string;
  amountLabel?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: keyof typeof TONES;
};

export function ConfirmSheet({
  visible, onClose, onConfirm, title, message, icon, amount, amountLabel,
  confirmText = 'Confirmar', cancelText = 'Cancelar', tone = 'primary',
}: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const t = TONES[tone];

  // Mantiene el Modal montado durante la animación de salida (si no, se corta de golpe).
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) { setMounted(true); return; }
    const id = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        {visible && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(EXIT_MS)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={onClose} />
          </Animated.View>
        )}

        {visible && (
        <Animated.View
          entering={SlideInDown.duration(360).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(EXIT_MS).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.handle} />

          {!!icon && <View style={[styles.iconBubble, { backgroundColor: t.tint }]}>{icon}</View>}

          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          {!!amount && (
            <View style={[styles.amountBox, { backgroundColor: t.tint }]}>
              {!!amountLabel && <Text style={[styles.amountLbl, { color: t.color }]}>{amountLabel}</Text>}
              <Text style={[styles.amountVal, { color: t.color }]}>{amount}</Text>
            </View>
          )}

          <View style={styles.btns}>
            <Press style={styles.cancelBtn} onPress={onClose} scaleTo={0.97}>
              <Text style={styles.cancelTxt}>{cancelText}</Text>
            </Press>
            <Press style={[styles.confirmBtn, { backgroundColor: t.color }]} onPress={() => { onClose(); onConfirm(); }} scaleTo={0.97}>
              <Text style={styles.confirmTxt}>{confirmText}</Text>
            </Press>
          </View>
        </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(26,20,16,0.45)' },
  sheet: {
    backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 12, alignItems: 'center',
    shadowColor: '#1A1410', shadowOpacity: 0.18, shadowOffset: { width: 0, height: -8 }, shadowRadius: 30, elevation: 24,
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: c.borderHi, marginBottom: 18 },
  iconBubble: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: c.text, textAlign: 'center', letterSpacing: -0.4 },
  message: { fontSize: 14.5, color: c.textDim, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 6 },
  amountBox: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 16, paddingVertical: 16, marginTop: 18 },
  amountLbl: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.85 },
  amountVal: { fontSize: 30, fontWeight: '900', marginTop: 3, fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  btns: { flexDirection: 'row', gap: 11, alignSelf: 'stretch', marginTop: 22 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: c.soft },
  cancelTxt: { fontSize: 15.5, fontWeight: '800', color: c.textDim },
  confirmBtn: { flex: 1.25, paddingVertical: 16, borderRadius: 16, alignItems: 'center', ...shadow.md },
  confirmTxt: { fontSize: 15.5, fontWeight: '800', color: '#fff' },
});
