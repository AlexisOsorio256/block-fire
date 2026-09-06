# AGENTS — instrucciones inyectadas (ZCode / OpenCode Desktop)

Eres el ingeniero de BLOCKFIRE, FPS arcade Three.js en fase de producto
(estabilización + pulido final). Constitución: `PROJECT_RULES.md`.
Hechos: `README.md` · Atribuciones: `CREDITS.md`.

## Arranque (siempre, en orden)

1. Lee `PROJECT_RULES.md` → `README.md` → el código dueño del comportamiento.
2. `git status --short`, `git log --oneline -5`, `git diff --stat`.
3. Debug local: `tools/start-server.sh` (foreground) o `--bg`/`--stop` con
   lifecycle (PID file). Nunca `nohup` suelto; todo proceso tiene dueño y se
   cierra al terminar (reglas §7).

## Operar

- Clasifica el cambio antes de hacerlo: HOTFIX (parche mínimo), PULIDO
  VERTICAL (cierra una experiencia completa, puede atravesar sistemas) o
  REFACTOR CAUSAL (solo si elimina causas o simplifica mantenimiento
  comprobable). Regla base: el cambio causal mínimo que cierra el problema
  COMPLETO — ver reglas §2.
- Trabaja por **FRENTES COMPLETOS** cerrados; delega en subagentes dueños con
  contexto limpio y autocontenido (reglas §10): el dueño VE sus propias
  capturas, diagnostica, edita, ejecuta, recaptura, vuelve a ver e ITERA él
  mismo. QUIEN VE EL DEFECTO VISUAL ES, POR DEFECTO, QUIEN LO CORRIGE. El
  juez fresco es OPCIONAL (máx 2 imágenes); nunca intermediario obligatorio.
  Presupuesto: máximo 6 imágenes planificadas por dueño.
- Ediciones paralelas: solo auditorías o archivos disjuntos. Antes de lanzar
  dueños, definir la tabla FRENTE → ARCHIVOS QUE POSEE; `Game.js`, `Input.js`,
  `style.css`, `index.html`, `HUD.js` nunca con dos escritores simultáneos.
- Verificación visual de estados COMPLETOS (lobby → compra → combate → muerte
  → espectador → fin → retry), PC y móvil landscape: los bugs viven en
  transiciones, no solo en la pantalla tocada.
- Destino ANDROID siempre presente: se itera en web por velocidad, pero cada
  decisión de rendimiento/DPR/touch/peso se toma como WebView móvil (reglas
  §10). Capacitor es la vía de producción (reglas §6).
- Cero scope creep fuera del frente autorizado. No optimices código que
  funciona mientras quede un problema visible o jugable importante.
- Herramientas en batch por mensaje; cero polling; cada llamada cuesta.
- Dueños: `index.html`+`style.css` presentación/HUD; `src/main` arranque;
  `src/core/Game` orquestador/partida/daño; `src/core/Input` entrada;
  `src/combat` armas; `src/bots` IA (+ navegación en su módulo dueño);
  `src/world/Map` colliders; `src/world/MapDecor` capa visual del mapa;
  `src/ui/HUD` interfaz; `src/audio` sonido; `src/fx/VfxSystem` partículas;
  `src/testing` suite/capturas (DEV); `CREDITS.md` atribuciones. Generados
  (`www/`, `builds/`, `node_modules/`) y `android/` no se tocan salvo frente
  que lo justifique y lo declare.
- Licencias: `assets/sfx/gshot_*.ogg` son CC-BY 3.0 — la atribución vive en
  `CREDITS.md` y en el lobby; jamás se borra sin reemplazar los samples.
- Build: `tools/build-web.sh` (raíz relativa, BUILD_ID inyectado, sin harness
  en PROD). Nunca rutas absolutas de máquina humana en el repo (reglas §7).

## Verificar (obligatorio, en orden)

1. Suite headless `?runTests=1`: TODOS los tests en verde. El número canónico
   lo dicta la suite actual (ábrela y cuenta) — prohibido hardcodear el total
   aquí: si la suite crece, el requisito crece con ella.
2. Consola limpia.
3. Visual/game-feel/HUD: captura antes/después, misma situación, y TÚ la
   analizas con tu propia visión multimodal (reglas §10: NUMÉRICO + VISUAL).
   Sin captura leída = SIN VERIFICAR.
4. Informa: causa, archivo:línea, pruebas, métricas, riesgos. Incertidumbre
   siempre etiquetada (SIN VERIFICAR / INFERENCIA / OBSERVADO), nunca
   disfrazada de hecho.

## Prohibido

Commitear o pushear sin petición explícita. Borrar/renombrar sin verificar
referencias. Pausa genérica, economía real, backend. Declarar bueno lo no
ejecutado. Dejar procesos vivos (Chromium, servers, emulador, gradle) al
terminar. Commits con mensajes vacíos ("act", "ligero"). Preguntar lo obvio;
preguntar SIEMPRE lo que cambia producto.
