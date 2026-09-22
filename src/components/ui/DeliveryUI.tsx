import type { ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Press } from "./Press";
import {
  IcChevronRight,
  IcPhone,
  IcNavigation,
  IcMapPin,
  IcInfo,
  IcPackage,
} from "./icons";
import Svg, { Circle, Path } from "react-native-svg";
import { RouteArt } from "./DeliveryDesign";
import { palette } from "@theme/colors";
import { money, orderTotal } from "@utils/format";
import {
  collectionLabel,
  customerName,
  dateTime,
  dueAmount,
} from "@utils/delivery";
import { navigateOrder, openLink, phoneDigits } from "@utils/contact";
import { STATUS_META, type DeliveryOrder } from "@/types/delivery";
const c = palette.dark;
export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg },
  content: { padding: 18, paddingTop: 4, gap: 18, paddingBottom: 28 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: c.brandMid,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.9,
    color: c.text,
  },
  subtitle: { fontSize: 13, lineHeight: 20, color: c.textDim },
  card: {
    backgroundColor: c.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EDE7DF",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.3,
  },
  body: { fontSize: 14, color: c.text, lineHeight: 21 },
  muted: { fontSize: 12, color: c.textDim, lineHeight: 18 },
  amount: {
    fontSize: 25,
    fontWeight: "800",
    color: c.text,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: c.brandMid,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  secondary: {
    backgroundColor: "#F6F2ED",
    borderWidth: 1,
    borderColor: "#EDE5DA",
  },
  secondaryText: { color: "#594335" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.borderHi,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: c.text,
    backgroundColor: c.surface,
  },
  divider: { height: 1, backgroundColor: c.border },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: c.soft,
    minHeight: 44,
    justifyContent: "center",
  },
});
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Press
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        ui.button,
        secondary && ui.secondary,
        (disabled || busy) && { opacity: 0.5 },
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? c.text : "#fff"} /> : icon}
      <Text style={[ui.buttonText, secondary && ui.secondaryText]}>
        {label}
      </Text>
    </Press>
  );
}
export function Badge({
  label,
  color = c.textDim,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: `${color}12`,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
export function SearchField({
  value,
  onChangeText,
  placeholder = "Buscar orden, cliente o dirección",
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E7DFD5",
        borderRadius: 16,
        paddingHorizontal: 14,
      }}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle
          cx={10.5}
          cy={10.5}
          r={6.5}
          stroke="#9B8878"
          strokeWidth={1.8}
        />
        <Path
          d="M16 16L21 21"
          stroke="#9B8878"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChangeText}
        style={[
          ui.input,
          {
            flex: 1,
            borderWidth: 0,
            paddingHorizontal: 0,
            backgroundColor: "transparent",
          },
        ]}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {items.map((item) => (
        <Press
          key={item.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === item.id }}
          onPress={() => onChange(item.id)}
          style={[ui.chip, value === item.id && { backgroundColor: "#32251C" }]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: value === item.id ? "#FFFFFF" : c.textDim,
            }}
          >
            {item.label}
          </Text>
        </Press>
      ))}
    </ScrollView>
  );
}
export function QueryNotice({
  loading,
  error,
  onRetry,
  empty,
  stale,
}: {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: string;
  stale?: boolean;
}) {
  if (loading)
    return (
      <View style={[ui.card, { alignItems: "center", padding: 28 }]}>
        <ActivityIndicator color={c.brandMid} />
        <Text style={ui.muted}>Cargando información…</Text>
      </View>
    );
  if (error)
    return (
      <View style={ui.card}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            backgroundColor: "#FFF0DD",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IcInfo size={19} color="#B87525" />
        </View>
        <Text style={ui.sectionTitle}>
          {stale ? "No se pudo actualizar" : "No se pudo cargar"}
        </Text>
        <Text style={ui.muted}>
          {stale ? "Ves la última información guardada. " : ""}
          {(error as any)?.status === 404
            ? "Esta información no está disponible. Consulta a caja o inténtalo más tarde."
            : (error as any)?.message ||
              "Revisa tu conexión e inténtalo de nuevo."}
        </Text>
        {onRetry && <Button label="Reintentar" secondary onPress={onRetry} />}
      </View>
    );
  if (empty)
    return (
      <View
        style={[
          ui.card,
          {
            paddingVertical: 28,
            alignItems: "center",
            gap: 8,
            borderStyle: "dashed",
            backgroundColor: "#FDFBF8",
          },
        ]}
      >
        <RouteArt width={145} />
        <Text style={[ui.sectionTitle, { textAlign: "center", marginTop: 4 }]}>
          {empty}
        </Text>
        <Text style={[ui.muted, { textAlign: "center", maxWidth: 245 }]}>
          Las órdenes que coincidan con esta vista aparecerán aquí.
        </Text>
      </View>
    );
  return null;
}
export function OrderCard({
  order,
  history = false,
  position,
}: {
  order: DeliveryOrder;
  history?: boolean;
  position?: number;
}) {
  const router = useRouter();
  const status = STATUS_META[order.status_tracker_id];
  const due = dueAmount(order);
  const phone = phoneDigits(order.delivery_phone);
  return (
    <View
      style={[
        ui.card,
        {
          borderTopWidth: 3,
          borderTopColor: order.pending_sync
            ? "#E2A444"
            : status?.color || c.border,
        },
      ]}
    >
      <Press
        accessibilityLabel={`Abrir orden ${order.id}, ${customerName(order)}`}
        onPress={() => router.push(`/order/${order.id}`)}
        style={{ gap: 10 }}
      >
        <View style={ui.between}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              flexShrink: 1,
            }}
          >
            <IcPackage size={15} color={c.brandMid} />
            <Text style={[ui.eyebrow, { fontSize: 10 }]}>
              {position ? `PARADA ${position} · ` : ""}ORDEN #{order.id}
            </Text>
          </View>
          <Badge
            label={
              order.pending_sync
                ? "Por sincronizar"
                : status?.label || "Estado desconocido"
            }
            color={order.pending_sync ? c.warning : status?.color}
          />
        </View>
        <View style={ui.between}>
          <Text style={[ui.sectionTitle, { flex: 1 }]}>
            {customerName(order)}
          </Text>
          <IcChevronRight size={18} color={c.textMuted} />
        </View>
        <View style={[ui.row, { alignItems: "flex-start" }]}>
          <IcMapPin size={16} color={c.textMuted} />
          <Text style={[ui.body, { flex: 1 }]}>
            {order.delivery_address || "Dirección pendiente de confirmar"}
          </Text>
        </View>
        {!!order.delivery_reference_point && (
          <Text style={ui.muted}>
            Referencia: {order.delivery_reference_point}
          </Text>
        )}
        <View style={ui.divider} />
        <View style={ui.between}>
          <View style={{ flex: 1 }}>
            <Text style={ui.muted}>{collectionLabel(order)}</Text>
            <Text
              style={[
                ui.body,
                {
                  fontSize: 18,
                  fontWeight: "800",
                  marginTop: 3,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {history
                ? money(orderTotal(order), order.currency_code)
                : due != null
                  ? money(due, order.currency_code)
                  : "Importe por confirmar"}
            </Text>
          </View>
          <Text style={[ui.muted, { maxWidth: 110, textAlign: "right" }]}>
            {dateTime(
              history
                ? order.activity_at || order.completed_at
                : order.ready_at ||
                    order.driver_assigned_at ||
                    order.created_at,
            )}
          </Text>
        </View>
      </Press>
      {!history && (
        <View style={ui.row}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              label="Navegar"
              icon={<IcNavigation size={16} color={c.text} />}
              onPress={() => navigateOrder(order)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              label="Llamar"
              disabled={!phone}
              icon={<IcPhone size={16} color={c.text} />}
              onPress={() => void openLink(`tel:${phone}`)}
            />
          </View>
        </View>
      )}
    </View>
  );
}
