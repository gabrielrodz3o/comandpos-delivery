import { Linking } from "react-native";
import type { DeliveryOrder } from "@/types/delivery";
import { hasCoordinates } from "./delivery";
import { showToast } from "@store/useToastStore";
export async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    showToast({
      message:
        "No se pudo abrir. Revisa las aplicaciones disponibles en tu dispositivo.",
      variant: "error",
    });
  }
}
export function navigateOrder(order: DeliveryOrder) {
  const destination = hasCoordinates(order)
    ? `${order.delivery_lat},${order.delivery_lng}`
    : order.delivery_address;
  if (!destination)
    return showToast({
      message: "Esta orden no tiene dirección. Contacta a caja.",
      variant: "warning",
    });
  void openLink(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
  );
}
export const phoneDigits = (phone?: string | null) => {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length === 10 && /^(809|829|849)/.test(digits)
    ? `1${digits}`
    : digits;
};
