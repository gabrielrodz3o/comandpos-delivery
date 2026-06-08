# ComandPOS Delivery 🛵

App móvil (Expo / React Native) para los **motorizados**. Espeja el stack y
diseño de `comandpos-manager` y se conecta al backend Nuxt `restaurante-comandpos`
(viajes, custodia, realtime por socket, push, auto-dispatch).

## Arranque

```bash
cd comandpos-delivery
npm install            # o: bun install / pnpm i

# Apuntar al backend. En DEV usá la IP LAN de tu máquina (NO localhost,
# el teléfono no lo alcanza). El backend Nuxt corre en :3000.
export EXPO_PUBLIC_API_URL="http://192.168.X.X:3000"

npx expo start         # escaneá el QR con Expo Go (o build dev client)
```

> Sin `EXPO_PUBLIC_API_URL` usa la URL de producción por defecto
> (`useAuthStore.DEFAULT_API_BASE_URL`).

## Antes de buildear (EAS)

- `app.json`: reemplazar `REEMPLAZAR_CON_GOOGLE_MAPS_KEY` (iOS `ios.config.googleMapsApiKey`
  y Android `android.config.googleMaps.apiKey`) por la **Google Maps key** del proyecto.
- `app.json`: poner el **EAS projectId** (`extra.eas.projectId`).
- Reemplazar los **assets** (`assets/icon.png`, `splash.png`, `adaptive-icon.png`)
  por los de delivery (hoy son copia temporal del manager).
- **Push real**: requiere build con dev-client o standalone (no funciona en Expo Go
  para producción). El registro de token ya está implementado.

## Arquitectura

- **Routing**: expo-router. `(auth)/login` → `(tabs)/{orders,map,history,account}` + `order/[id]`.
- **Datos**: TanStack Query (persistido en AsyncStorage). `useMyOrders` = query
  + invalidación por **socket** (`rider_order_update`).
- **Realtime**: `src/services/socket.ts` → `join_user` → room `user_<use_id>`.
- **Push**: `src/services/notifications.ts` → `/api/users/push-token`.
- **API**: `src/services/{apiClient,auth,delivery}.ts` (axios, baseURL+token del store).
- **Tema**: `src/theme/` (copiado del manager, "delicate white" emerald).

## Endpoints backend que consume

```
POST /auth/login · GET /auth/me · POST /auth/logout
GET  /api/restaurant/delivery/my-orders        (mis órdenes, scoped al rider)
POST /api/restaurant/delivery/availability      (recibir / no recibir)
POST /api/restaurant/delivery/route/pickup      (iniciar viaje)
POST /api/restaurant/delivery/route/group-mine  (agrupar al vuelo)
POST /api/restaurant/delivery/route/optimize    (guardar ruta)
POST /api/restaurant/tables/update-account-status (En camino)
POST /api/restaurant/order/mark-delivery-completed (Entregada)
POST /api/users/push-token · DELETE /api/users/push-token
WS   join_user → rider_order_update
```

## Estado (MVP scaffold)

✅ Auth + shell + push/socket  ✅ Mis órdenes (lista + EN CAMINO + Iniciar viaje)
✅ Mapa (paradas + ruta + navegar)  ✅ Detalle (En camino / Entregada / cobro)
✅ Cuenta (disponibilidad + logout)  ✅ Historial (entregas + facturado del día)

Pendiente (siguiente iteración): cobro de custodia completo (liquidación),
prueba de entrega (foto/firma/OTP), optimización de ruta con Google Directions
real (hoy usa orden por `delivery_route_order` + deep-link), biometría.
