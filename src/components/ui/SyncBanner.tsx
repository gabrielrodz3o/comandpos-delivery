import { useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { useSyncQueue } from "@store/useSyncQueue";
import { useAuthStore } from "@store/useAuthStore";
import { currentScope } from "@services/session";
/** In-flow banner: never covers navigation or the first action on a screen. */
export function SyncBanner() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { items, online, flushing } = useSyncQueue();
  if (!token) return null;
  const own = items.filter((i) => i.owner === currentScope());
  if (!own.length && online) return null;
  const failed = own.some((i) => i.state === "failed");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver cambios pendientes de sincronizar"
      onPress={() => router.push("/(tabs)/account")}
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: "#FFF3D6", padding: 9 }}
    >
      <Text
        style={{
          color: "#854D0E",
          fontSize: 12,
          textAlign: "center",
          fontWeight: "700",
        }}
      >
        {flushing
          ? "Sincronizando…"
          : failed
            ? "Hay cambios que requieren atención en Cuenta"
            : !online
              ? `Sin conexión · ${own.length} pendiente(s)`
              : `${own.length} cambio(s) por enviar`}
      </Text>
    </Pressable>
  );
}
