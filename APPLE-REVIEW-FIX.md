# Rechazo de App Review (iOS) — Diagnóstico, fix y resubmisión

> Documento de referencia para reconstruir/retomar el proyecto sin perder el contexto
> del rechazo de Apple del 11-jun-2026.

## 1. El rechazo

- **App:** ComandPOS Delivery — `com.comandpos.delivery`
- **Versión rechazada:** 1.0 (build 2)
- **Submission ID:** `0d71dcb5-ccae-4ec2-bbb1-5b775d6e2c11`
- **Guideline:** 4 — Design
- **Dispositivo de revisión:** iPad Air 11-inch (M2), iPadOS 26.5
- **Mensaje de Apple:** *"Parts of the app's user interface were crowded, laid out, or
  displayed in a way that made it difficult to use... Specifically, the bottom part of
  the screen was cropped."*

## 2. Causa raíz (confirmada con el screenshot del revisor)

La app es **iPhone-only** (`ios.supportsTablet: false` en `app.json` →
`TARGETED_DEVICE_FAMILY = 1`). Eso **no exime** la revisión en iPad: toda app de
iPhone se puede instalar en iPad y corre en "modo compatibilidad", una ventana de
**≈375×667 pt** (tamaño iPhone 8, sin home indicator). Apple exige que funcione ahí.

En esa ventana corta:

1. **Login (`app/(auth)/login.tsx`)** — la pantalla NO era scrolleable y su contenido
   (hero + formulario + footer) mide más de 667 pt → el pie *"ComandPOS · Delivery"*
   salía cortado al borde inferior. **Esto es exactamente lo que muestra el
   screenshot del rechazo.**
2. **Tab bar (`app/(tabs)/_layout.tsx`)** — altura fija `height: 84`, que asume el
   inset de 34 pt del home indicator del iPhone. En ventanas sin inset queda
   desproporcionada/desbordada.
3. **`app/select-location.tsx`** — `SafeAreaView` solo con `edges={['top']}`: el botón
   "Cerrar sesión" no respetaba el inset inferior.

## 3. Fixes aplicados (commit pendiente)

| Archivo | Cambio |
|---|---|
| `app/(auth)/login.tsx` | Todo el contenido envuelto en `ScrollView` con `contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }}` y `keyboardShouldPersistTaps="handled"`. En pantallas cortas hace scroll en vez de recortarse. También se eliminaron los `console.log` de FOCUS/BLUR. |
| `app/(tabs)/_layout.tsx` | Tab bar sin altura fija: `height: 50 + Math.max(insets.bottom, 8)` (usa `useSafeAreaInsets`). En iPhone con home indicator da 84 (idéntico al diseño original); en iPad/iPhone SE se adapta. |
| `app/select-location.tsx` | `SafeAreaView edges={['top', 'bottom']}` para que "Cerrar sesión" respete el inset inferior. |

Principio general a futuro: **nada de alturas/offsets fijos que asuman insets de un
iPhone con notch** — siempre derivar de `useSafeAreaInsets()`, y toda pantalla cuyo
contenido pueda exceder 667 pt de alto debe ser scrolleable.

## 4. Cómo verificar en el simulador correcto

Apple probó en iPad Air 11" con iPadOS 26.5. Para reproducir:

```bash
# Requiere la plataforma iOS 26.5 instalada en Xcode (ya descargada, 8.5 GB):
#   xcodebuild -downloadPlatform iOS

# Listar el iPad con runtime 26.5 y compilar contra él:
xcrun simctl list devices available | grep -A30 "iOS 26.5" | grep iPad
npx expo run:ios --device <UDID-del-iPad-Air-11>
```

Verificar en la app: login completo y scrolleable (footer visible), tab bar entera,
pantallas de órdenes/mapa/historial/cuenta sin contenido cortado abajo.

> Nota: ejecutar `expo run:ios` **desde la raíz del proyecto**, no desde `ios/`.

## 5. Pasos para resubmitir

1. Commit de los fixes:
   ```bash
   git add -A && git commit -m "fix: login scrolleable y tab bar adaptativa (rechazo Guideline 4 en iPad)"
   ```
2. Build de producción (el build number sube solo: `autoIncrement: true` +
   `appVersionSource: remote` en `eas.json`):
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```
   (Sin `--auto-submit`, luego: `eas submit --platform ios --latest`.)
3. En **App Store Connect** → la misma versión rechazada (no crear versión nueva, la
   app nunca se publicó):
   - Quitar el build 2 y seleccionar el build nuevo (tarda ~15-30 min en procesarse).
   - Responder el mensaje de Apple (opcional, recomendado):
     > *"We fixed the cropped bottom content on iPad: the login screen is now
     > scrollable and the tab bar adapts to the window safe areas. Verified on an
     > iPad Air 11-inch simulator running iPadOS 26.5."*
   - **Resubmit to App Review** / Add for Review.
4. Tiempo típico de respuesta en resubmisiones: 24-48 hs.

## 6. Datos útiles del proyecto

- Expo SDK 54 · React Native 0.81.5 · expo-router 6 · New Architecture habilitada.
- EAS projectId: `17cd5c50-d02c-49e6-90b2-64921a48c2ad` · owner: `gabrielrodz3o`.
- iOS usa Apple Maps; la key de Google Maps (multi-tenant, por unidad de negocio)
  solo alimenta la Directions API.
- Los errores de `tsc` por `@types/delivery` / `@types/business` son preexistentes
  (el alias `@types/*` choca con la convención de npm); no bloquean el build de Metro.
