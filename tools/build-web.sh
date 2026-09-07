#!/bin/bash
# Empaqueta el juego web a www/ (webDir de Capacitor).
# Ruta raíz calculada desde la ubicación de ESTE script: funciona desde
# cualquier usuario/máquina/carpeta. Nada de rutas absolutas humanas.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUILD_ID="bf-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'nogit')-$(date +%Y%m%d%H%M)"

rm -rf www && mkdir -p www/assets
npx esbuild src/main.js \
  --bundle --format=iife --platform=browser --minify \
  --outfile=www/bundle.js \
  --alias:three=./src/lib/three.module.js \
  "--define:BF_BUILD_ID=\"$BUILD_ID\"" \
  "--define:BF_DEV_TOOLS=false"

# index para el bundle: mismo HTML pero cargando bundle.js en vez de src/main.js
# (los imports "three" ya viven dentro del bundle — el importmap ya no es necesario)
sed -e 's|<script type="module" src="src/main.js"></script>|<script src="bundle.js"></script>|' index.html > www/index.html
cp style.css www/
cp -r assets/* www/assets/
cp CREDITS.md www/

BUNDLE_KB=$(du -k www/bundle.js | cut -f1)
echo "www/ listo: $(du -sh www | cut -f1) — bundle ${BUNDLE_KB}KB — BUILD_ID=$BUILD_ID"
