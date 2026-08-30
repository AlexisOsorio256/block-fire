# DESIGN_LOG.md — BLOCKFIRE

> Log del juego activo. Históricos anteriores (Pulse Dam, Escombros, 40 conceptos) quedan en git history, no en archivos sueltos.

---

## 2026-08-30 — Limpieza y enfoque BLOCKFIRE

**Cambio:** Borrado de todo lo que no ayuda a BLOCKFIRE: `historico/` (6 docs + 15 capturas Pulse/Escombros), `PROPUESTA_GAMEPLAY.md` (71K), `PROPUESTA_NUEVO_JUEGO.md`, `RESET_TOTAL.md`, `game.js` raíz (32K 2D). Raíz de 8.7M → 6.8M → ahora 4 markdowns + `src/` (BLOCKFIRE) + `capturas/` vacía.

**Motivo:** Orden: “lo demás es basura mezclada del otro juego y se borra, solo arquitectura que ayuda a la IA”. Un repo con 10 markdowns y 15 PNGs históricos confunde y se sube a git sin necesidad.

**Resultado:** Repo eficiente: `README.md`, `PROJECT_RULES.md`, `DESIGN_LOG.md` (este), `index.html`, `style.css`, `src/` (8 archivos, <400 líneas c/u), `capturas/` vacía. Todo histórico queda en `git log`, no en carpeta.

---

## 2026-08-30 — BLOCKFIRE prototipo FFA 8

**Cambio:** Nuevo juego `BLOCKFIRE` (no es Pulse Dam v2, no es Escombros). Stack: `Three.js 0.160.0` via importmap, Vanilla ES6, sin build. Estructura `src/core`, `src/player`, `src/combat`, `src/bots`, `src/world`, `src/ui`, `src/audio`.

**Motivo:** Objetivo real: base probada FPS (KUBOOM/Warzone sensación) + input simple + espacio decisiones grande (como Angry Birds, Mob Control, Pool, Clash) pero sin copiar. Necesitamos comprobar si es divertido entrar, moverse, disparar y matar en loop rápido.

**Arquitectura:**
- Datos + Sistemas separados (`WeaponData` rifle/pistol/shotgun vs `WeaponSystem`)
- Humanos y bots usan **mismo** `WeaponSystem` (via `Bot` finge cámara)
- PC y móvil solo cambian `Input` (`KeyboardMouseInput` vs `TouchInput` → `PlayerController`)
- Mapa 48×48 con 5 clusters + 8 spawns con jitter y `getGroundY`/`checkCollision`
- Bots con `Bot.js`: wander/chase/attack, strafe, raycast contra mapa para oclusión, 7 bots baratos

**Resultado:** `index.html` + `style.css` + `src/` (8 archivos). `npm run` no necesario, `python3 -m http.server` y listo. `?runTests=1` con 6 tests, `?capture=playing` para screenshots.

---

## 2026-08-30 — Principios canónicos añadidos

**Cambio:** Añadidos a `PROJECT_RULES.md`:
- “Simple de entender. Rápido de jugar. Satisfactorio de disparar. Difícil de romper. Fácil de extender.”
- Orden de prioridades Estabilidad > Gameplay > Performance > UX > Features
- Reglas IA 1-10 (no reescribir sin necesidad, inspeccionar, no duplicar, etc.)

**Motivo:** Evitar que la IA se vuelva loca construyendo features o refactors gigantes.

---

*Próxima entrada: resultado del playtest FFA 20 kills (¿es divertido el loop sin fricción?)*
