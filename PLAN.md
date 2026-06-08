# ComandPOS Delivery — Plan de la app móvil del repartidor

App nativa (Expo / React Native) para los **motorizados**. Reusa el stack, el
sistema de diseño y los patrones de `comandpos-manager`, y se integra con el
backend Nuxt (`restaurante-comandpos`) que ya tiene toda la capa de delivery:
viajes, custodia, realtime por socket, auto-dispatch, etc.

> Objetivo: que el repartidor vea **lo que le asignaron**, reciba **push** al
> instante, **inicie el viaje**, **navegue parada por parada**, **cobre la
> custodia** y **marque entregado** — con el mismo flujo que
> `app/pages/delivery.vue` pero nativo, offline-tolerant y con GPS real.

---

## 1. Stack (espejo de comandpos-manager)

Mismo stack para reusar conocimiento y componentes:

| Capa | Librería |
|---|---|
| Runtime | **Expo ~54**, React Native 0.81, React 19 |
| Routing | **expo-router v6** (file-based, grupos `(auth)` / `(tabs)`) |
| Estado servidor | **@tanstack/react-query v5** + persist (AsyncStorage) |
| Estado cliente | **zustand** (`useAuthStore`, `useToastStore`, …) |
| HTTP | **axios** singleton (`ApiClient`) con baseURL dinámica + interceptor de token |
| Push | **expo-notifications** (Expo push token → `/api/users/push-token`) |
| Biometría | expo-local-authentication (opcional para re-login rápido) |
| UI | RN core + reanimated + gesture-handler + svg + linear-gradient + haptics |
| Errores | @sentry/react-native |

**Adiciones nuevas (no están en el manager):**
- **`react-native-maps`** — mapa nativo (pines, polyline de la ruta).
- **`expo-location`** — GPS del rider (origen de ruta + futuro tracking en vivo).
- **`socket.io-client`** — realtime (room `user_<use_id>` + evento `rider_order_update`).
- **`expo-linking`** (ya viene) — deep-link a Google/Apple Maps para navegación turn-by-turn.

---

## 2. Sistema de diseño

Reusar `src/theme/` del manager tal cual (paleta "delicate white", emerald
`#10B981`, tipografía, spacing). Coherente con el look limpio que ya tiene la
web. Componentes base a portar: `Card`, `Button`, `Chip`, `Badge`, `Toast`,
`Skeleton`, `EmptyState`, `Sheet/BottomSheet`.

Acentos por estado de orden (mismos que la web): Lista, Recogida, En camino,
Entregada, con verde de marca para "en vivo" y ámbar para custodia/efectivo.

---

## 3. Arquitectura de carpetas

```
comandpos-delivery/
  app/                          # expo-router
    _layout.tsx                 # providers (QueryClient, SafeArea, Auth gate)
    index.tsx                   # redirect según auth
    (auth)/
      _layout.tsx
      login.tsx                 # usuario/clave (juanito2 / …)
      select-location.tsx       # si el rider tiene >1 sucursal (normalmente 1 → auto)
    (tabs)/
      _layout.tsx               # 4 tabs
      orders.tsx                # "Mis órdenes" (asignadas + viaje activo)
      map.tsx                   # mapa + ruta + navegación por paradas
      history.tsx               # completadas / historial + ganancias del día
      account.tsx               # perfil, disponibilidad, custodia pendiente, logout
    order/[id].tsx              # detalle de orden (acciones, cobro, POD)
  src/
    theme/                      # ← copiar del manager
    services/
      apiClient.ts              # ← copiar/adaptar
      auth.ts                   # /auth/login, /auth/me, /auth/logout
      notifications.ts          # registro push + handler
      socket.ts                 # conexión socket.io + join_user + listeners
      delivery.ts               # endpoints de delivery (ver §4)
    store/
      useAuthStore.ts           # token, apiBaseUrl, user, location activa
      useToastStore.ts
      useRiderStore.ts          # estado de disponibilidad / viaje activo
    hooks/
      useMyOrders.ts            # query órdenes del rider (+ realtime invalidation)
      useActiveRoute.ts         # viaje activo derivado
      useRiderRealtime.ts       # socket → invalida queries
    components/
      orders/OrderCard.tsx, EnRouteBar.tsx, StopItem.tsx
      map/RouteMap.tsx
      ui/...
    types/delivery.ts
```

