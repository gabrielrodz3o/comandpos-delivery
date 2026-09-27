import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useIncidents } from "@/hooks/useIncidents";
import { useRiderOperations } from "@hooks/useRiderOperations";
import { useAuthStore } from "@store/useAuthStore";
import { useSyncQueue } from "@store/useSyncQueue";
import { currentScope } from "@services/session";
import { ui, Button, QueryNotice } from "@components/ui/DeliveryUI";
import { PageHeading } from "@components/ui/DeliveryDesign";
import { IncidentList } from "@components/ui/IncidentList";
export default function IncidentsScreen() {
  const query = useIncidents(),
    operations = useRiderOperations(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const pending = useSyncQueue((s) => s.items).filter(
    (i) => i.owner === currentScope() && i.kind === "incident",
  );
  if (!token) return <Redirect href="/(auth)/login" />;
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <PageHeading title="Incidencias" eyebrow="Comunicación con despacho" />
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <Button label="Volver" secondary onPress={() => router.back()} />
        {!operations.data?.capabilities?.incidents && (
          <Text style={ui.body}>
            El seguimiento de incidencias requiere actualizar la matriz. Puedes
            comunicarte con caja.
          </Text>
        )}
        <QueryNotice
          loading={query.isFetching && !query.data}
          error={query.error}
          stale={!!query.data}
          onRetry={() => void query.refetch()}
        />
        {pending.map((item) => (
          <View style={ui.card} key={item.id}>
            <Text style={ui.sectionTitle}>{item.label}</Text>
            <Text style={ui.body}>{item.payload.notes}</Text>
            <Text style={ui.muted}>
              {item.state === "failed"
                ? item.error
                : "Guardada en el teléfono. Todavía no recibida por despacho."}
            </Text>
          </View>
        ))}
        <IncidentList items={query.data?.data || []} />
        {query.data && !query.data.data.length && !pending.length && (
          <QueryNotice
            empty="Sin incidencias"
            emptyHint="Aquí verás tus reportes y las respuestas de despacho. Cerrados: últimos 30 días."
          />
        )}
      </ScrollView>
    </View>
  );
}
