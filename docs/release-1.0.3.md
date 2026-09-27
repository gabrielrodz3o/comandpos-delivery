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

- Version code 7: FINISHED.
- Canal de destino: alpha.
- [Build](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/builds/e097f813-f23e-4d25-901a-3125f82d596e)
- [Envío rechazado](https://expo.dev/accounts/gabrielrodz3o/projects/comandpos-delivery/submissions/5a7bb18d-356f-40d0-9f18-8e4768a3137f)
- Error: SUBMISSION_SERVICE_ANDROID_SERVICE_ACCOUNT_IS_MISSING_PERMISSIONS.

Se vinculó la credencial de publicación ya existente en EAS:
`eas-submit-movil@comandpos-play-submit.iam.gserviceaccount.com`.
Google Play rechazó el envío por permisos insuficientes sobre esta app.
La credencial de Firebase para notificaciones no se modificó.

Un administrador debe conceder a esa cuenta acceso a `com.comandpos.delivery`
y permisos de publicación en el canal de pruebas elegido, o proporcionar otra
cuenta de servicio autorizada. Después, reenviar el mismo build sin recompilar:

```sh
eas submit --platform android --profile production --id e097f813-f23e-4d25-901a-3125f82d596e --non-interactive
```

No se desplegó la matriz durante esta tarea.
