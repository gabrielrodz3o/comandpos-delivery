# Google Play — cuenta de desarrollador de organización (GCODE E.I.R.L.)

Expediente preparado el 2026-09-30 a partir de `GCODE/04_Documentos_Legales` (iCloud).
Objetivo: publicar ComandPOS Delivery, Comand POS Móvil y ComandPOS Manager sin el
requisito de 12 verificadores × 14 días que aplica a la cuenta personal actual.

## Datos de la empresa (copiar tal cual en los formularios)

| Campo | Valor | Fuente |
| --- | --- | --- |
| Razón social (legal name) | GCODE, E.I.R.L. | Registro Mercantil 37307STI |
| Nombre comercial / developer name | GCODE | Acta RNC |
| Tipo de entidad | Empresa Individual de Responsabilidad Limitada (EIRL) | Registro Mercantil |
| RNC | 1-33-75800-8 | Certificación DGII C0426010667363 |
| Registro Mercantil | No. 37307STI · Cámara de Comercio y Producción de Santiago · vence 21/07/2028 | Certificado |
| Fecha de constitución | 25/06/2026 (acto constitutivo) · alta DGII 17/07/2026 | Registro Mercantil / DGII |
| Dirección | Calle Llanos del Ingenio No. 26, sector Cienfuegos, Santiago de los Caballeros, Santiago, República Dominicana | Registro Mercantil |
| Teléfonos | +1 849-540-6093 · +1 829-449-6091 | Registro Mercantil |
| Sitio web | https://gcoderd.com (el `www.` devuelve 404 — corregir redirección en Cloudflare) | Registro Mercantil / verificado 2026-09-30 |
| Correo registrado | gcoderd@gmail.com (**personal**: Google pide correo de la organización) | Registro Mercantil |
| Propietario / gerente | Gabriel Rodríguez Rodríguez · cédula 402-2406726-0 | Registro Mercantil |
| Actividad | CIIU 722001 consultoría informática / 729201 desarrollo de software | Acta RNC |
| Capital | RD$ 1,000.00 | Registro Mercantil |
| Empleados | 1 (propietario) — confirmar | — |
| D-U-N-S | **no consta en la carpeta legal → hay que solicitarlo** | — |

Notas: el dominio `gcoderd.com` ya tiene MX de Cloudflare Email Routing, así que crear
`play@gcoderd.com` (reenvío a Gmail) es gratis e inmediato.

## Requisitos de Google (ayuda oficial, verificados 2026-09-30)

- Número D-U-N-S de Dun & Bradstreet — gratis; "This process can take up to 30 days".
- Nombre legal, dirección, teléfono y sitio web de la organización.
- Correo de contacto "asociado a la organización", no genérico ni personal.
- Perfil de pagos de Google a nombre de la organización; verificación hasta 5 días.
- Verificación de identidad del titular (cédula) y verificación de la organización.
- Cuota: **US$25, pago único** (no se reutiliza la de la cuenta personal).

## Orden de ejecución

1. **D-U-N-S** (cuello de botella, empezar hoy). Buscar si existe; si no, solicitarlo gratis
   con los datos de arriba. Para República Dominicana lo gestiona CIAL Dun & Bradstreet.
2. **Correo corporativo**: crear `play@gcoderd.com` en Cloudflare → Email Routing → reenviar a
   la cuenta Google que será titular.
3. **Web**: hacer que `www.gcoderd.com` redirija a `gcoderd.com` (Cloudflare → Rules).
4. **Cuenta Google nueva** para la organización (o usar una existente) con 2FA activa.
5. **Play Console → Crear cuenta de desarrollador → "Para una organización"**: ingresar
   D-U-N-S, datos, correo y teléfono; **pago de US$25** (tarjeta a nombre de la empresa o del
   titular). Verificación 1–5 días.
6. **Transferir las apps** desde la cuenta personal: Play Console → Configuración →
   Cuenta de desarrollador → Transferir apps (IDs de transacción de ambas cuentas). Respuesta
   en ~2 días hábiles. Los grupos de verificadores no se transfieren.
7. Volver a dar permisos a la cuenta de servicio de EAS en la cuenta nueva y actualizar el
   Firebase/Google Services si aplica.

## Estado del D-U-N-S (2026-09-30)

- El buscador de D&B (my.dnb.com) solo cubre empresas de EE. UU.; CIAL D&B (LatAm) no publica
  formulario directo.
- Vía usada: **Apple Developer → Enroll → Look up your D-U-N-S Number**
  (https://developer.apple.com/enroll/duns-lookup/). Busca en D&B y, si no existe, envía la
  solicitud gratuita; D&B responde por correo (Apple indica ~5 días hábiles). El número sirve
  igual para Google Play.
- Formulario dejado **completo** con los datos de este expediente (región DO, razón social,
  dirección, provincia "Dominican Rep. reg.", CP 51000, teléfono +1 849-540-6093, contacto
  Gabriel Rodríguez Rodríguez, correo `play@gcoderd.com`).
- **Pendiente del titular**: (1) crear `play@gcoderd.com` en Cloudflare Email Routing ANTES de
  enviar, porque D&B responde a ese correo; (2) escribir el CAPTCHA y pulsar *Continue*.

## Cuándo se paga

Solo en el paso 5, al final del alta de la cuenta de organización en Play Console, y solo
después de tener el D-U-N-S y el correo corporativo. Antes de eso no hay ningún pago.
