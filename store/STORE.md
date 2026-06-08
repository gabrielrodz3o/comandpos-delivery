# Assets para stores — ComandPOS Delivery

Logos generados con Nano Banana Pro (Google) en alta definición, marca **naranja #F97316** · scooter de delivery.

## Generado ✅

### App (en `assets/`, los usa Expo)
| Archivo | Tamaño | Uso |
|---|---|---|
| `assets/icon.png` | 1024² | Icono app (full-bleed, sin esquinas blancas) |
| `assets/adaptive-icon.png` | 1024² | Android adaptive foreground (bg `#F97316`) |
| `assets/splash.png` | 2048² | Splash (scooter blanco sobre naranja) |

### Apple App Store (`store/apple/`)
| Archivo | Tamaño | Requisito |
|---|---|---|
| `AppStore-icon-1024.png` | 1024×1024 | Icono marketing — **PNG sin alpha, sin esquinas redondeadas** ✅ |

### Google Play (`store/play/`)
| Archivo | Tamaño | Requisito |
|---|---|---|
| `icon-512.png` | 512×512 | Icono hi-res ✅ |
| `feature-graphic-1024x500.png` | 1024×500 | Feature graphic ✅ |

## Falta (vos tenés que proveer) — capturas reales
Las **screenshots NO se pueden generar con IA** para submission: deben ser pantallas reales de la app corriendo.
- **Apple**: mínimo 1 set 6.7" (1290×2796) y 6.5" (1242×2688). Tip: corré en simulador iPhone 15 Pro Max → `Cmd+S`.
- **Play**: 2–8 screenshots de teléfono (mín 1080px lado corto) + el feature graphic (ya está).

## Checklist de submission
**Apple (App Store Connect):**
- [x] Icono 1024 (sin alpha)
- [ ] Screenshots 6.7" + 6.5"
- [ ] Descripción, keywords, política de privacidad (URL)
- [ ] Bundle id `com.comandpos.delivery`, build vía EAS

**Google Play (Play Console):**
- [x] Icono 512
- [x] Feature graphic 1024×500
- [ ] 2+ screenshots de teléfono
- [ ] Descripción corta/larga, política de privacidad
- [ ] Package `com.comandpos.delivery`, AAB vía EAS

## Notas
- El emoji 🛵 del login se puede cambiar por `assets/icon.png` (queda como el manager). Pendiente.
- Para regenerar cualquier asset: mismo flujo Nano Banana Pro (ver historial).
