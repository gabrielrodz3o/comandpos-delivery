# Revisión de diseño y funcionamiento de ComandPOS Delivery

Fecha: 21 de septiembre de 2026. Alcance: Mis órdenes, Mapa, Historial, Cuenta y los flujos compartidos de ruta, cobro y sincronización.

Esta revisión contrasta el código móvil con `DeliveryOrdersList.vue`, `call_center.vue` y los endpoints del repositorio local `restaurante-comandpos`. Incluye reproducciones aisladas de lógica real; no certifica el comportamiento del servidor desplegado ni una prueba visual completa con órdenes reales. Las propuestas siguientes todavía no están implementadas.

## Prioridades verificadas

| Prioridad | Hallazgo y consecuencia | Corrección necesaria |
| --- | --- | --- |
| P0 | La caché usa una clave global y la cola persistida no tiene propietario. Cerrar sesión elimina las credenciales, pero no aísla esos datos. El reintento usa las credenciales vigentes: podría mostrar información anterior o intentar enviar acciones bajo otra sesión. | Separar caché y cola por servidor, usuario y contexto de sucursal. Detener reintentos al cambiar de sesión. Conservar acciones pendientes con su propietario y mostrar conflictos; no descartarlas silenciosamente. |
| P0 | `orderTotal` añade siempre 18 % al subtotal. La referencia web contempla importes calculados y distintos tratamientos tributarios. Los resúmenes móviles pueden mostrar cifras incorrectas. | Obtener total definitivo, moneda, saldo y medio de pago del servidor. No presentar una aproximación como facturación ni como importe exacto que debe cobrar el repartidor. |
| P1 | `routeStops` se obtiene de órdenes activas 3–6, mientras el progreso busca entregadas 7 dentro de esa lista. El numerador siempre es cero y desaparecen las paradas completadas. | Separar órdenes activas, ruta seleccionada y todas sus paradas. Mantener un denominador estable y un cierre de viaje explícito. |
| P1 | Estado 10 aparece como «Programada», pero en la web es «Cancelada por el Restaurante». El 5 indica asignación («Con Repartidor»), no demuestra recogida. El 12 no aparece entre activas. | Unificar catálogo de estados y distinguir asignación, recogida, trayecto, entrega, cancelación e incidencia. Incorporar `picked_up_at` a la interpretación de recogida. |
| P1 | `my-orders` limita todas las órdenes por fecha de creación. La app solicita 48 horas; pueden desaparecer órdenes antiguas todavía activas o entregas recientes creadas antes de ese plazo. | Separar consulta operativa sin corte por antigüedad y consulta histórica por fecha de finalización, con paginación. |
| P1 | El mapa reúne órdenes de distintas rutas, pero guarda la optimización sobre una sola. Además, iniciar entregas desde el mapa usa cambios de estado individuales. | Seleccionar una ruta explícita y usar el flujo de recogida que actualiza órdenes, ruta, timestamps y estado operativo. Revisar paridad con el backend antes de sustituir acciones. |
| P1 | El mapa dibuja calles, pero muestra kilómetros en línea recta; descarta distancia y duración devueltas por Directions. | Mostrar distancia y tiempo del recorrido calculado. Cuando solo haya trazado aproximado, indicarlo claramente y no presentarlo como ruta vial optimizada. |
| P1 | «Efectivo a cobrar» y «Efectivo cobrado» suman importes esperados de custodia mezclando estados. No se conoce el medio de pago ni el importe realmente cobrado. | Separar pendiente de cobro, cobrado y pendiente de entregar en caja, con cantidades verificadas por el backend. |

Evidencia móvil: `src/hooks/useMyOrders.ts`, `src/utils/format.ts`, `src/types/delivery.ts`, `src/services/queryClient.ts`, `src/store/useSyncQueue.ts`, `src/store/useAuthStore.ts`, `src/services/sync.ts`, `src/services/apiClient.ts` y las cuatro pantallas de `app/(tabs)`.

Evidencia principal: `app/components/order/DeliveryOrdersList.vue` (etiquetas de estado y total), `app/pages/call_center.vue` (totales e impuestos), `server/api/restaurant/delivery/my-orders.get.ts`, `route/pickup.post.ts` y `route/optimize.post.ts`.

