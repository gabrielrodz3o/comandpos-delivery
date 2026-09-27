# Entrega de mejoras — ComandPOS Delivery

Fecha: 26 de septiembre de 2026. Cambios locales en la app y la matriz Nuxt.

## Diseño y uso

- El viaje activo tiene prioridad sobre la tarjeta de saludo; próxima acción visible.
- Navegación: Mis órdenes, Ruta, Mi dinero y Cuenta. Historial conserva su ruta y se
  accede desde Mis órdenes y Mi dinero.
- Finanzas extraídas de Cuenta; perfil, presencia, permisos, sincronización y soporte
  permanecen en Cuenta.
- Mayor contraste en los colores de texto y acción, textos operativos más legibles,
  acceso al perfil con área de toque ampliada y mensajes vacíos específicos.
- Confirmación con la hoja visual de la app en lugar de alertas distintas por plataforma.
- Seguimiento del pedido desplegable, acceso directo a incidencias y última actualización.
- Inicio abreviado cuando ya existe sesión; ayuda para recuperar el acceso mediante administrador.
- Historial con fechas personalizadas y conteo de resultados cargados, sin confundir
  esos resultados paginados con un total global.

## Cobro, evidencia y liquidación

El repartidor declara efectivo, tarjeta, transferencia y otros medios. Si el total
no coincide, debe justificar la diferencia. El saldo y la moneda se vuelven a
validar dentro de la transacción del servidor; una consulta antigua no sobrescribe
una custodia que cambió. Una diferencia negativa registra custodia parcial.

La entrega guarda el momento de la acción y el momento en que la recibió el servidor.
Puede incluir nombre, GPS y foto del paquete. Fotos: máximo 600.000 caracteres en
el envío; el backend valida, normaliza, elimina metadatos y comprime con sharp.
La foto se mantiene privada en la evidencia y no se incluye en el listado de pedidos.

La pantalla de caja muestra la declaración para revisión. No se crean pagos ni se
confirma una transferencia automáticamente. Los clientes heredados sin declaración
no marcan dinero como cobrado por defecto.

Mi dinero permite consultar y compartir cierres de caja, medios, pedidos y responsable.
Los importes se presentan por moneda. Los cierres revertidos se identifican expresamente.

## Incidencias y sincronización

- Se muestran los reportes reales, no solo pedidos con estado de problema.
- La matriz permite registrar respuesta al resolver, y emite actualización al repartidor.
- Reportar una devolución no cancela ni devuelve inventario automáticamente: caja
  conserva la recepción física y el cierre de la custodia en su flujo existente.
- Entrega, presencia, llegada e incidencia tienen reintentos controlados. Incidencias
  y llegadas usan request_id y bloqueo transaccional para evitar duplicados.
- Una llegada espera las entregas pendientes. Un rechazo bloquea acciones dependientes
  de ese pedido, pero permite continuar con otros pedidos.
- Los errores temporales de red/servidor conservan los cambios para reintento. Los
  conflictos de permisos, propietario y saldo requieren atención.
- Se confirma persistencia antes de enviar. En nativo, cada snapshot completo se
  escribe antes de cambiar el puntero de la cola; fotos no ocupan filas grandes de AsyncStorage.

## Seguridad y arquitectura

- Una sola matriz/API, con endpoints específicos para repartidor.
- Socket: token en handshake; la sala personal se deriva exclusivamente de identidad
  autenticada. Otros clientes que dependían de join_user anónimo deben enviar su sesión.
- SecureStore migra el token de AsyncStorage y serializa escrituras y cierre de sesión.
- Configuración y Directions se limitan a sucursal base o trabajo realmente asignado.
- Incidencias resueltas por caja se limitan a sucursales autorizadas; un repartidor
  no puede usar el endpoint para resolverlas.
- La pantalla web de delivery usa el mismo cierre atómico que el móvil.
- La ruta heredada mark-delivery-completed delega al cierre autenticado.
- POST delivery/proof devuelve 410: la evidencia debe enviarse con complete para
  evitar cambios separados o posteriores sobre una entrega cerrada.
- No se requieren migraciones: se usan delivery_proofs.metadata/photo_url,
  rider_collections.tentative_collection, delivery_incidents.evidence y metadata del repartidor.

## Ruta y seguimiento

Directions se consulta mediante el backend, con límite por usuario y caché acotada.
Las paradas deben pertenecer al repartidor y a la sucursal solicitada. Permite guardar
el orden por recorrido en calles o por antigüedad; la aproximación por cercanía se
identifica como tal cuando el proveedor no devuelve recorrido.

El seguimiento se activa voluntariamente en Cuenta. Usa ubicación equilibrada,
distancia mínima de 100 metros e intervalo solicitado de 30 segundos (el sistema
operativo controla la entrega efectiva). La matriz guarda solamente la última
posición y muestra su hora, con enlace al mapa mientras hay viaje y el dato es reciente.
No se implementó un historial de desplazamientos ni envío de mensajes al cliente.

## Validación realizada y límites

- TypeScript de la app y 38 pruebas de regresión/contrato con base de datos simulada.
- Comprobación de sintaxis TypeScript y compilación de las plantillas Vue modificadas.
- Navegador aislado contra API ficticia: login, navegación, cobro declarado, confirmación
  única, respuestas de incidencias y ancho de 320 píxeles; sin errores de ejecución.
- Flujo offline en navegador: declaración persistida, estado pendiente visible y
  recuperación con el mismo identificador y hora; cola vacía solo tras confirmación.
- Paquetes JavaScript de desarrollo iOS y Android generados por Metro sin errores.
- Reparación de arranque: se agregó `expo-dev-client` y se fijó Metro en 8082
  para evitar cargar el proyecto `comand-pos-movil-lite` que usa 8081 y NetInfo.
- Compilaciones nativas debug iOS y Android correctas; pantalla de acceso verificada
  en iPad ComandPOS y en el emulador separado `ComandPOS_Delivery_Test`.
  El Pixel original no pudo instalar el APK por falta de almacenamiento interno;
  sus aplicaciones y datos se conservaron.
- Capturas en `docs/validation`: pedidos, dinero, detalle, incidencias y entrega offline.
- No se ejecutaron builds de producción, despliegues ni escrituras a la base de datos.

Antes de publicar, probar en dispositivos físicos con una compilación nativa nueva:
SecureStore al reinstalar/cerrar sesión, permisos de cámara, fotos offline, notificaciones
con la app cerrada y ubicación con pantalla bloqueada. También comprobar el ciclo
contra PostgreSQL real, con pago parcial, cambio de sucursal/repartidor y reintentos.
Las pruebas con mocks no verifican triggers ni funciones instaladas en una base real.

Foto es la opción de evidencia adicional implementada. No se incorporó OTP ni un
proveedor de SMS/WhatsApp: requieren definir el canal del cliente y sus reglas operativas.
