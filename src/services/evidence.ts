import * as Location from "expo-location";
import type { CompletionDetails } from "@/types/delivery";
/** Location is best effort. A missing permission never prevents declaring an actual delivery. */
export async function captureDeliveryLocation(): Promise<CompletionDetails> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const position =
      (await Location.getLastKnownPositionAsync({
        maxAge: 60000,
        requiredAccuracy: 150,
      })) ||
      (await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]));
    if (!position) return {};
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_meters: position.coords.accuracy,
    };
  } catch {
    return {};
  }
}