## Propuesta por pantalla

### Mis órdenes

Objetivo: que el repartidor identifique qué debe hacer a continuación, a quién entregar y cuánto cobrar.

Orden visual propuesto:

1. Encabezado compacto con sucursal, estado operativo y estado de sincronización.
2. Resumen de viaje: «2 de 3 entregadas», siguiente parada y acción principal contextual.
3. Filtros con contadores: pendientes de recoger, en camino e incidencias; búsqueda por número, cliente o dirección.
4. Tarjetas con número visible de orden, cliente, dirección y referencia, tiempo de espera, estado y saldo/medio de pago confirmado.
5. Accesos a navegar, llamar y abrir detalle; confirmación para completar una entrega con cobro.

La acción principal cambia con el flujo: recoger → navegar → confirmar entrega → registrar regreso, cuando corresponda. Las órdenes con incidencias permanecen localizables. Mostrar carga, error con reintento, datos guardados y lista realmente vacía como situaciones diferentes.

### Mapa

Objetivo: seguir el viaje seleccionado y resolver la siguiente parada.

Usar un mapa con marcadores numerados, selector de viaje cuando exista más de uno y panel inferior con próxima entrega, dirección, saldo, distancia y tiempo del recorrido. La lista de paradas y el mapa deben compartir selección y orden.

Mantener visibles las órdenes sin coordenadas en una sección «Sin ubicación», con dirección y llamada. Ofrecer mensajes accionables si falta permiso GPS, falla el mapa o no hay conexión. Evitar que un mapa vacío se interprete como ausencia de órdenes.

Guardar el nuevo orden antes de mostrarlo como confirmado; revertir o marcar como pendiente si falla. Respetar el máximo de 10 órdenes que admite `group-mine`. Una sugerencia por cercanía geográfica no garantiza el trayecto más rápido por calles. Actualizar la ubicación mientras esta pantalla está activa, con control de consumo y permisos.

### Historial

Objetivo: encontrar una entrega y comprobar su resultado y situación de cobro.

Mostrar grupos por fecha, número de orden, cliente, hora, total confirmado, resultado y situación de liquidación. Las filas deben abrir el detalle y conservar fecha completa al consultar varios días. Añadir búsqueda, actualización manual y estados de carga/error.

Dar prioridad a entregas completadas y cobros verificables. «Facturado» no equivale a ingresos del repartidor. Incluir cancelaciones e incidencias mediante filtros con sus etiquetas correctas.

El endpoint actual admite hasta 168 horas por creación. Ampliarlo a siete días sería únicamente una ventana reciente provisional: no resuelve un historial por fecha de entrega ni permite prometer 30 días. El historial completo necesita contrato paginado y detalle accesible fuera de la caché de las últimas 48 horas.

### Cuenta

Objetivo: mostrar la identidad, sucursal y situación operativa del repartidor.

Reducir la portada decorativa y agrupar: perfil/sucursal, disponibilidad para nuevas asignaciones, estado operativo, resumen de caja, sincronización, permisos, soporte y sesión.

La disponibilidad debe comenzar como «Consultando» si todavía no se conoce. Si se cambia sin conexión, mostrar «Pendiente de sincronizar». Separarla del estado real: disponible, asignado, entregando o pendiente de liquidación.

Incorporar «Llegué a la sucursal» cuando las condiciones del servidor lo permitan. Mostrar importes pendientes de entregar y fondo de cambio solo cuando exista una respuesta segura y específica del repartidor. Al salir de la cuenta, explicar el estado de acciones pendientes y conservarlas aisladas de otras sesiones.

## Qué puede aprovecharse del servidor actual

Todos los endpoints siguientes existen en el repositorio revisado. Su despliegue y habilitación deben verificarse en un entorno de prueba antes de integrarlos como disponibles para todos los negocios.

