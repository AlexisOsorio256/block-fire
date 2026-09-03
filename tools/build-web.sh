#!/bin/bash
# Empaqueta el juego web a www/ (webDir de Capacitor)
set -e
cd /home/alex/Documentos/BlockFire
rm -rf www && mkdir -p www/assets
npx esbuild src/main.js --bundle --format=iife --outfile=www/bundle.js --platform=browser --minify --alias:three=./src/lib/three.module.js
# index para el bundle: mismo HTML pero cargando bundle.js en vez de src/main.js
# (los imports "three" ya viven dentro del bundle — el importmap ya no es necesario)
sed -e 's|<script type="module" src="src/main.js"></script>|<script src="bundle.js"></script>|' index.html > www/index.html
cp style.css www/
cp -r assets/* www/assets/
echo "www/ listo: $(du -sh www | cut -f1)"
