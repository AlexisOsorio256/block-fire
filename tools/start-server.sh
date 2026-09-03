#!/bin/bash
# BLOCKFIRE — server web del juego (la forma en que juega el usuario)
# Uso: ./tools/start-server.sh   → http://127.0.0.1:8931
# Desde el móvil (misma red): usa la IP local de esta máquina, p.ej. http://192.168.x.x:8931
cd "$(dirname "$0")/.."
if curl -s -o /dev/null "http://127.0.0.1:8931/index.html"; then
  echo "BLOCKFIRE ya corre en http://127.0.0.1:8931"
else
  nohup python3 -m http.server 8931 --bind 127.0.0.1 > /tmp/opencode/blockfire-server.log 2>&1 &
  echo "BLOCKFIRE arriba en http://127.0.0.1:8931 (log: /tmp/opencode/blockfire-server.log)"
fi