| Capacidad | Endpoint relativo a `/api/restaurant/delivery` | Condiciones |
| --- | --- | --- |
| Estado operativo y configuración | `GET operations/status` | Identifica al repartidor por sesión y devuelve indicadores de funciones habilitadas. |
| Llegada a sucursal | `POST operations/arrival` | Respeta configuración y validaciones de órdenes/custodia; puede dejar al repartidor pendiente de liquidación. |
| Reportar una incidencia | `POST incidents` | Admite tipos definidos y notas; verifica pertenencia cuando se incluye una orden. Reportar una incidencia no debe asumirse equivalente a cancelar o cambiar su estado. |
| Recoger una ruta | `POST route/pickup` | Actualiza recogida, estados de órdenes, ruta y estado operativo. |
| Constancia de entrega | `POST proof` | Depende de habilitación; admite nombre del receptor y ubicación opcional. El contrato revisado no admite fotografías ni firma. |

Se necesitan ajustes de contrato para totales y cobros fiables, historial completo, órdenes activas sin caducidad temporal y consulta del detalle independiente de la lista reciente. El endpoint administrativo de liquidaciones no debe consumirse sin asegurar un alcance exclusivo del repartidor autenticado.

## Criterio visual compartido

Conservar la identidad naranja de ComandPOS, con fondos neutros, tarjetas más compactas y espacio reservado al contenido operativo. Usar un solo botón principal por contexto, estados con texto además de color, importes legibles y objetivos táctiles amplios. Reducir bloques decorativos repetidos que desplazan las órdenes y las acciones fuera de pantalla.

Tomar de `DeliveryOrdersList.vue` la separación entre orden, ruta, disponibilidad y custodia; de `call_center.vue`, la búsqueda, el contexto de sucursal y los estados de actualización. Adaptar esas capacidades al trabajo del repartidor sin trasladar las vistas administrativas completas.

Las animaciones deben ayudar a reconocer una actualización o transición, respetar movimiento reducido y no demorar acciones frecuentes.

## Secuencia y verificación

1. Corregir aislamiento de sesiones/cola, catálogo de estados, selección de ruta y progreso. Acordar importes autoritativos y alcance de las consultas.
2. Rediseñar Mis órdenes y Mapa sobre esas reglas compartidas; integrar recogida consistente e incidencias.
3. Completar Historial y Cuenta con búsqueda, detalle, estado operativo, llegada y resumen de caja.
4. Verificar en iOS y Android: texto ampliado, movimiento reducido, permisos denegados, red intermitente y errores recuperables.

Casos de aceptación imprescindibles:

- Una ruta de tres paradas con dos entregadas muestra 2/3 y conserva el mismo total hasta su cierre.
- Dos rutas simultáneas no intercambian paradas ni se optimizan juntas por accidente.
- Una orden activa creada hace más de 48 horas permanece visible; una entrega de hoy se encuentra aunque su creación sea anterior.
- Una orden con estado 12 es accesible y una con estado 10 nunca se presenta como programada.
- Factura exenta, factura gravada, pago parcial y pedido prepagado conservan total/saldo exactos y la acción de cobro correcta.
- Una entrega encolada se distingue de una confirmada; el historial optimista mantiene una fecha coherente hasta reconciliar con el servidor.
- Cambiar de usuario o sucursal no muestra información ajena ni reproduce acciones de otro propietario. Probar también cierre por respuesta 401.
- Una caída de red durante una mutación no duplica la operación al reintentar; revisar idempotencia en servidor.
- Sin GPS, coordenadas o clave de mapa, siguen siendo accesibles las órdenes y las opciones de recuperación.
- La disponibilidad desconocida o pendiente de envío nunca se presenta como confirmación del servidor.

## Verificación realizada en esta revisión

Se ejecutó código TypeScript real mediante transpilación aislada, sustituyendo únicamente las dependencias de React/red del hook. Se reprodujeron cinco comportamientos: progreso 0/1 para dos entregadas y una pendiente; desaparición de la ruta al completar la última parada; exclusión del estado 12 de activas; etiqueta incorrecta del estado 10; y adición fija de 18 % al calcular un total.

Los riesgos de sesión, consulta histórica, caja y actualización de ruta se comprobaron mediante lectura de los flujos y contratos locales. No se enviaron entregas, cobros, cambios de disponibilidad ni otras mutaciones al servidor para realizar esta auditoría.