---

## 4. Integración con el backend (lo que YA existe)

Base URL configurable (igual que el manager: `useAuthStore.apiBaseUrl`),
apuntando al Nuxt `restaurante-comandpos`.

**Auth (reusa lo del manager):**
- `POST /auth/login` → token + user (`business_units_with_access`, `acess_locations`).
- `GET /auth/me`, `POST /auth/logout`.
- El rider se loguea con su usuario (perfil MOTORIZADO). Como suele tener 1 sola
  sucursal, se auto-selecciona y se salta `select-location`.

**Órdenes del rider:**
- `POST /api/restaurant/order/delivery-orders-list` → filtrar por
  `assigned_driver_id === use_id` y `status_tracker_id ∈ [3,4,5,6,7,10]`
  (igual que `delivery.vue`). Ya devuelve `delivery_route_id/order`,
  `picked_up_at`, `delivery_lat/lng`, custodia, etc.
- *(Mejora opcional backend)* `GET /api/restaurant/delivery/my-orders` que
  devuelva solo las del rider autenticado (más eficiente y seguro que traer
  toda la sucursal y filtrar en el cliente).

**Acciones (todas ya existen):**
- Iniciar viaje (recoger todo): `POST /api/restaurant/delivery/route/pickup`.
- Armar/guardar ruta: `POST /api/restaurant/delivery/route/optimize` y
  `…/route/group-mine` (agrupa órdenes asignadas de a una).
- Cambiar estado: `POST /api/restaurant/tables/update-account-status` (5→6, etc.).
- Entregar: `POST /api/restaurant/order/mark-delivery-completed`.
- Custodia (cobro): endpoints de `rider-settlements` / `rider_collections`.

**Realtime (ya construido):**
- Socket.IO: el cliente emite `join_user { user_id }` → room `user_<id>`.
- Escucha `rider_order_update { reason: assigned|status_change|completed|… }` →
  invalida la query de órdenes (refetch). Reemplaza el polling.

**Push token (ya existe):**
- `POST /api/users/push-token` (registrar Expo token) y `DELETE` (al logout).

---

## 5. Lo que hay que AGREGAR en el backend (para la app)

1. **Push de Expo al asignar** *(clave para "ver que le asignaron" con la app
   cerrada).* Hoy el backend emite socket pero **no envía push**. Agregar: en
   `assign-driver-by-cashier`, `route/assign`, `route/auto-assign` y al cambiar
   estado, enviar un **Expo Push** al/los token(s) del rider
   (`expo-server-sdk` o fetch a `https://exp.host/--/api/v2/push/send`).
   - Reusar la tabla/registro de push tokens (`/api/users/push-token` ya guarda).
   - Helper `server/utils/expo-push.ts` → `sendRiderPush(useId, {title, body, data})`.
2. **(Opcional) `my-orders` endpoint** scopeado al rider autenticado.
3. **(Fase 2) Tracking GPS en vivo**: evento socket `rider_location` + caché
   (Redis/tabla) → habilita el link de seguimiento al cliente.

---

## 6. Pantallas (mapeadas a `delivery.vue`)

### `(tabs)/orders.tsx` — "Mis órdenes" (pantalla principal)
- Lista de órdenes activas del rider (status 3-6), agrupadas por viaje.
- **Barra "EN CAMINO"** (estilo Uber) cuando hay viaje en curso: parada X/N,
  cliente, dirección, botones Navegar / Entregada.
- Botones contextuales:
  - **Armar ruta óptima** (si >1 orden) → calcula orden óptimo y abre el mapa.
  - **Iniciar viaje (N)** → `route/pickup` (sella recogida + En camino).
- Pull-to-refresh + realtime (socket) + sonido/haptic/push al llegar una nueva.

### `(tabs)/map.tsx` — Mapa + ruta
- `react-native-maps` con pines de las paradas (numeradas por `delivery_route_order`).
- **Armar ruta**: optimiza (Google Directions API o el endpoint `optimize`),
  dibuja la **Polyline**, encuadra, y persiste la secuencia.
- **Navegar**: `Linking.openURL` a Google Maps / Apple Maps (turn-by-turn nativo).
- Origen = **GPS del rider** (`expo-location`) o primera parada.

