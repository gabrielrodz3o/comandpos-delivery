import { useState, useRef, useEffect, memo, type Ref } from 'react';
import {
  View, Text, TextInput, Pressable, Keyboard, StatusBar, ActivityIndicator, Platform,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { login } from '@services/auth';
import { useAuthStore } from '@store/useAuthStore';
import { showToast } from '@store/useToastStore';
import { palette, shadow } from '@theme/colors';
import type { AuthUser } from '@types/business';

const c = palette.dark;

/* ── Iconos SVG ─────────────────────────────────────────────────────── */
type I = { color: string; size?: number };
const IcUser = ({ color, size = 20 }: I) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const IcLock = ({ color, size = 20 }: I) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm2 0V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const IcEye = ({ color, size = 20, off }: I & { off?: boolean }) => off ? (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 2.6-.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
) : (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
  </Svg>
);
const IcArrow = ({ color, size = 20 }: I) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Motivo: ruta punteada con pines (identidad delivery). */
const RouteMotif = () => (
  <Svg width={220} height={90} viewBox="0 0 220 90" fill="none">
    <Path d="M14 70 C 60 30, 90 95, 140 50 S 200 18, 210 24" stroke="rgba(255,255,255,0.18)" strokeWidth={2.5} strokeDasharray="2 8" strokeLinecap="round" />
    {[{ x: 14, y: 70 }, { x: 140, y: 50 }, { x: 210, y: 24 }].map((p, i) => (
      <Circle key={i} cx={p.x} cy={p.y} r={6} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
    ))}
  </Svg>
);

/** Hero decorativo. Memoizado: NO depende del estado del form, así no se
 *  re-renderiza (gradiente + SVGs) en cada tecla y el TextInput no pierde foco. */
const Hero = memo(function Hero() {
  return (
    <LinearGradient
      colors={[c.brandDeep, c.brandMid, c.primary]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderBottomLeftRadius: 38, borderBottomRightRadius: 38, overflow: 'hidden' }}
    >
      {/* anillos / formas decorativas */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -90, right: -70, width: 240, height: 240, borderRadius: 120, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -20, width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -60, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 8 }}><RouteMotif /></View>

      <SafeAreaView edges={['top']}>
        <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 48, paddingHorizontal: 24 }}>
          <View style={{ padding: 7, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
            <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.hero }}>
              <Text style={{ fontSize: 46 }}>🛵</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 18 }}>
            <Text style={{ color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.7 }}>Comand</Text>
            <Text style={{ color: '#FFE3C7', fontSize: 27, fontWeight: '900', letterSpacing: -0.7 }}>POS</Text>
          </View>

          <View style={{ marginTop: 8, paddingHorizontal: 13, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' }}>
            <Text style={{ color: '#FFF3E8', fontSize: 11, fontWeight: '900', letterSpacing: 3 }}>DELIVERY</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
});

/** Campo de texto autocontenido.
 *  - El foco (resaltado de borde) vive en estado LOCAL → tocar/desenfocar NO
 *    re-renderiza la pantalla, así el teclado no se cae.
 *  - Es NO controlado: el valor se reporta por `onChangeText` (a un ref del
 *    padre). No usa `value`, así escribir no dispara renders ni desordena letras. */
type FieldProps = {
  label: string;
  marginTop?: number;
  icon: (active: boolean) => React.ReactNode;
  secureToggle?: boolean;
  fieldRef?: Ref<TextInput>;
} & Omit<TextInputProps, 'style'>;

const Field = memo(function Field({ label, marginTop, icon, secureToggle, fieldRef, ...inputProps }: FieldProps) {
  // Sin estado en foco: setState dentro de onFocus re-renderiza y tira el foco
  // en esta versión de RN/Nueva Arquitectura. Borde estático.
  return (
    <View style={{ marginTop }}>
      <Text style={st.label}>{label}</Text>
      <View style={[st.field, { borderColor: c.border }]}>
        {icon(false)}
        <TextInput
          {...inputProps}
          ref={fieldRef}
          placeholderTextColor={c.textMuted}
          style={st.input}
          secureTextEntry={secureToggle}
          onFocus={(e) => { console.log('[login] FOCUS', label); inputProps.onFocus?.(e); }}
          onBlur={(e) => { console.log('[login] BLUR', label); inputProps.onBlur?.(e); }}
        />
        {secureToggle && <IcEye color={c.textMuted} off />}
      </View>
    </View>
  );
});

const firstLocationId = (user: AuthUser): number | null => {
  if (Array.isArray(user.acess_locations) && user.acess_locations.length) return Number(user.acess_locations[0]);
  return user.business_units_with_access?.[0]?.locations?.[0]?.id ?? null;
};

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth, setLocationId } = useAuthStore();
  const [loading, setLoading] = useState(false);


  // Valores NO controlados: se guardan en refs, no en estado → no re-render al escribir.
  const userRef = useRef('');
  const passRef = useRef('');
  const passInputRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    const username = userRef.current.trim();
    const password = passRef.current;
    if (!username || !password) {
      showToast({ message: 'Ingresá usuario y contraseña', variant: 'warning' });
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await login({ username, password });
      setAuth(res.token, res.user);
      setLocationId(firstLocationId(res.user));
      router.replace('/(tabs)/orders');
    } catch {
      /* interceptor */
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle="light-content" />
          {/* ───────── HERO ───────── */}
          <Hero />

          {/* ───────── FORM ───────── */}
          <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>Hola, motorizado 👋</Text>
            <Text style={{ fontSize: 14, color: c.textDim, marginTop: 4 }}>Entrá para ver tus entregas del día.</Text>

            <Field
              label="Usuario"
              marginTop={24}
              icon={(a) => <IcUser color={a ? c.primary : c.textMuted} />}
              onChangeText={(t) => { userRef.current = t; }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="tu usuario"
              returnKeyType="next"
              onSubmitEditing={() => passInputRef.current?.focus()}
              blurOnSubmit={false}
            />

            <Field
              label="Contraseña"
              marginTop={16}
              icon={(a) => <IcLock color={a ? c.primary : c.textMuted} />}
              fieldRef={passInputRef}
              secureToggle
              onChangeText={(t) => { passRef.current = t; }}
              placeholder="••••••"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            <Pressable onPress={onSubmit} disabled={loading} style={({ pressed }) => [st.cta, shadow.lg, { shadowColor: c.primary, opacity: pressed || loading ? 0.92 : 1 }]}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={st.ctaTxt}>Entrar</Text>
                  <IcArrow color="#fff" />
                </>
              )}
            </Pressable>

            <Text style={{ textAlign: 'center', color: c.textMuted, fontSize: 12, marginTop: 28 }}>
              ComandPOS · Delivery
            </Text>
          </View>
    </View>
  );
}

const st = {
  label: { fontSize: 12, fontWeight: '700' as const, color: c.textDim, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 7 },
  field: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: c.surface, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 16 : 8 },
  input: { flex: 1, fontSize: 16, color: c.text, padding: 0, margin: 0 },
  cta: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: c.primary, borderRadius: 14, height: 56, marginTop: 26 },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '800' as const },
};
