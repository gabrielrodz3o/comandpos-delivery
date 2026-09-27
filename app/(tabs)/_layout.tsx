import { Tabs, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@theme/colors";
import { useAuthStore } from "@store/useAuthStore";
import {
  IcBike,
  IcMapPin,
  IcReceipt,
  IcUser,
  IcWallet,
} from "@components/ui/icons";
import { View } from "react-native";
import type { ReactNode } from "react";

const c = palette.dark;

export default function TabsLayout() {
  const { token, hydrated, locationId } = useAuthStore();
  const insets = useSafeAreaInsets();
  // Protección: sin sesión → login.
  if (hydrated && !token) return <Redirect href="/(auth)/login" />;
  if (hydrated && locationId == null)
    return <Redirect href="/select-location" />;

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
          backgroundColor: c.surface,
          borderTopColor: "#EBE2D8",
          height: 62 + Math.max(insets.bottom, 8),
          paddingTop: 7,
          borderTopLeftRadius: 23,
          borderTopRightRadius: 23,
          shadowColor: "#1A1410",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -3 },
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.1,
          marginTop: 3,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: "Mis órdenes",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon active={focused}>
              <IcBike size={23} color={color} strokeWidth={focused ? 2 : 1.8} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Ruta",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon active={focused}>
              <IcMapPin
                size={23}
                color={color}
                strokeWidth={focused ? 2 : 1.8}
              />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: "Mi dinero",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon active={focused}>
              <IcWallet
                size={23}
                color={color}
                strokeWidth={focused ? 2 : 1.8}
              />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen
        name="account"
        options={{
          title: "Cuenta",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon active={focused}>
              <IcUser size={23} color={color} strokeWidth={focused ? 2 : 1.8} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        width: 54,
        height: 32,
        borderRadius: 12,
        backgroundColor: active ? "#FFF0DF" : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}
