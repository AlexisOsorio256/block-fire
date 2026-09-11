---
name: blockfire-android-qa
description: >-
  Verificación en Android físico cuando Linux no puede autorizar la conclusión.
whenToUse: >-
  Input táctil, layout/densidad real, rendimiento/estabilidad de dispositivo,
  export/APK o bugs Android.
---

# Android

El teléfono físico es autoridad solo para conclusiones de plataforma/dispositivo.
`tools/bf doctor` descubre adb/teléfono; no instales SDKs ni busques rutas a mano.

Flujo cuando aplica: `tools/bf build android` → instalar/lanzar con las tools del
repo/adb → captura o vídeo **mirado** → logcat filtrado si falla → cerrar procesos
propios. `captures/` es salida temporal.

Si no hay dispositivo, reporta la parte Android como `SIN VERIFICAR`; un APK que
compila no demuestra input táctil, densidad real ni rendimiento.
