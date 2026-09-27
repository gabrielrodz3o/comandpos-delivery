import { useState } from "react";
import { Keyboard, type AlertButton } from "react-native";
import { ConfirmSheet } from "@components/ui/ConfirmSheet";
/** One confirmation surface on native and web, using the app's accessible controls. */
export function useConfirmation() {
  const [request, setRequest] = useState<{
    title: string;
    message?: string;
    buttons: AlertButton[];
  } | null>(null);
  const action = request?.buttons.find((button) => button.style !== "cancel");
  const cancel = request?.buttons.find((button) => button.style === "cancel");
  const confirm = (
    title: string,
    message?: string,
    buttons: AlertButton[] = [{ text: "Entendido" }],
  ) => {
    Keyboard.dismiss();
    setRequest({ title, message, buttons });
  };
  const dialog = (
    <ConfirmSheet
      visible={!!request}
      title={request?.title || ""}
      message={request?.message}
      confirmText={action?.text || "Confirmar"}
      cancelText={cancel?.text || "Cancelar"}
      tone={action?.style === "destructive" ? "danger" : "primary"}
      onClose={() => setRequest(null)}
      onConfirm={() => action?.onPress?.()}
    />
  );
  return { confirm, dialog };
}
