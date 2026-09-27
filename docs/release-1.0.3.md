# ComandPOS Delivery 1.0.3 — 27 de septiembre de 2026

Versión actualizada en app.json, package.json y package-lock.json. EAS incrementó
el número de compilación de 6 a 7 en ambas plataformas. Se compiló primero iOS
y después Android. TypeScript y las 38 pruebas locales pasaron.

## iOS

- Build 7: FINISHED.
- Envío a App Store Connect/TestFlight: FINISHED.
- [Build](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/builds/80d06dcc-9bc3-40e7-98df-19c8e39a9b51)
- [Envío](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/submissions/95b3c243-9963-4de0-a1cd-8de134207090)

El envío del binario no significa aprobación de App Review ni publicación pública.

## Android

- Version code 7: FINISHED (target API 35; sustituido por el 8).
- Version code 8: FINISHED (target API 36).
- Canal de destino: alpha (prueba cerrada).
- [Build](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/builds/e097f813-f23e-4d25-901a-3125f82d596e)

### Historial de envíos (27-sep)

| Envío | Resultado | Causa |
| --- | --- | --- |
| 5a7bb18d, 88c3765f | `SERVICE_ACCOUNT_IS_MISSING_PERMISSIONS` | La cuenta de servicio `eas-submit-movil@comandpos-play-submit.iam.gserviceaccount.com` solo tenía permisos sobre Comand POS Móvil. Se le agregó ComandPOS Delivery (ver info, lanzar a pruebas, lanzar a producción). |
| 4132b335 | `Release artifacts require permissions that are missing from permission declaration` | La 1.0.3 declara `ACCESS_BACKGROUND_LOCATION` y `FOREGROUND_SERVICE_LOCATION` (rastreo del viaje activo) y la ficha no tiene las declaraciones de política correspondientes. |
| [95fe3eb6](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/submissions/95fe3eb6-5853-42e9-afc3-62905583de00) | **FINISHED** (release en borrador) | `eas.json` → `releaseStatus: draft` + `changesNotSentForReview: true`. Play acepta el artefacto sin revisión y habilita los formularios. |

### API 36 (4º error de Play) — resuelto

En la revisión de la release Play exigía target API ≥ 36 (la 1.0.3 apuntaba a 35). Se subió
`compileSdkVersion`/`targetSdkVersion` a 36 en `expo-build-properties` (commit `15b94e4`),
build `d5bb141b` → **versionCode 8**, subido como borrador (envío `c7f47a9d`). La revisión de la
release quedó en 2 errores: solo las dos declaraciones de permisos.

### Pendiente para que llegue a los verificadores

1. Play Console → Contenido de la app → completar **Permisos de ubicación** (segundo plano) y
   **Permisos de servicio en primer plano** (tipo `location`). Ambas piden justificación y un
   video demo. Base para el texto: el repartidor comparte posición con despacho solo durante un
   viaje activo (cada 30 s / 100 m, `Accuracy.Balanced`), con notificación persistente
   "ComandPOS · Viaje activo"; se detiene al cerrar el viaje y es opcional desde Cuenta.
2. Promover el borrador de alpha a lanzamiento desde la consola.
3. Producción sigue bloqueada por Google: 1 de 12 verificadores y 0 de 14 días.
