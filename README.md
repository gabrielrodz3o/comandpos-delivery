# ComandPOS Delivery

App Expo / React Native para repartidores, integrada con la API de la matriz
`restaurante-comandpos`. No necesita un backend independiente.

## Desarrollo

La primera vez, y después de agregar dependencias nativas, sincroniza y compila
el cliente de desarrollo para el simulador o dispositivo:

```sh
npm install
npx expo prebuild
npm run ios
# O, con el emulador Android iniciado:
npm run android
```

Después puedes reutilizar esa instalación con Metro:

```sh
npm install
# Usa una IP LAN accesible desde el teléfono cuando trabajes contra Nuxt local.
EXPO_PUBLIC_API_URL=http://192.168.X.X:3000 npm start -- --clear
```

`expo start` sirve JavaScript; no instala ni recompila la app. Si aparece
`NativeModule ... is null`, recompila el cliente con los comandos anteriores.
Si Android indica `No development build ... is installed`, ejecuta
`npm run android` antes de intentar abrirlo desde Metro.

Los scripts de Delivery usan el puerto **8082** para evitar cargar el bundle de
otra app que esté ejecutándose en el puerto habitual 8081. Abre Delivery desde
su propio Metro; un cliente nativo de una app no contiene los módulos de otra.

Sin esa variable, la app usa `https://api.comandpos.com`. Para revisión con datos
ficticios, configura una API local; no uses credenciales ni pedidos reales.

```sh
npm run typecheck
npm test
npm run test:backend
```

`test:backend` revisa los handlers del proyecto hermano Nuxt, con base de datos
simulada. `DELIVERY_BACKEND_ROOT` permite comprobar un árbol alternativo de archivos.
Estas pruebas no sustituyen una prueba de integración con PostgreSQL.

## Funciones

- Pedidos y viaje activo, recogida confirmada, navegación, llamadas y WhatsApp.
- Declaración de cobro por medio, diferencias justificadas y calculadora de cambio.
- Entrega atómica: receptor, hora original, ubicación opcional y foto opcional.
- Cola durable de entregas, incidencias, llegada y presencia; reintentos sin duplicados.
- Incidencias abiertas y respuestas de despacho, independientes del estado del pedido.
- Mi dinero: custodias, fondos, comprobantes de liquidación por moneda y compartir recibo.
- Historial con búsqueda y rango de fechas personalizado.
- Recorrido por calles mediante proxy autenticado; orden por recorrido o antigüedad.
- Seguimiento de ubicación durante viajes, con autorización explícita del repartidor.
- Notificaciones que abren el pedido, socket autenticado y credencial en SecureStore.

Caja conserva el control de disponibilidad, pagos contables y liquidaciones. La
confirmación del repartidor registra una declaración; no crea pagos de facturas.

## Publicación y compatibilidad

Despliega primero los cambios correspondientes de la matriz. La app consulta las
capacidades en `delivery/operations/status` y conserva el contrato base v2.

Las nuevas dependencias nativas (`expo-secure-store`, `expo-file-system`,
`expo-task-manager`, `expo-image-picker`) y los permisos requieren **una nueva
compilación nativa**. Una actualización JavaScript por sí sola no es suficiente.
No uses Expo Go para validar push ni seguimiento en segundo plano.

El rastreo empieza únicamente con autorización y pedidos en camino. Sin permiso de
segundo plano funciona en primer plano. Se detiene al terminar los pedidos o salir
de la sesión; el servidor rechaza posiciones sin viaje activo y posiciones antiguas.

Google Directions usa la clave del negocio desde el servidor. Para dibujar el mapa
JS, configura `NUXT_PUBLIC_GOOGLE_MAPS_KEY` con una clave de navegador separada y sus
restricciones adecuadas. Si no está configurada, se conserva la clave del negocio
como compatibilidad para el mapa existente. Se mantienen la navegación externa y
la lista de paradas cuando el mapa o el proveedor no están disponibles.

En web la sesión se conserva solo en memoria; en iOS/Android el token usa SecureStore.
Las fotos pendientes se guardan en snapshots privados de la cola en el directorio
de documentos de la app. Las fotos recibidas quedan en la tabla de evidencia y se
consultan mediante un endpoint autenticado; no se publican en un bucket abierto.

Consulta [la entrega y validación de mejoras](docs/mejoras-delivery.md).
