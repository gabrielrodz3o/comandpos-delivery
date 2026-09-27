import * as ImagePicker from "expo-image-picker";
export async function takeDeliveryPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Permite usar la cámara para tomar una constancia. Puedes continuar sin foto.",
    );
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.2,
    base64: true,
    allowsEditing: true,
    aspect: [4, 3],
    exif: false,
  });
  if (result.canceled) return null;
  const base64 = result.assets[0]?.base64;
  if (!base64)
    throw new Error("No se pudo preparar la foto. Inténtalo de nuevo.");
  if (base64.length > 600000)
    throw new Error(
      "La foto es demasiado grande. Recorta más el paquete e inténtalo de nuevo.",
    );
  return base64;
}
