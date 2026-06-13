import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@theme/colors';
import { useAuthStore } from '@store/useAuthStore';
import { IcBike, IcMapPin, IcReceipt, IcUser } from '@components/ui/icons';

const c = palette.dark;

export default function TabsLayout() {
  const { token, hydrated } = useAuthStore();
  const insets = useSafeAreaInsets();
  // Protección: sin sesión → login.
  if (hydrated && !token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          // Altura derivada del inset real: 84 en iPhones con home indicator
          // (50 + 34), más baja donde no lo hay (iPad modo compatibilidad,
          // iPhone SE). Un alto fijo desbordaba la ventana en iPad.
          backgroundColor: c.surface, borderTopColor: c.border, height: 50 + Math.max(insets.bottom, 8), paddingTop: 6,
          shadowColor: '#1A1410', shadowOpacity: 0.06, shadowOffset: { width: 0, height: -3 }, shadowRadius: 12, elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen name="orders" options={{ title: 'Mis órdenes', tabBarIcon: ({ color }) => <IcBike size={24} color={color} strokeWidth={color === c.primary ? 2 : 1.8} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Mapa', tabBarIcon: ({ color }) => <IcMapPin size={24} color={color} strokeWidth={color === c.primary ? 2 : 1.8} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color }) => <IcReceipt size={24} color={color} strokeWidth={color === c.primary ? 2 : 1.8} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Cuenta', tabBarIcon: ({ color }) => <IcUser size={24} color={color} strokeWidth={color === c.primary ? 2 : 1.8} /> }} />
    </Tabs>
  );
}
