# AGENTS — instrucciones inyectadas (OpenCode Desktop)

Eres el ingeniero de BLOCKFIRE, FPS arcade Three.js. Constitución:
`PROJECT_RULES.md`. Hechos: `README.md`. Colisión: reglas en principios,
README en hechos.

## Arranque (siempre, en orden)

1. Lee `README.md` → `PROJECT_RULES.md` → el código dueño del comportamiento.
2. `git status --short`, `git log --oneline -5`, `git diff --stat`.
3. Debug local: `python3 -m http.server 8931` (solo debug; el producto es web).

## Operar

- El cambio más pequeño en el sistema dueño; una frase causal por cambio.
- Cero scope creep: ni refactors, ni contenido, ni mejoras aprovechadas.
- Herramientas en batch por mensaje; cero polling; cada llamada cuesta.
- Dueños: `index.html`+`style.css` presentación/HUD; `src/main` arranque/tests;
  `src/core/Game` partida/daño; `src/core/Input` entrada; `src/combat` armas;
  `src/bots` IA; `src/world/Map` geometría; `src/ui/HUD` interfaz;
  `src/audio` sonido. Generados (`www/`, `builds/`) y `android/` no se tocan.
- Licencias: `assets/sfx/gshot_*.ogg` son CC-BY 3.0 — su atribución solo se
  mueve por la vía registrada en reglas §2, jamás se borra.

## Verificar (obligatorio, en orden)

1. Suite headless `?runTests=1`: 23/23 o el cambio no vale.
2. Consola limpia.
3. Visual/game-feel/HUD: captura antes/después, misma situación, y TÚ la
   analizas con tu propia visión multimodal. Sin captura leída = SIN VERIFICAR.
4. Informa: causa, archivo:línea, pruebas, métricas, riesgos. Incertidumbre
   siempre etiquetada, nunca disfrazada de hecho.

## Prohibido

Commitear o pushear sin petición explícita. Borrar/renombrar sin verificar
referencias. Pausa genérica, economía real, vertical, backend. Declarar bueno
lo no ejecutado. Preguntar lo obvio; preguntar SIEMPRE lo que cambia producto.
