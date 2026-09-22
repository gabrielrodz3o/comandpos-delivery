# Mejoras de Delivery y control de caja

Implementadas en los repositorios locales `comandpos-delivery` y `restaurante-comandpos`. No publicadas en producción.

## Regla de permisos

- Caja conserva el control de recepción de nuevas órdenes, entrega/reintegro de fondos y liquidaciones.
- El repartidor consulta recepción y estado operativo. «Estoy activo» y «Estoy inactivo» envían avisos; no modifican `accepting_orders`, `is_active` ni el estado de despacho.
- La API antigua de disponibilidad responde 403. Los endpoints de caja modificados rechazan usuarios registrados como repartidores, incluidos llamados directos desde clientes antiguos.
- El aviso queda en `delivery_riders.metadata.rider_presence` y en `rider_dispatch_events`. La lista de repartidores en caja muestra el último aviso con fecha y recibe una notificación en vivo.

## Pantallas

| Pantalla | Resultado |
| --- | --- |
| Mis órdenes | Encabezado compacto, búsqueda, filtros, progreso estable con paradas completadas, selector de viaje, recogida confirmada y llegada a sucursal. |
| Mapa | Viajes separados, paradas numeradas, distancia y tiempo por calles, órdenes sin coordenadas accesibles, orden por cercanía guardado antes de confirmarlo y recuperación ante fallos. |
| Historial | Hoy/7/30 días, filtros de resultado, búsqueda, paginación, agrupación por fecha y acceso independiente al detalle. Incluye entregas locales pendientes de sincronizar, identificadas como tales. |
| Cuenta | Recepción de pedidos de solo lectura, avisos de actividad, fondos recibidos/devueltos, cobros por liquidar, pendientes de cobrar, importes a revisar, permisos y cola de sincronización. |
| Detalle | Total confirmado por servidor, saldo y medio esperado, contacto/navegación, seguimiento, incidencias y nombre del receptor cuando esté habilitado. |

Los importes conservan centavos y moneda. No se agrega un impuesto fijo al subtotal. Fondos y custodias se consultan para el usuario autenticado; no se consume el listado administrativo global. Las monedas se presentan separadas y los cobros aún pendientes del cliente no se suman a las liquidaciones.

## Contratos del servidor

Rutas relativas a `/api/restaurant/delivery`:

| Ruta | Función |
| --- | --- |
| `GET my-orders` | Órdenes activas sin caducidad por creación, recientes y todas las paradas de viajes activos. Contrato versión 2. |
| `GET order?id=…` | Detalle de una orden propia fuera de la ventana reciente. |
| `GET history` | Consulta por período, búsqueda, resultado y paginación de 30 registros. Usa finalización o evento de estado, evitando fechar entregas por actualizaciones posteriores de caja. |
| `GET my-finances` | Fondos abiertos sin corte temporal, fondos cerrados recientes y custodias pendientes, separados por moneda y etapa. |
| `GET operations/status` | Estado operativo, recepción de pedidos y último aviso de actividad. |
| `POST operations/presence` | Aviso idempotente identificado por `request_id`, sin activar o pausar pedidos. |
| `POST complete` | Entrega propia, transaccional e idempotente; valida estado y constancia de entrega. No registra pagos ni liquidaciones de caja. |

Se reutilizan recogida de ruta, incidencias y llegada. Agrupación, recogida y reordenamiento verifican pertenencia antes de escribir. El reordenamiento exige todas las paradas, sin duplicados; agrupar no permite mezclar sucursales.

No se añadieron migraciones: se utilizan tablas y campos existentes en las migraciones revisadas del proyecto principal. Antes de publicar, el entorno destino debe contar con las tablas operativas de delivery existentes.

## Diseño visual de las pantallas interiores

Se unificaron encabezados, tarjetas, buscadores, filtros y navegación con fondos cálidos, acentos naranja y tipografía de mayor jerarquía. Mis órdenes incorpora un resumen de jornada; Cuenta presenta el perfil y destaca el importe pendiente de liquidar. Se conserva el login y la animación aprobados.

El mapa ocupa la superficie principal y utiliza una paleta propia, controles flotantes y un panel inferior que se expande por toque o gesto. El encuadre respeta los controles y se adapta al tamaño del panel. Las entregas sin dirección ni coordenadas ofrecen consultar el detalle. Las atribuciones del mapa permanecen visibles.

Validación del rediseño: TypeScript, 10 pruebas de regresión y bundles de desarrollo iOS/Android correctos; revisión visual en simulador iOS de las cuatro pestañas y del panel de paradas desplegado. No se realizaron operaciones de negocio para probar el diseño.

## Sesión y funcionamiento sin conexión

La caché y las operaciones pendientes se identifican por servidor, usuario y sucursal. Al cerrar sesión se cancela y elimina la caché de consultas, conservando la cola con su propietario. La hidratación inicial preserva la caché para consultas sin conexión.

La cola solo reproduce entrega y aviso de actividad para su propietario. Al cambiar la sesión detiene los siguientes envíos. Un rechazo del servidor permanece visible en Cuenta, con reintento y descarte confirmado por el usuario; no desaparece tras varios intentos. Las operaciones antiguas sin propietario se conservan bloqueadas para revisión y no se reproducen con credenciales nuevas.

Recogida, reorganización de viaje, incidencias y llegada requieren confirmación del servidor. Una entrega sin conexión se marca como pendiente de sincronización, con fecha local provisional que luego se reconcilia.

## Verificación

- `npm run typecheck`: sin errores; se eliminó el conflicto del alias `@types/*`.
- `npm test`: 10 pruebas de estados, rutas, importes, coordenadas y cola entre sesiones.
- `npm run test:backend`: 8 pruebas de permisos, consultas por propietario, historial, monedas, constancia e idempotencia. Usa el repositorio hermano; `DELIVERY_BACKEND_ROOT` permite indicar otra ubicación.
- Sintaxis de los módulos del servidor y compilación del componente Vue de caja verificadas.
- Paquetes de desarrollo de Metro para iOS y Android generados correctamente.
- Revisión visual en iPhone 17 Pro: Mis órdenes, Mapa, Historial y Cuenta. Se verificaron navegación, mapa, estados vacíos y recuperación ante información no disponible.

Las pruebas del servidor sustituyen la conexión de base de datos; no constituyen una integración contra PostgreSQL desplegado. No se confirmaron entregas, avisos de actividad, cambios de recepción, fondos ni liquidaciones reales para probar.

## Publicación pendiente

La API a la que apunta el simulador todavía devolvía 404 para las rutas nuevas durante la revisión. El código de los dos repositorios está preparado, pero hace falta publicar primero el servidor/panel de caja y después distribuir la actualización móvil. Hasta ese despliegue, las consultas nuevas muestran información no disponible y los importes desconocidos permanecen «Por confirmar».

Después del despliegue, verificar con cuentas de prueba: aviso activo/inactivo visible en caja sin alterar recepción; fondo entregado y reintegro; entrega y liquidación parcial; dos rutas; cierre con paradas canceladas; reintento sin conexión; y cambio de usuario con cola pendiente.
