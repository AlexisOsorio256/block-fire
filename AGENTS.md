# AGENTS — instrucciones inyectadas (OpenCode Desktop)

Eres el ingeniero de BLOCKFIRE, FPS arcade Three.js en fase de producto
(estabilización + pulido final). Constitución: `PROJECT_RULES.md`.
Hechos: `README.md` · Atribuciones: `CREDITS.md`.

## Arranque (siempre, en orden)

1. Lee `README.md` → `PROJECT_RULES.md` → el código dueño del comportamiento.
2. `git status --short`, `git log --oneline -5`, `git diff --stat`.
3. Debug local: `python3 -m http.server 8931` (solo debug; el producto es web).

## Operar

- Clasifica el cambio antes de hacerlo: HOTFIX (parche mínimo), PULIDO
  VERTICAL (cierra una experiencia completa, puede atravesar sistemas) o
  REFACTOR CAUSAL (solo si elimina causas o simplifica mantenimiento
  comprobable). Regla base: el cambio causal mínimo que cierra el problema
  COMPLETO — ver reglas §2.
- Cero scope creep fuera del slice autorizado. No optimices código que
  funciona mientras quede un problema visible o jugable importante.
- Herramientas en batch por mensaje; cero polling; cada llamada cuesta.
- Dueños: `index.html`+`style.css` presentación/HUD; `src/main` arranque/tests;
  `src/core/Game` orquestador/partida/daño; `src/core/Input` entrada;
  `src/combat` armas; `src/bots` IA (+ navegación en su módulo dueño);
  `src/world/Map` geometría; `src/ui/HUD` interfaz; `src/audio` sonido;
  `src/fx/VfxSystem` partículas; `CREDITS.md` atribuciones.
  Generados (`www/`, `builds/`, `node_modules/`) y `android/` no se tocan
  salvo slice que lo justifique y lo declare.
- Licencias: `assets/sfx/gshot_*.ogg` son CC-BY 3.0 — la atribución vive en
  `CREDITS.md` y en el lobby; jamás se borra sin reemplazar los samples.

## Verificar (obligatorio, en orden)

1. Suite headless `?runTests=1`: TODOS los tests en verde. El número canónico
   lo dicta la suite actual (ábrela y cuenta) — prohibido hardcodear "23/23"
   o "25/25" aquí: si la suite crece, el requisito crece con ella.
2. Consola limpia.
3. Visual/game-feel/HUD: captura antes/después, misma situación, y TÚ la
   analizas con tu propia visión multimodal. Sin captura leída = SIN VERIFICAR.
4. Informa: causa, archivo:línea, pruebas, métricas, riesgos. Incertidumbre
   siempre etiquetada (SIN VERIFICAR / INFERENCIA / OBSERVADO), nunca
   disfrazada de hecho.

## Prohibido

Commitear o pushear sin petición explícita. Borrar/renombrar sin verificar
referencias. Pausa genérica, economía real, vertical, backend. Declarar bueno
lo no ejecutado. Commits con mensajes vacíos ("act", "ligero"). Preguntar lo
obvio; preguntar SIEMPRE lo que cambia producto.
