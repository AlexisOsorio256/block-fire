#!/bin/bash
set -e
SDK=/home/alex/Documentos/android-tools
BT=$SDK/sdk/build-tools/36.0.0
AJ=$SDK/sdk/platforms/android-35/android.jar
JDK=$SDK/jdk/bin
cd /tmp/opencode/android-app
rm -rf out && mkdir -p out
# 1) R.java del manifest
$BT/aapt2 link -I $AJ --manifest AndroidManifest.xml --java out/ -o out/base.apk
# 2) compilar java
$JDK/javac -source 17 -target 17 -classpath $AJ -d out/out app/src/MainActivity.java out/com/blockfire/app/R.java
# 3) dex
$BT/d8 out/out/com/blockfire/app/*.class --lib $AJ --output out
# 4) apk con assets (el juego web)
mkdir -p app/assets && cp -r /tmp/opencode/webapp/* app/assets/
$BT/aapt2 link -o out/app-unsigned.apk -I $AJ --manifest AndroidManifest.xml -A app/assets
# 5) dex dentro del apk + alinear + firmar
cd out && zip -qj app-unsigned.apk classes.dex && cd ..
$BT/zipalign -f 4 out/app-unsigned.apk out/app-aligned.apk
$SDK/jdk/bin/java -jar $BT/apksigner 2>/dev/null || $BT/apksigner sign --ks ~/.config/godot/debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --out /home/alex/Documentos/BlockFire/builds/blockfire-webview.apk out/app-aligned.apk
echo "APK: $(ls -la /home/alex/Documentos/BlockFire/builds/blockfire-webview.apk | awk '{print $5}') bytes"
