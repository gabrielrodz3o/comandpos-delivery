import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Svg, {
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { DeliveryMark3D } from "./DeliveryMark3D";
import { useBrandMotion } from "./useBrandMotion";
import {
  DELIVERY_LOGIN_MARK_SIZE,
  DELIVERY_LOGIN_STAGE_HEIGHT,
  DELIVERY_LOGIN_TOP_PADDING,
} from "./layout";

export const DELIVERY_INTRO_MS = 1650;
const EXIT_MS = 420;

/** Entrada de marca: llegada → reposo → transición. La red nunca bloquea la escena. */
export function DeliveryIntro({
  ready,
  toLogin,
  onFinish,
}: {
  ready: boolean;
  toLogin: boolean;
  onFinish: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { foreground, reducedMotion } = useBrandMotion();
  const [laidOut, setLaidOut] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [settled, setSettled] = useState(false);
  const opacity = useSharedValue(1);
  const reveal = useSharedValue(0);
  const light = useSharedValue(0);
  const loading = useSharedValue(0.35);
  const markSize = Math.min(width - 28, height * 0.43, 360);
  const stageTop = height * 0.47 - markSize / 2 - 25;
  const onLayout = useCallback(() => setLaidOut(true), []);
  const onArtReady = useCallback(() => setArtReady(true), []);

  useEffect(() => {
    if (!laidOut || !artReady) return;
    let mounted = true;
    // La imagen local ya está decodificada antes de retirar el splash nativo.
    void SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        if (mounted) setStarted(true);
      });
    return () => {
      mounted = false;
    };
  }, [laidOut, artReady]);

  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(
      () => setSettled(true),
      reducedMotion || !toLogin ? 0 : DELIVERY_INTRO_MS,
    );
    return () => clearTimeout(timer);
  }, [started, reducedMotion, toLogin]);

  useEffect(() => {
    if (!started || !foreground || reducedMotion) {
      reveal.value = reducedMotion ? 1 : 0;
      light.value = reducedMotion ? 1 : 0;
      loading.value = 0.6;
      return;
    }
    reveal.value = withDelay(
      280,
      withTiming(1, { duration: 650, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
    light.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
    loading.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => [reveal, light, loading].forEach(cancelAnimation);
  }, [started, foreground, reducedMotion, reveal, light, loading]);

  useEffect(() => {
    if (!ready || !settled || !foreground) return;
    const duration = reducedMotion || !toLogin ? 0 : EXIT_MS;
    opacity.value = withTiming(0, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
    const timer = setTimeout(onFinish, duration);
    return () => {
      clearTimeout(timer);
      cancelAnimation(opacity);
      opacity.value = 1;
    };
  }, [ready, settled, foreground, reducedMotion, toLogin, onFinish, opacity]);

  const sceneStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const stageStyle = useAnimatedStyle(() => {
    const exit = reducedMotion || !toLogin ? 0 : 1 - opacity.value;
    const destinationY =
      insets.top + DELIVERY_LOGIN_TOP_PADDING + DELIVERY_LOGIN_STAGE_HEIGHT / 2;
    return {
      transform: [
        { translateY: exit * (destinationY - stageTop - markSize / 2) },
        { scale: 1 + exit * (DELIVERY_LOGIN_MARK_SIZE / markSize - 1) },
      ],
    };
  });
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 10 }],
  }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.value }));
  const statusStyle = useAnimatedStyle(() => ({ opacity: loading.value }));

  return (
    <Animated.View
      onLayout={onLayout}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={[styles.root, sceneStyle]}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={["#151515", "#201B18", "#171615"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.light,
          { top: stageTop - 45, width: width + 80, height: markSize + 130 },
          lightStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 440 460">
          <Defs>
            <RadialGradient
              id="delivery-studio-light"
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
            >
              <Stop offset="0" stopColor="#F97316" stopOpacity="0.16" />
              <Stop offset="0.5" stopColor="#F97316" stopOpacity="0.055" />
              <Stop offset="1" stopColor="#F97316" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx="220"
            cy="230"
            rx="218"
            ry="228"
            fill="url(#delivery-studio-light)"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.stage,
          { top: stageTop, width: markSize, height: markSize },
          stageStyle,
        ]}
      >
        <DeliveryMark3D
          size={markSize}
          animated={started && foreground}
          reducedMotion={reducedMotion}
          onReady={onArtReady}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.ground, { top: stageTop + markSize * 0.9 }, lightStyle]}
      >
        <Svg width="240" height="28" viewBox="0 0 240 28">
          <Path
            d="M18 10 C60 27 178 27 222 10"
            stroke="#E9A168"
            strokeOpacity="0.16"
            strokeWidth="1"
            fill="none"
          />
          <Path
            d="M82 22 Q120 26 158 22"
            stroke="#F97316"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[styles.words, { top: stageTop + markSize + 25 }, wordsStyle]}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Comand</Text>
          <Text style={[styles.brand, styles.brandAccent]}>POS</Text>
        </View>
        <View style={styles.labelRow}>
          <View style={styles.labelLine} />
          <Text style={styles.label}>DELIVERY</Text>
          <View style={styles.labelLine} />
        </View>
        <Text style={styles.tagline}>Cada entrega, más cerca.</Text>
      </Animated.View>

      <View style={[styles.footer, { bottom: insets.bottom + 30 }]}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Preparando ComandPOS Delivery"
          accessibilityState={{ busy: true }}
          style={styles.statusRow}
        >
          <Animated.View style={[styles.statusDot, statusStyle]} />
          <Text style={styles.status}>Preparando tu ruta</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: "#171615",
  },
  light: { position: "absolute", alignSelf: "center" },
  stage: { position: "absolute", alignSelf: "center" },
  ground: { position: "absolute", alignSelf: "center" },
  words: { position: "absolute", left: 20, right: 20, alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "baseline" },
  brand: {
    color: "#FAF6F1",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.3,
  },
  brandAccent: { color: "#F99443" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 13,
  },
  labelLine: { width: 18, height: 1, backgroundColor: "#A5734F" },
  label: {
    color: "#E5C9AF",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 4,
  },
  tagline: {
    marginTop: 23,
    color: "#A79C93",
    fontSize: 13,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  footer: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F99443",
  },
  status: { color: "#B7AAA0", fontSize: 11, letterSpacing: 0.3 },
});
