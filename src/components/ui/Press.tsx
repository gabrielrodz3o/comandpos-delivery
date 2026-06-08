/**
 * Pressable con feedback táctil: escala por resorte (hilo de UI, sin re-render)
 * + háptica de selección. Sustituye a <Pressable> en toda la app para dar
 * una sensación física consistente a cada toque.
 *
 * El estilo (incluyendo flex) se aplica al Pressable animado directamente, para
 * que funcione como hijo flex en filas/grids sin envoltorios extra.
 */
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle, type GestureResponderEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressProps = {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  disabled?: boolean;
  haptic?: boolean;
  scaleTo?: number;
};

export function Press({
  children, onPress, onLongPress, style, hitSlop, disabled, haptic = true, scaleTo = 0.96,
}: PressProps) {
  const s = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, aStyle]}
      onPressIn={() => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 340, mass: 0.5 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.5 }); }}
      onPress={(e) => {
        if (disabled) return;
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      onLongPress={onLongPress}
    >
      {children}
    </AnimatedPressable>
  );
}
