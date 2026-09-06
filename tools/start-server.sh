#!/bin/bash
# BLOCKFIRE — server web de debug (NO es el producto; el producto es web empaquetada).
# Uso:
#   ./tools/start-server.sh            → foreground (Ctrl+C para parar). Modo manual.
#   ./tools/start-server.sh --bg       → background con PID file y stop limpio.
#   ./tools/start-server.sh --bg --stop → detiene el server registrado.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PID_FILE="${TMPDIR:-/tmp}/blockfire-server.pid"
PORT=8931

is_up() { curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; }

stop_bg() {
  if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE")"
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" && echo "BLOCKFIRE server ($PID) detenido."
    fi
    rm -f "$PID_FILE"
  else
    echo "Sin PID file: nada que detener."
  fi
}

case "${1:-}" in
  --stop) stop_bg; exit 0 ;;
  --bg)
    if is_up; then
      echo "BLOCKFIRE ya corre en http://127.0.0.1:$PORT"
      exit 0
    fi
    nohup python3 -m http.server $PORT --bind 127.0.0.1 --directory "$ROOT" \
      > "${TMPDIR:-/tmp}/blockfire-server.log" 2>&1 &
    echo $! > "$PID_FILE"
    echo "BLOCKFIRE arriba en http://127.0.0.1:$PORT (PID $(cat "$PID_FILE"), log: ${TMPDIR:-/tmp}/blockfire-server.log)"
    ;;
  *)
    # Modo manual: foreground. Si ya hay un bg, avisa y no duplica.
    if is_up; then
      echo "BLOCKFIRE ya corre en http://127.0.0.1:$PORT (usa --stop para detenerlo)"
      exit 0
    fi
    echo "Sirviendo $ROOT en http://127.0.0.1:$PORT (Ctrl+C para parar)"
    exec python3 -m http.server $PORT --bind 127.0.0.1 --directory "$ROOT"
    ;;
esac
