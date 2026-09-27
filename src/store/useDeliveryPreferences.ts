import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
export const useDeliveryPreferences = create<{
  tracking: Record<string, boolean>;
  setTracking: (scope: string, value: boolean) => void;
}>()(
  persist(
    (set) => ({
      tracking: {},
      setTracking: (scope, value) =>
        set((s) => ({ tracking: { ...s.tracking, [scope]: value } })),
    }),
    {
      name: "delivery-preferences",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
