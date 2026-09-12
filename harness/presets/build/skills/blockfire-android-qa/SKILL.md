---
name: blockfire-android-qa
description: "Load for touch input, real density, APK or Android bugs; verify on a physical device."
whenToUse: "Touch input, real layout/density, device performance/stability, export/APK or Android bugs."
---

# Android

The physical phone is authoritative only for platform/device conclusions.
`tools/bf doctor` discovers adb/phone; do not install SDKs or hunt paths by hand.

Flow when it applies: `tools/bf build android` -> install/launch with the repo
tools/adb -> capture or video **watched** -> filtered logcat if it fails -> close
your own processes. Session screenshots/video/logs belong under `/tmp/blockfire-*`,
never `captures/` or another checkout path.

If there is no device, report the Android part as `SIN VERIFICAR`; a compiling APK
proves no touch input, real density or performance.
