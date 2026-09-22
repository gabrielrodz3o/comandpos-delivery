# Arreglar push en Android (FCM V1) — sin afectar iPhone

## Síntoma
Al asignar un repartidor, la notificación **llega a iPhone pero NO a Android** (a ningún
repartidor, incluso uno nuevo).

## Causa
El push de Android se entrega con **Firebase Cloud Messaging (FCM V1)**. Este proyecto
**no tiene FCM configurado**:
- No existe `google-services.json` en el repo.
- `app.json` no declara `android.googleServicesFile`.
- (Posible) No está subida la **clave de servicio FCM V1** a Expo (EAS credentials).

iOS funciona porque usa **APNs**, que sí está configurado y es independiente de FCM.

> Datos del proyecto: package Android `com.comandpos.delivery`, EAS projectId
> `17cd5c50-d02c-49e6-90b2-64921a48c2ad`, Expo SDK 54.

---

## ✅ Garantía: esto NO afecta a iPhone
Todos los pasos son **exclusivos de Android**. iOS no cambia:
- `google-services.json` y `android.googleServicesFile` solo aplican al bloque `android` de `app.json`.
- La clave **FCM V1** en EAS es un credential **de Android**; las credenciales de iOS (APNs) no se tocan.
- El rebuild es **solo de Android** (`eas build -p android`). No se genera ni se sube un build de iOS.
- No se modifica el bloque `ios` de `app.json` ni `infoPlist` (APNs/`remote-notification` quedan igual).

---

## Pasos

### 1) Firebase: crear la app Android y bajar `google-services.json`
1. Entra a https://console.firebase.google.com → crea (o reutiliza) un proyecto.
2. **Agregar app → Android.**
3. **Android package name:** `com.comandpos.delivery` (debe ser EXACTO al de `app.json`).
4. Registra la app y **descarga `google-services.json`**.

> No necesitas agregar el SDK de Firebase manualmente; Expo lo cablea con el plugin.

### 2) Colocar el archivo y declararlo en `app.json` (Android-only)
1. Copia `google-services.json` a la **raíz del repo** `comandpos-delivery/`.
2. (Recomendado) Agrégalo a `.gitignore` si no quieres versionarlo (contiene IDs del proyecto, no secretos críticos, pero EAS lo lee del repo en build).
3. En `app.json`, **dentro del bloque `"android"`**, agrega esta línea (NO toques el bloque `ios`):

```json
"android": {
  "package": "com.comandpos.delivery",
  "googleServicesFile": "./google-services.json",
  "adaptiveIcon": { "...": "..." },
  "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]
}
```

### 3) Subir la clave FCM V1 a Expo (credential de Android)
1. En Firebase: **⚙ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → descarga el JSON.
2. En el repo de delivery, corre:
   ```bash
   eas credentials
   ```
   → elige **Android** → **Push Notifications: Manage your FCM V1 Service Account Key**
   → **Upload** el JSON descargado.
   (También se puede desde el dashboard: expo.dev → tu proyecto → Credentials → Android → FCM V1.)

> Importante: usa **FCM V1** (la API legacy de FCM ya está descontinuada).

### 4) Rebuild SOLO de Android e instalar
```bash
eas build -p android --profile preview     # APK interno para probar
# o producción:
eas build -p android --profile production
```
Instala el nuevo APK/AAB en el dispositivo Android (los cambios de credenciales/config
**no aplican** a builds viejos: hay que reconstruir e instalar de nuevo).

---

## Verificación
1. `eas credentials` → Android → debe mostrar **FCM V1** configurado.
2. Inicia sesión con un repartidor en el Android nuevo y **acepta el permiso de notificaciones**.
3. En la BD del backend debe aparecer su token:
   ```sql
   SELECT user_id, platform, enabled, last_seen_at
   FROM finances.device_push_tokens
   WHERE platform = 'android'
   ORDER BY last_seen_at DESC;
   ```
   (Si no aparece fila `android` → el token no se registró: ver Troubleshooting.)
4. Asigna una orden a ese repartidor y revisa los logs del server:
   - `🛵 [rider-push] enviado a user_id=… (N token/s)` → salió bien.
   - `🟢 [expo] ticket OK` → Expo aceptó la entrega.
   - `🟡 [expo] ticket error: InvalidCredentials` / `MismatchSenderId` → FCM mal configurado (revisar paso 3 y que el package coincida).
   - `⚠️ sin tokens activos para user_id=…` → el token no llegó a la BD (paso 2/permiso).

---

## Troubleshooting
- **No se guarda token en Android (`getExpoPushTokenAsync` falla):** casi siempre es FCM
  no configurado o build viejo. Reconstruye tras el paso 3.
- **`InvalidCredentials` / `MismatchSenderId` en el ticket de Expo:** la clave FCM V1 no
  corresponde al proyecto Firebase del `google-services.json`, o el package no coincide.
- **Corre en Expo Go:** Expo Go (SDK 53+) **no soporta push**. Usa dev build / preview / producción.
- **Permiso denegado:** Ajustes del teléfono → App → Notificaciones → activar. Re-login para
  re-disparar el registro.

## Notas
- El fix del backend (que el push de repartidor salga aun en el contenedor `lite`,
  `bypassTierGate`) ya está aplicado; este documento cubre **solo** la parte de Android/FCM.
- Una vez configurado FCM, **no hay que repetirlo** salvo que cambies de proyecto Firebase
  o rotes la clave de servicio.
