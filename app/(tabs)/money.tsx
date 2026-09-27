import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Share } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  useRiderFinances,
  useRiderOperations,
} from "@hooks/useRiderOperations";
import { getSettlements } from "@services/delivery";
import { currentScope, sessionKey } from "@services/session";
import { ui, Button, Badge, QueryNotice } from "@components/ui/DeliveryUI";
import { PageHeading, SectionLabel } from "@components/ui/DeliveryDesign";
import { IcWallet } from "@components/ui/icons";
import { money } from "@utils/format";
import { dateTime } from "@utils/delivery";
import { palette } from "@theme/colors";
import { showToast } from "@store/useToastStore";
const c = palette.dark;
export default function MoneyScreen() {
  const finances = useRiderFinances(),
    operations = useRiderOperations(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);
  const receipts = useInfiniteQuery({
    queryKey: sessionKey(currentScope(), "settlements"),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => getSettlements(pageParam, signal),
    getNextPageParam: (last) => last.next_offset ?? undefined,
    enabled: !!operations.data?.capabilities?.settlements,
  });
  return (
    <View style={[ui.page, { paddingTop: insets.top }]}>
      <PageHeading
        title="Mi dinero"
        eyebrow="Cobros y liquidaciones"
        icon={<IcWallet size={24} color={c.brandMid} />}
      />
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={finances.isRefetching || receipts.isRefetching}
            onRefresh={() => {
              void finances.refetch();
              if (operations.data?.capabilities?.settlements)
                void receipts.refetch();
            }}
          />
        }
      >
        <SectionLabel
          title="Saldo pendiente"
          caption="Fondos recibidos y cobros pendientes de liquidar."
          icon={<IcWallet size={19} color={c.brandMid} />}
        />
        <QueryNotice
          loading={finances.isLoading}
          error={finances.error}
          stale={!!finances.data}
          onRetry={() => void finances.refetch()}
        />
        {finances.data?.summaries.map((summary) => (
          <View
            key={summary.currency_code}
            style={[
              ui.card,
              { backgroundColor: "#FFF6EC", borderColor: "#F1DCC7" },
            ]}
          >
            <View style={ui.between}>
              <Text style={ui.eyebrow}>PENDIENTE DE LIQUIDAR</Text>
              <Badge label={summary.currency_code} color={c.brandMid} />
            </View>
            <Text style={[ui.amount, { fontSize: 32, color: "#7C381B" }]}>
              {money(summary.pending_settlement, summary.currency_code)}
            </Text>
            <Text style={ui.muted}>
              Saldo de pedidos entregados por revisar en caja
            </Text>
            {!!summary.declarations_count && (
              <>
                <MoneyLine
                  label="Declaraste haber recibido"
                  value={money(
                    summary.declared_received ?? null,
                    summary.currency_code,
                  )}
                />
                <MoneyLine
                  label="Efectivo declarado"
                  value={money(
                    summary.declared_cash ?? null,
                    summary.currency_code,
                  )}
                />
              </>
            )}
            <View style={ui.divider} />
            <MoneyLine
              label="Fondo de cambio por devolver"
              value={money(summary.fund_to_return, summary.currency_code)}
            />

            <View style={ui.divider} />
            <MoneyLine
              label="Pendiente de cobrar a clientes"
              value={money(summary.pending_collection, summary.currency_code)}
            />
            {summary.pending_review > 0 && (
              <MoneyLine
                label="Importes que caja debe revisar"
                value={money(summary.pending_review, summary.currency_code)}
              />
            )}
            <Text style={ui.muted}>
              Caja confirma los medios de pago y el cierre. Estos importes no
              son tus ganancias.
            </Text>
          </View>
        ))}
        {finances.data && !finances.data.summaries.length && (
          <QueryNotice
            empty="Todo al día"
            emptyHint="No tienes fondos ni cobros pendientes de liquidar en esta sucursal."
          />
        )}
        {!!finances.data?.funds.length && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Fondos entregados por caja</Text>
            {finances.data.funds.map((f) => (
              <View
                key={f.id}
                style={{
                  gap: 5,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderColor: c.border,
                }}
              >
                <View style={ui.between}>
                  <Text style={[ui.body, { fontWeight: "800" }]}>
                    {money(f.amount, f.currency_code)}
                  </Text>
                  <Badge
                    label={
                      f.status === "open"
                        ? "Por devolver"
                        : f.status === "returned"
                          ? "Devuelto"
                          : "Cancelado"
                    }
                    color={f.status === "open" ? c.warning : c.textDim}
                  />
                </View>
                <Text style={ui.muted}>
                  {f.given_by_name || "Caja"}
                  {f.box_name ? ` · ${f.box_name}` : ""}
                </Text>
                <Text style={ui.muted}>
                  Entregado: {dateTime(f.created_at)}
                  {f.returned_at
                    ? `\nDevuelto: ${dateTime(f.returned_at)}`
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
        {!!finances.data?.collections.length && (
          <View style={ui.card}>
            <Text style={ui.sectionTitle}>Órdenes con custodia pendiente</Text>
            {finances.data.collections.map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 7,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderColor: c.border,
                }}
              >
                <MoneyLine
                  label={`#${item.account_id} · ${item.customer_name || "Cliente"}`}
                  value={money(item.balance, item.currency_code)}
                />
                <Text style={ui.muted}>
                  {item.stage === "settlement"
                    ? "Pendiente de liquidar"
                    : item.stage === "review"
                      ? "Revisar con caja"
                      : "Pendiente de cobrar"}{" "}
                  · {item.payment_method || "Medio por confirmar"}
                </Text>
                <Button
                  secondary
                  label={`Ver orden #${item.account_id}`}
                  onPress={() => router.push(`/order/${item.account_id}`)}
                />
              </View>
            ))}
          </View>
        )}
        {finances.data && (
          <Text style={ui.muted}>
            Última consulta: {dateTime(finances.data.updated_at)}. Fondos
            cerrados: últimos 30 días.
          </Text>
        )}

        <SectionLabel
          title="Comprobantes de liquidación"
          caption="Cierres registrados por caja"
        />
        <QueryNotice
          loading={receipts.isFetching && !receipts.data}
          error={receipts.error}
          stale={!!receipts.data}
          onRetry={() => void receipts.refetch()}
        />
        {!operations.data?.capabilities?.settlements && (
          <Text style={ui.muted}>
            Actualiza la matriz para consultar comprobantes.
          </Text>
        )}
        {receipts.data?.pages
          .flatMap((p) => p.data)
          .map((receipt) => (
            <View style={ui.card} key={receipt.id}>
              <Text style={ui.sectionTitle}>{dateTime(receipt.closed_at)}</Text>
              <Badge
                label={
                  receipt.status === "reverted"
                    ? "Liquidación revertida"
                    : "Liquidación registrada"
                }
                color={receipt.status === "reverted" ? c.warning : c.success}
              />
              <Text style={ui.body}>
                {receipt.cashier_name} · {receipt.location_name}
              </Text>
              <Text style={ui.muted}>
                {receipt.orders_count} pedidos · Comprobante {receipt.id}
              </Text>
              {receipt.currencies.map((currency) => (
                <Text style={ui.amount} key={currency.currency_code}>
                  {money(currency.amount, currency.currency_code)}
                </Text>
              ))}
              {receipt.currencies.length === 1 && (
                <Text style={ui.body}>
                  Diferencia registrada por caja:{" "}
                  {money(receipt.variance, receipt.currencies[0].currency_code)}
                </Text>
              )}
              {receipt.currencies.length > 1 && (
                <Text style={ui.muted}>
                  Comprobante con varias monedas. Consulta diferencias con caja.
                </Text>
              )}
              {!!receipt.notes && <Text style={ui.body}>{receipt.notes}</Text>}
              <Button
                secondary
                label={
                  expanded === receipt.id
                    ? "Ocultar pedidos"
                    : "Ver pedidos del comprobante"
                }
                onPress={() =>
                  setExpanded(expanded === receipt.id ? null : receipt.id)
                }
              />
              {expanded === receipt.id &&
                receipt.payments.map((payment, i) => (
                  <View key={i} style={ui.row}>
                    <Text style={[ui.body, { flex: 1 }]}>
                      #{payment.account_id} · {payment.payment_method}
                    </Text>
                    <Text style={ui.body}>
                      {money(payment.amount, payment.currency_code)}
                    </Text>
                  </View>
                ))}
              <Button
                secondary
                label="Compartir comprobante"
                onPress={() => {
                  void Share.share({
                    message: [
                      `ComandPOS · Liquidación ${receipt.id}`,
                      `Estado: ${receipt.status === "reverted" ? "Revertida" : "Registrada"}`,
                      dateTime(receipt.closed_at),
                      `Caja: ${receipt.cashier_name} · ${receipt.location_name}`,
                      ...receipt.currencies.map((c) =>
                        money(c.amount, c.currency_code),
                      ),
                      ...receipt.payments.map(
                        (p) =>
                          `#${p.account_id} · ${p.payment_method} · ${money(p.amount, p.currency_code)}`,
                      ),
                      receipt.notes || "",
                    ].join("\n"),
                  }).catch(() =>
                    showToast({
                      message: "No se pudo compartir el comprobante.",
                      variant: "error",
                    }),
                  );
                }}
              />
            </View>
          ))}
        {receipts.data && !receipts.data.pages[0].data.length && (
          <QueryNotice
            empty="Aún no hay liquidaciones"
            emptyHint="Cuando caja cierre una liquidación, podrás consultar y compartir su comprobante aquí."
          />
        )}
        {receipts.hasNextPage && (
          <Button
            secondary
            label="Más comprobantes"
            busy={receipts.isFetchingNextPage}
            onPress={() => void receipts.fetchNextPage()}
          />
        )}
        <Button
          secondary
          label="Historial de entregas"
          onPress={() => router.push("/(tabs)/history")}
        />
      </ScrollView>
    </View>
  );
}
function MoneyLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={[ui.between, { alignItems: "flex-start" }]}>
      <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
      <Text
        style={[ui.body, { fontWeight: "800", fontVariant: ["tabular-nums"] }]}
      >
        {value}
      </Text>
    </View>
  );
}
