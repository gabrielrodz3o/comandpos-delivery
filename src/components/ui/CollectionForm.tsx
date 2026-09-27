import { View, Text, TextInput } from "react-native";
import { ui, Chips } from "./DeliveryUI";
import { money } from "@utils/format";
import { amountInput } from "@utils/operations";
export type CollectionDraft = {
  cash: string;
  card: string;
  transfer: string;
  other: string;
  notes: string;
  tendered: string;
};
export const emptyCollection: CollectionDraft = {
  cash: "",
  card: "0",
  transfer: "0",
  other: "0",
  notes: "",
  tendered: "",
};
export function CollectionForm({
  value,
  onChange,
  due,
  currency,
}: {
  value: CollectionDraft;
  onChange: (v: CollectionDraft) => void;
  due: number;
  currency: string;
}) {
  const entries = [
    ["cash", "Efectivo"],
    ["card", "Tarjeta"],
    ["transfer", "Transferencia"],
    ["other", "Otro"],
  ] as const;
  const amounts = entries.map(([key]) => amountInput(value[key]));
  const valid = amounts.every((x) => x !== null);
  const total = valid
    ? Math.round(amounts.reduce<number>((sum, x) => sum + (x || 0), 0) * 100) /
      100
    : null;
  const tendered = amountInput(value.tendered),
    cash = amountInput(value.cash);
  return (
    <View style={ui.card}>
      <Text style={ui.sectionTitle}>¿Cuánto recibiste?</Text>
      <Text style={ui.body}>Por cobrar: {money(due, currency)}</Text>
      <Text style={ui.muted}>
        Elige un medio para completar el importe o reparte el cobro entre
        varios. Caja revisará tu declaración.
      </Text>
      <Chips
        value=""
        items={entries.map(([id, label]) => ({ id, label }))}
        onChange={(key) =>
          onChange({
            ...value,
            cash: "0",
            card: "0",
            transfer: "0",
            other: "0",
            [key]: due.toFixed(2),
          })
        }
      />
      {entries.map(([key, label]) => (
        <View key={key} style={{ gap: 5 }}>
          <Text style={ui.body}>{label}</Text>
          <TextInput
            style={ui.input}
            accessibilityLabel={`Importe recibido en ${label}`}
            value={value[key]}
            onChangeText={(text) => onChange({ ...value, [key]: text })}
            keyboardType="decimal-pad"
            maxLength={13}
            placeholder="0.00"
          />
        </View>
      ))}
      <Text style={ui.body}>Total declarado: {money(total, currency)}</Text>
      {total !== null && Math.abs(total - due) > 0.009 && (
        <Text style={[ui.body, { color: "#9A3412" }]}>
          Diferencia: {money(total - due, currency)}. Explica el motivo antes de
          continuar.
        </Text>
      )}
      <TextInput
        style={ui.input}
        accessibilityLabel="Observación del cobro"
        value={value.notes}
        onChangeText={(notes) => onChange({ ...value, notes })}
        placeholder="Referencia de pago o motivo de la diferencia"
        multiline
        maxLength={1000}
      />
      {cash !== null && cash > 0 && (
        <>
          <Text style={ui.body}>Calculadora de cambio</Text>
          <TextInput
            style={ui.input}
            accessibilityLabel="Billetes recibidos para calcular cambio"
            value={value.tendered}
            onChangeText={(tendered) => onChange({ ...value, tendered })}
            keyboardType="decimal-pad"
            placeholder="¿Con cuánto efectivo paga?"
            maxLength={13}
          />
          {tendered !== null && (
            <Text style={ui.body}>
              {tendered >= cash
                ? `Cambio: ${money(Math.round((tendered - cash) * 100) / 100, currency)}`
                : "El efectivo recibido es menor al cobro declarado."}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
