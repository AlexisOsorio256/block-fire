#!/usr/bin/env bash
set -euo pipefail

# Smoke/debug APK opcional. Capacitor (android/) es la vía de producción.
# Todas las rutas del proyecto nacen del script; el SDK/JDK se descubre por
# variables de entorno del operador, nunca por una ruta de esta máquina.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SDK="$(printenv ANDROID_SDK_ROOT || true)"
if [ -z "$SDK" ]; then SDK="$(printenv ANDROID_HOME || true)"; fi
if [ -z "$SDK" ]; then
  echo "Falta ANDROID_SDK_ROOT o ANDROID_HOME; no se puede construir la WebView smoke." >&2
  exit 2
fi

BT="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -V | tail -n 1)"
PLATFORM="$(printenv ANDROID_PLATFORM || true)"
if [ -z "$PLATFORM" ]; then PLATFORM="android-35"; fi
AJ="$SDK/platforms/$PLATFORM/android.jar"
JDK_BIN="$(printenv JAVA_HOME || true)"
if [ -n "$JDK_BIN" ]; then JDK_BIN="$JDK_BIN/bin"; fi
if [ -z "$JDK_BIN" ]; then JDK_BIN="$(dirname "$(command -v javac)")"; fi
AAPT2="$BT/aapt2"
D8="$BT/d8"
ZIPALIGN="$BT/zipalign"
APKSIGNER="$BT/apksigner"
for tool in "$AAPT2" "$D8" "$ZIPALIGN" "$APKSIGNER" "$JDK_BIN/javac" "$JDK_BIN/keytool"; do
  if [ ! -x "$tool" ] && [ ! -f "$tool" ]; then
    echo "Herramienta Android/JDK no encontrada: $tool" >&2
    exit 2
  fi
done
if [ ! -f "$AJ" ]; then
  echo "Plataforma Android no encontrada: $AJ" >&2
  exit 2
fi

if [ ! -f "$ROOT/www/index.html" ]; then
  bash "$ROOT/tools/build-web.sh"
fi

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
APK="$ROOT/builds/blockfire-webview.apk"
mkdir -p "$ROOT/builds"
mkdir -p "$OUT/classes" "$OUT/dex"

"$AAPT2" link -I "$AJ" --manifest "$ROOT/tools/webview/AndroidManifest.xml" \
  -A "$ROOT/www" -o "$OUT/app-unsigned.apk"
"$JDK_BIN/javac" -source 17 -target 17 -classpath "$AJ" -d "$OUT/classes" \
  "$ROOT/tools/webview/MainActivity.java"
"$D8" "$OUT/classes/com/blockfire/app/MainActivity.class" --lib "$AJ" --output "$OUT/dex"
zip -qj "$OUT/app-unsigned.apk" "$OUT/dex/classes.dex"
"$ZIPALIGN" -f 4 "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"

KEYSTORE="$(printenv ANDROID_DEBUG_KEYSTORE || true)"
if [ -z "$KEYSTORE" ]; then KEYSTORE="$OUT/debug.keystore"; fi
if [ ! -f "$KEYSTORE" ]; then
  "$JDK_BIN/keytool" -genkeypair -noprompt -keystore "$KEYSTORE" \
    -storepass android -keypass android -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=BLOCKFIRE,O=BLOCKFIRE,C=MX" >/dev/null
fi
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:android \
  --ks-key-alias androiddebugkey --out "$APK" "$OUT/app-aligned.apk"
echo "APK: $APK"
