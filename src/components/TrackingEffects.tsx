import { useEffect } from "react";
import { useMyOrders } from "@hooks/useMyOrders";
import { useDeliveryPreferences } from "@store/useDeliveryPreferences";
import { useAuthStore } from "@store/useAuthStore";
import { currentScope } from "@services/session";
import { startLocationSharing, stopLocationSharing } from "@services/tracking";
import { useRiderOperations } from "@hooks/useRiderOperations";
import { showToast } from "@store/useToastStore";
let trackingSequence: Promise<void> = Promise.resolve();
export function TrackingEffects() {
  const scope = currentScope(),
    token = useAuthStore((s) => s.token),
    orders = useMyOrders(),
    operations = useRiderOperations();
  const enabled = useDeliveryPreferences((s) => !!s.tracking[scope || ""]);
  const active =
    orders.active.some((o) => o.status_tracker_id === 6) &&
    !!operations.data?.capabilities?.tracking;
  useEffect(() => {
    let current = true;
    const valid = () =>
      current &&
      currentScope() === scope &&
      useAuthStore.getState().token === token;
    trackingSequence = trackingSequence
      .catch(() => {})
      .then(async () => {
        if (token && enabled && active && valid())
          await startLocationSharing(valid);
        else await stopLocationSharing();
      })
      .catch(() => {
        if (valid())
          showToast({
            message:
              "No se pudo iniciar el seguimiento. Revisa los permisos en Cuenta.",
            variant: "warning",
          });
      });
    return () => {
      current = false;
      trackingSequence = trackingSequence
        .catch(() => {})
        .then(() => stopLocationSharing());
    };
  }, [token, scope, enabled, active]);
  return null;
}