### `order/[id].tsx` — Detalle
- Datos del cliente, dirección, notas, monto, **custodia a cobrar**.
- Acciones por estado: Recogí / En camino / **Entregada**.
- **Cobro de custodia**: marcar efectivo cobrado (parcial/total) → `rider_collections`.
- *(Fase 2)* **Prueba de entrega (POD)**: foto (`expo-image-picker`) / firma / OTP.

### `(tabs)/history.tsx`
- Entregas completadas hoy + **ganancias/όrdenes del día** + historial.

### `(tabs)/account.tsx`
- Perfil del rider, **toggle de disponibilidad** ("Recibiendo pedidos"),
  **custodia pendiente** (cuánto efectivo lleva encima), config de notificaciones,
  logout (borra push token).

### `(auth)/login.tsx`
- Usuario + clave (mismo `/auth/login`). Biometría opcional para re-entrar.

---

## 7. Realtime + Push (estrategia)

- **App abierta** → **socket** (`rider_order_update`) invalida queries de React
  Query → UI siempre fresca, sin polling.
- **App en background/cerrada** → **push de Expo** (lo agrega el backend) con
  `data.account_id` → al tocar la notificación, navega a `order/[id]` o a "Mis
  órdenes". Sonido + vibración nativos.
- React Query con `persistQueryClient` (AsyncStorage) → arranque instantáneo con
  el último estado conocido (tolerante a mala señal).

---

## 8. Fases de implementación (roadmap)

**Fase 0 — Scaffold (medio día):**
`create-expo-app` + expo-router, copiar `theme/`, `apiClient`, `auth`,
`notifications`, stores y componentes UI base del manager. Configurar
`app.json` (scheme `comandposdelivery`, plugins, EAS projectId nuevo) y `eas.json`.

**Fase 1 — Auth + shell:**
Login → auto-select location → tabs vacíos. Push token register. Sentry.

**Fase 2 — Mis órdenes (core):**
`useMyOrders` (query + socket realtime), OrderCard, barra EN CAMINO, acciones
Iniciar viaje / cambiar estado / Entregada. Pull-to-refresh.

**Fase 3 — Mapa + ruta:**
react-native-maps, expo-location, Armar ruta (optimize + polyline), Navegar
(deep-link). Navegación por paradas.

**Fase 4 — Custodia + detalle:**
order/[id], cobro de `rider_collections`, ganancias del día.

**Fase 5 — Push backend + pulido:**
Helper Expo push en el backend (assign/auto-assign/estado), disponibilidad
toggle, historial, biometría, haptics, estados offline.

**Fase 6 — Build & deploy:**
EAS build (iOS/Android), pruebas en dispositivo, store assets (reusar patrón
`play-store/` del manager).

---

## 9. Decisiones / riesgos a confirmar

- **Maps key**: `react-native-maps` necesita API key Android/iOS (Google).
  ¿Reusamos la misma key de Google del proyecto (delivery-zones)?
- **Navegación**: ¿deep-link a la app de mapas (recomendado, turn-by-turn real)
  o ruta dibujada in-app? Plan = ambas (in-app overview + deep-link para manejar).
- **Disponibilidad**: el toggle usa `delivery_riders.is_active`, que por el
  trigger también pausa el login. Para la app conviene el flag separado
  `accepting_orders` (decisión pendiente de la web).
- **my-orders endpoint**: recomendado por seguridad (no exponer toda la sucursal
  al rider) — confirmar si se agrega.
- **Base URL**: misma config dinámica que el manager (apuntar al backend Nuxt).

---

## 10. Resumen de endpoints que consume la app

```
POST /auth/login                                   (token + user)
GET  /auth/me  ·  POST /auth/logout
POST /api/users/push-token  ·  DELETE /api/users/push-token
POST /api/restaurant/order/delivery-orders-list    (mis órdenes)
POST /api/restaurant/delivery/route/pickup         (iniciar viaje)
POST /api/restaurant/delivery/route/group-mine     (agrupar al vuelo)
POST /api/restaurant/delivery/route/optimize       (guardar ruta)
POST /api/restaurant/tables/update-account-status  (5→6, etc.)
POST /api/restaurant/order/mark-delivery-completed (entregada)
…    rider-settlements / rider_collections         (custodia)
WS   join_user → rider_order_update                (realtime)
```
