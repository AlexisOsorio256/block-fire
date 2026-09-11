# BLOCKFIRE — baseline BUILD

TPS móvil en Godot 4.7.2/GDScript, renderer Mobile, Android landscape. Trabaja
sobre el estado real del repo: código, git y tests mandan. No leas documentación
por rutina.

- Usa `tools/bf` cuando la tarea necesite diagnóstico, QA, tests o Android.
- Consulta `docs/ARCHITECTURE.md` solo si el dueño de un comportamiento no es
  claro; `docs/CURRENT_STATE.md` solo si la tarea depende del estado operativo.
- Un dueño/fuente de verdad por concepto; `SettingsStore` es el único autoload.
- No reabras Unity/web/PWA/WebView/Capacitor.
- Verificación proporcional: ejecuta la evidencia más barata que realmente
  pruebe el cambio. Android físico es autoridad cuando la tarea requiere
  plataforma/dispositivo; no es gate universal.
- No inventes evidencia: lo no ejecutado es `SIN VERIFICAR`; inferencias de
  logs/métricas son `INFERENCIA`.
- Commit + push están autorizados al cerrar trabajo verificado; no pidas permiso.
