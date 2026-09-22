import { memo, useEffect, useId, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export const DELIVERY_ART = require('../../../assets/brand/delivery-scooter-v2.png');

interface Props {
  size: number;
  animated?: boolean;
  reducedMotion?: boolean;
  onReady?: () => void;
}

/** Render 3D local con entrada nativa; se asienta una vez, sin balanceos perpetuos. */
export const DeliveryMark3D = memo(function DeliveryMark3D({ size, animated = true, reducedMotion = false, onReady }: Props) {
  const shadowId = `delivery-shadow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const entrance = useSharedValue(1);

  useEffect(() => {
    if (loaded && animated && !reducedMotion) {
      entrance.value = 0;
      entrance.value = withTiming(1, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    } else {
      entrance.value = 1;
    }
    return () => cancelAnimation(entrance);
  }, [loaded, animated, reducedMotion, entrance]);

  const artStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + entrance.value * 0.85,
    transform: [
      { translateX: (1 - entrance.value) * -size * 0.1 },
      { translateY: (1 - entrance.value) * size * 0.025 },
      { scale: 0.96 + entrance.value * 0.04 },
      { rotate: `${(1 - entrance.value) * -1.5}deg` },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: entrance.value * 0.7,
    transform: [{ scaleX: 0.86 + entrance.value * 0.14 }],
  }));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Moto ComandPOS Delivery" style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shadowStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs><RadialGradient id={shadowId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.65" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient></Defs>
          <Ellipse cx="51" cy="88" rx="45" ry="8" fill={`url(#${shadowId})`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
        <Image source={failed ? require('../../../assets/icon.png') : DELIVERY_ART}
          style={[StyleSheet.absoluteFill, { width: size, height: size }]} resizeMode="contain" fadeDuration={0}
          accessible={false}
          onLoadEnd={() => { setLoaded(true); onReady?.(); }}
          onError={() => { setFailed(true); onReady?.(); }} />
      </Animated.View>
    </View>
  );
});
