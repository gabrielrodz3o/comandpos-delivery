import { useConfirmation } from "@hooks/useConfirmation";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrder,
  getDeliveryPhoto,
  pickupRoute,
  groupMine,
} from "@services/delivery";
import { currentScope, sessionKey, ordersKey } from "@services/session";
import { useAuthStore } from "@store/useAuthStore";
import { useSyncQueue } from "@store/useSyncQueue";
import {
  queueMarkDelivered,
  applyPending,
  queueIncident,
} from "@services/sync";
import { showToast } from "@store/useToastStore";
import {
  ui,
  Button,
  Badge,
  Chips,
  QueryNotice,
} from "@components/ui/DeliveryUI";
import { money, orderTotal } from "@utils/format";
import {
  collectionLabel,
  customerName,
  dueAmount,
  dateTime,
  isActive,
} from "@utils/delivery";
import { navigateOrder, phoneDigits, openLink } from "@utils/contact";
import { STATUS_META, INCIDENT_TYPES } from "@/types/delivery";
import {
  canRecordOffline,
  amountInput,
  collectionTotal,
} from "@utils/operations";
import { takeDeliveryPhoto } from "@services/photoEvidence";
import { captureDeliveryLocation } from "@services/evidence";
import { CollectionForm, emptyCollection } from "@components/ui/CollectionForm";
import { IncidentList } from "@components/ui/IncidentList";
import { useRiderOperations } from "@hooks/useRiderOperations";
import type { CompletionDetails, MyOrdersResponse } from "@/types/delivery";
import { palette } from "@theme/colors";
const c = palette.dark;
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog } = useConfirmation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { token } = useAuthStore();
  const scope = currentScope();
  const operations = useRiderOperations();
  const [collection, setCollection] = useState(emptyCollection);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const items = useSyncQueue((s) => s.items);
  const query = useQuery({
    queryKey: sessionKey(scope, "order", id),
    queryFn: ({ signal }) => getOrder(Number(id), signal),
    enabled: !!token && Number(id) > 0,
    initialData: () =>
      qc
        .getQueryData<MyOrdersResponse>(ordersKey(scope))
        ?.data.find((o) => o.id === Number(id)),
    initialDataUpdatedAt: () =>
      qc.getQueryState(ordersKey(scope))?.dataUpdatedAt,
  });
  const order = query.data ? applyPending([query.data], items, scope)[0] : null;
  const [photo, setPhoto] = useState<string | null>(null);
  const photoQuery = useQuery({
    queryKey: sessionKey(scope, "proof", id),
    queryFn: ({ signal }) => getDeliveryPhoto(Number(id), signal),
    enabled: !!token && !!query.data?.has_photo,
    meta: { persist: false },
  });
  const [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<keyof typeof INCIDENT_TYPES>(
    "customer_unreachable",
  );
  const [notes, setNotes] = useState("");
  const pending = items.some(
    (i) => i.owner === scope && i.accountId === Number(id),
  );
  const refresh = () =>
    void qc.invalidateQueries({ queryKey: sessionKey(scope) });
  const execute = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      refresh();
      showToast({ message, variant: "success" });
    } catch (e: any) {
      showToast({
        message: e.message || "No se pudo completar la acción.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  if (!token) return null;
  if (!order)
    return (
      <View
        style={[
          ui.page,
          { paddingTop: insets.top + 16, paddingHorizontal: 18, gap: 16 },
        ]}
      >
        <Button secondary label="Volver" onPress={() => router.back()} />
        <QueryNotice
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  const due = dueAmount(order);
  const phone = phoneDigits(order.delivery_phone);
  const state = STATUS_META[order.status_tracker_id];
  const pickup = () =>
    confirm(
      "Confirmar recogida",
      order.delivery_route_id
        ? "Se iniciará el viaje y se registrará la recogida de sus órdenes listas. Verifica cada pedido, bolsas, bebidas y observaciones antes de salir."
        : "Verifica pedido, bolsas, bebidas y observaciones antes de confirmar que lo llevas contigo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recogí el pedido",
          onPress: () =>
            void execute(async () => {
              let routeId = order.delivery_route_id;
              if (!routeId)
                routeId = (await groupMine([order.id]))?.data?.route_id;
              if (!routeId) throw new Error("No se pudo confirmar el viaje.");
              const res = await pickupRoute({ routeId });
              // 200 con picked vacío = el servidor no selló nada; no fingir éxito.
              if (!res?.data?.picked?.length)
                throw new Error(
                  res?.message ||
                    "El servidor no registró la recogida. Revisa el estado del viaje.",
                );
            }, "Recogida registrada."),
        },
      ],
    );
  const deliver = () => {
    if (!canRecordOffline(query.error))
      return showToast({
        message:
          "El pedido cambió o ya no está disponible. Actualiza antes de confirmar.",
        variant: "warning",
      });
    if (order.proof_of_delivery_enabled && recipient.trim().length < 2)
      return showToast({
        message: "Indica el nombre de quien recibió el pedido.",
        variant: "warning",
      });
    if (order.rider_collection_id && due === null)
      return showToast({
        message: "Confirma el importe con caja antes de cerrar la entrega.",
        variant: "warning",
      });
    let declaration: CompletionDetails["collection"];
    if (
      order.rider_collection_id &&
      due != null &&
      operations.data?.capabilities?.completion_details
    ) {
      const cash = amountInput(collection.cash),
        card = amountInput(collection.card),
        transfer = amountInput(collection.transfer),
        other = amountInput(collection.other);
      if (cash === null || card === null || transfer === null || other === null)
        return showToast({
          message:
            "Completa los importes recibidos con un máximo de dos decimales.",
          variant: "warning",
        });
      declaration = {
        cash,
        card,
        transfer,
        other,
        notes: collection.notes.trim(),
        expected_amount: due,
        currency_code: order.currency_code || "DOP",
      };
      if (
        Math.abs(collectionTotal(declaration) - due) > 0.009 &&
        !declaration.notes
      )
        return showToast({
          message: "Explica la diferencia del cobro para caja.",
          variant: "warning",
        });
    }
    const occurredAt = new Date().toISOString();
    confirm(
      "Confirmar entrega",
      due != null && due > 0
        ? `Confirma que entregaste el pedido. ${declaration ? `Cobro declarado: ${money(collectionTotal(declaration), order.currency_code)}.` : `Importe esperado: ${money(due, order.currency_code)}. Caja verificará el cobro.`}`
        : "Confirma que entregaste el pedido al cliente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: declaration ? "Guardar cobro y entrega" : "Confirmar entrega",
          onPress: async () => {
            setBusy(true);
            try {
              const evidence = await captureDeliveryLocation();
              if (currentScope() !== scope)
                throw new Error("La sesión cambió. Abre nuevamente el pedido.");
              const result = await queueMarkDelivered(
                order,
                recipient.trim() || undefined,
                {
                  ...evidence,
                  occurred_at: occurredAt,
                  collection: declaration,
                  photo_base64: photo || undefined,
                },
              );
              if (!result.queued)
                showToast({
                  message: "Entrega confirmada.",
                  variant: "success",
                });
              refresh();
            } catch (e: any) {
              showToast({ message: e.message, variant: "error" });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <View style={[ui.header, ui.between]}>
        <Button secondary label="Volver" onPress={() => router.back()} />
        <Badge
          label={
            order.pending_sync
              ? "Entrega por sincronizar"
              : state?.label || "Por confirmar"
          }
          color={state?.color}
        />
      </View>
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <Text style={ui.eyebrow}>
          ORDEN #{order.id} · {order.location_name || "Delivery"}
        </Text>
        <Text style={ui.title}>{customerName(order)}</Text>
        <QueryNotice
          error={query.error}
          stale
          onRetry={() => void query.refetch()}
        />
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Entregar en</Text>
          <Text style={ui.body}>
            {order.delivery_address || "Dirección por confirmar con caja"}
          </Text>
          {!!order.delivery_neighborhood && (
            <Text style={ui.muted}>{order.delivery_neighborhood}</Text>
          )}
          {!!order.delivery_reference_point && (
            <Text style={ui.body}>
              Referencia: {order.delivery_reference_point}
            </Text>
          )}
          {!!order.delivery_notes && (
            <View
              style={{
                backgroundColor: "#FFF6E5",
                padding: 12,
                borderRadius: 12,
              }}
            >
              <Text style={ui.body}>{order.delivery_notes}</Text>
            </View>
          )}
          <Button
            label="Navegar a la dirección"
            onPress={() => navigateOrder(order)}
          />
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                label="Llamar"
                disabled={!phone}
                onPress={() => void openLink(`tel:${phone}`)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                label="WhatsApp"
                disabled={!phone}
                onPress={() => void openLink(`https://wa.me/${phone}`)}
              />
            </View>
          </View>
        </View>
        <View style={ui.card}>
          <Text style={ui.sectionTitle}>Pedido y cobro</Text>
          <View style={ui.between}>
            <Text style={ui.body}>Total de la factura</Text>
            <Text style={[ui.body, { fontWeight: "800" }]}>
              {money(orderTotal(order), order.currency_code)}
            </Text>
          </View>
          <View style={ui.divider} />
          <Text style={ui.eyebrow}>
            {order.status_tracker_id === 7
              ? "Situación de liquidación"
              : "Pendiente de cobrar"}
          </Text>
          <Text style={ui.amount}>
            {due === null ? "Por confirmar" : money(due, order.currency_code)}
          </Text>
          <Badge label={collectionLabel(order)} color={c.brandMid} />
          <Text style={ui.muted}>
            Medio indicado por caja:{" "}
            {order.expected_payment_type_name || "Sin confirmar"}
          </Text>
          {Array.isArray(order.payment_breakdown) &&
            order.payment_breakdown.length > 1 && (
              <Text style={ui.muted}>
                Pago combinado:{" "}
                {order.payment_breakdown
                  .map(
                    (p) =>
                      `${money(p.amount, order.currency_code)} (medio #${p.payment_type_id})`,
                  )
                  .join(" + ")}
                .
              </Text>
            )}
          <Text style={ui.muted}>
            Caja confirma el cobro y la liquidación. El fondo de cambio se
            consulta en Mi dinero.
          </Text>
        </View>
        {order.status_tracker_id === 6 &&
          order.rider_collection_id &&
          due != null &&
          operations.data?.capabilities?.completion_details && (
            <CollectionForm
              value={collection}
              onChange={setCollection}
              due={due}
              currency={order.currency_code || "DOP"}
            />
          )}
        {!!order.completion_declaration?.collection && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Cobro declarado</Text>
            <Text style={ui.amount}>
              {money(
                collectionTotal(order.completion_declaration.collection),
                order.currency_code,
              )}
            </Text>
            <Text style={ui.body}>
              {order.completion_declaration.collection.notes}
            </Text>
            <Text style={ui.muted}>
              Pendiente de validación contable por caja.
            </Text>
          </View>
        )}
        <Button
          secondary
          label={
            timelineOpen ? "Ocultar seguimiento" : "Ver seguimiento del pedido"
          }
          onPress={() => setTimelineOpen((v) => !v)}
        />
        {timelineOpen && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Seguimiento</Text>
            <Text style={ui.body}>
              Asignada: {dateTime(order.driver_assigned_at)}
            </Text>
            <Text style={ui.body}>
              Recogida:{" "}
              {order.picked_up_at ? dateTime(order.picked_up_at) : "Pendiente"}
            </Text>
            <Text style={ui.body}>
              Entregada:{" "}
              {order.completed_at ? dateTime(order.completed_at) : "Pendiente"}
            </Text>
            {order.delivery_route_id && (
              <Text style={ui.muted}>
                Viaje #{order.delivery_route_id} · Parada{" "}
                {order.delivery_route_order || "por definir"}
              </Text>
            )}
          </View>
        )}
        {!!order.incidents?.length && <IncidentList items={order.incidents} />}
        {isActive(order) && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>
              ¿Necesitas ayuda con esta entrega?
            </Text>
            <Text style={ui.muted}>
              Reporta lo sucedido para que caja pueda ayudarte. El aviso no
              cancela automáticamente la orden.
            </Text>
            <Button
              secondary
              label={incidentOpen ? "Cerrar reporte" : "Reportar incidencia"}
              disabled={busy || !operations.data?.capabilities?.incidents}
              onPress={() => setIncidentOpen((v) => !v)}
            />
            {incidentOpen && (
              <>
                <Chips
                  items={Object.entries(INCIDENT_TYPES).map(([id, label]) => ({
                    id,
                    label,
                  }))}
                  value={incidentType}
                  onChange={(v) =>
                    setIncidentType(v as keyof typeof INCIDENT_TYPES)
                  }
                />
                <TextInput
                  style={[
                    ui.input,
                    { minHeight: 100, textAlignVertical: "top" },
                  ]}
                  accessibilityLabel="Detalle de la incidencia"
                  placeholder="Describe lo que sucedió"
                  placeholderTextColor={c.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={2000}
                />
                <Button
                  label="Enviar reporte a caja"
                  busy={busy}
                  disabled={notes.trim().length < 3}
                  onPress={() =>
                    void execute(async () => {
                      const result = await queueIncident(
                        order.id,
                        incidentType,
                        notes.trim(),
                      );
                      setNotes("");
                      setIncidentOpen(false);
                    }, "Reporte guardado. Consulta su estado en Incidencias.")
                  }
                />
              </>
            )}
          </View>
        )}
        {order.status_tracker_id === 6 && order.proof_of_delivery_enabled && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Constancia de entrega</Text>
            <Text style={ui.muted}>
              Nombre de la persona que recibió el pedido.
            </Text>
            <TextInput
              style={ui.input}
              value={recipient}
              onChangeText={setRecipient}
              maxLength={160}
              accessibilityLabel="Nombre de quien recibe"
              placeholder="Nombre del receptor"
              placeholderTextColor={c.textMuted}
            />
          </View>
        )}
        {order.status_tracker_id === 6 &&
          operations.data?.capabilities?.photo_evidence && (
            <View style={ui.card}>
              <Text style={ui.sectionTitle}>Foto de entrega · opcional</Text>
              <Text style={ui.muted}>
                Fotografía el paquete entregado. Evita incluir rostros o
                documentos del cliente.
              </Text>
              {photo && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo}` }}
                  style={{ height: 180, borderRadius: 12 }}
                  resizeMode="contain"
                  accessibilityLabel="Foto de la entrega pendiente de enviar"
                />
              )}
              <Button
                secondary
                label={photo ? "Tomar otra foto" : "Tomar foto del paquete"}
                busy={busy}
                onPress={() => {
                  setBusy(true);
                  void takeDeliveryPhoto()
                    .then((value) => {
                      if (value && currentScope() === scope) setPhoto(value);
                    })
                    .catch((e) =>
                      showToast({ message: e.message, variant: "warning" }),
                    )
                    .finally(() => setBusy(false));
                }}
              />
              {photo && (
                <Button
                  secondary
                  label="Quitar foto"
                  onPress={() => setPhoto(null)}
                />
              )}
            </View>
          )}
        {!!photoQuery.data && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Constancia fotográfica</Text>
            <Image
              source={{ uri: photoQuery.data }}
              style={{ height: 220, borderRadius: 12 }}
              resizeMode="contain"
              accessibilityLabel="Constancia de entrega registrada"
            />
          </View>
        )}
        {pending && (
          <View style={ui.card}>
            <Text style={ui.body}>
              Esta orden tiene un cambio pendiente. Consulta su estado en Cuenta
              antes de repetir la acción.
            </Text>
          </View>
        )}
      </ScrollView>
      {[4, 5, 6].includes(order.status_tracker_id) && (
        <View
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
          }}
        >
          {!!query.error &&
            canRecordOffline(query.error) &&
            order.status_tracker_id === 6 && (
              <Text style={ui.muted}>
                La entrega se guardará en este teléfono hasta recibir
                confirmación del servidor.
              </Text>
            )}
          {!!query.error && !canRecordOffline(query.error) && (
            <Text style={ui.muted}>
              Actualiza el pedido o consulta a caja para resolver el bloqueo.
            </Text>
          )}
          <Button
            label={
              order.status_tracker_id === 6
                ? "Confirmar entrega"
                : "Confirmar recogida"
            }
            busy={busy}
            disabled={
              pending ||
              (order.status_tracker_id === 6
                ? !canRecordOffline(query.error)
                : !!query.error)
            }
            onPress={order.status_tracker_id === 6 ? deliver : pickup}
          />
        </View>
      )}
      {dialog}
    </View>
  );
}
