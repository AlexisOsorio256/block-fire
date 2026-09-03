#!/bin/bash
# Empaqueta el juego web a www/ (webDir de Capacitor)
set -e
cd /home/alex/Documentos/BlockFire
rm -rf www && mkdir -p www/assets
npx esbuild src/main.js --bundle --format=iife --outfile=www/bundle.js --platform=browser --minify
cp index.html style.css www/
cp -r assets/* www/assets/
echo "www/ listo: $(du -sh www | cut -f1)"
