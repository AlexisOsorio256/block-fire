---
name: blockfire-android-qa
description: >-
  Validación Android de BLOCKFIRE: build, instalación, capturas, screenrecord,
  logcat y limpieza, con el teléfono como autoridad de plataforma.
whenToUse: >-
  Cuando la tarea toca input táctil, layout de controles, rendimiento en
  dispositivo, export/APK o cualquier cosa que Linux no pueda autorizar.
---

# QA Android

Linux es el laboratorio autónomo; el dispositivo físico es la **autoridad de
plataforma**. Cuando el cambio toca lo táctil, lo visual en pantalla real o el
rendimiento, Linux no cierra la tarea.

## Descubrir el entorno (una sola vez)

`tools/bf doctor` reporta teléfono conectado y la ruta de `adb` que el proyecto
usa. No busques `adb` a mano ni instales SDKs: si no aparece, es un hallazgo que
se reporta, no un problema que se resuelva improvisando.

## Ciclo

1. `tools/bf build android` — APK de debug.
2. Instalar y lanzar:
   `adb install -r builds/*.apk` y `adb shell monkey -p <package> 1`
   (o el script que el proyecto ya tenga).
3. Ver de verdad: captura (`adb exec-out screencap -p > captures/<algo>.png`) o
   `adb shell screenrecord` para movimiento. Guarda en `captures/`, que ya está
   ignorado por git. **Mira la captura** con `read_image`; no la declares
   inspeccionada por tamaño de archivo.
4. Si algo falla: `adb logcat -d` filtrado por el tag/paquete, no el log
   completo. Los errores de Godot suelen ser explícitos.
5. Cerrar limpio: mata el proceso si lo dejaste vivo, y no dejes `adb`,
   Gradle, editor ni watchers abandonados. `AGENTS.md` lo exige al cerrar.

## Cuándo es obligatorio el dispositivo

- Input táctil, layout del editor de controles, zonas de arrastre.
- Presentación a resolución y densidad reales (HUD, lobby, tienda).
- Rendimiento y estabilidad bajo carga real.
- Cualquier regresión que solo aparece en el build de Android.

Si el teléfono no está conectado, la tarea queda `SIN VERIFICAR` en su parte
Android. Dilo así; no la marques cerrada por haber compilado el APK.

## Trampas

- Declarar cerrado un cambio táctil con solo el runtime de Linux.
- Capturar y no mirar.
- Dejar la app instalada y corriendo en el teléfono del usuario.
- Instalar paquetes, herramientas o SDKs del sistema sin autorización.
