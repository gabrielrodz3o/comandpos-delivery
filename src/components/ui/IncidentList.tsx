import { Text, View } from "react-native";
import { ui, Badge } from "./DeliveryUI";
import { INCIDENT_TYPES, type DeliveryIncident } from "@/types/delivery";
import { dateTime } from "@utils/delivery";
import { palette } from "@theme/colors";
const labels = {
  open: "Enviada a despacho",
  acknowledged: "En revisión",
  resolved: "Resuelta",
  cancelled: "Cerrada sin acción",
};
export function IncidentList({ items }: { items: DeliveryIncident[] }) {
  return (
    <>
      {items.map((item) => (
        <View key={item.id} style={ui.card}>
          <Text style={ui.sectionTitle}>
            {INCIDENT_TYPES[item.incident_type] || "Incidencia"}
            {item.account_id ? ` · #${item.account_id}` : ""}
          </Text>
          <Badge
            label={labels[item.status]}
            color={
              item.status === "resolved"
                ? palette.dark.success
                : palette.dark.warning
            }
          />
          <Text style={ui.body}>{item.notes}</Text>
          <Text style={ui.muted}>{dateTime(item.created_at)}</Text>
          {item.response ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.sectionTitle}>Respuesta de despacho</Text>
              <Text style={ui.body}>{item.response}</Text>
            </View>
          ) : ["open", "acknowledged"].includes(item.status) ? (
            <Text style={ui.muted}>
              Pendiente de instrucciones. El reporte no cancela ni completa el
              pedido.
            </Text>
          ) : null}
          {!!item.resolved_at && (
            <Text style={ui.muted}>Cierre: {dateTime(item.resolved_at)}</Text>
          )}
        </View>
      ))}
    </>
  );
}
