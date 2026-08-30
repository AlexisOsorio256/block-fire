# BLOCKFIRE — FPS 3D Blocky

> **Para la IA:** Lee esto primero. Todo lo demás es secundario.
> BLOCKFIRE es un FPS rápido, 1 jugador + 7 bots, FFA 20 kills / 5 min. Objetivo: probar si el loop es divertido sin fricción.

## 1. Qué es ahora

- **Prototipo jugable:** 1 mapa 48×48 (5 clusters + plataformas), 3 armas (rifle/pistola/escopeta, mismo `WeaponSystem`), 7 bots `wander→chase→attack`.
- **Controles:** PC `WASD + Mouse Click` (pointer lock) / Móvil `joystick + desliza + botones` → mismo `PlayerController` (strafe fix aplicado 2026-08-30).
- **Loop:** Entrar (1 click) → moverte rápido (5.2/7.0) → encontrar (<10s) → disparar (hitscan, recoil, hitmarker) → kill → respawn 1.8s lejos → repetir hasta 20.
- **Estado:** Base estable, `6/6 tests` en `?runTests=1`, 60fps objetivo, capturas en `capturas/` regeneradas tras fix.

## 2. A dónde va (siguiente, no inventar)

1. **Validar diversión:** ¿20 kills en 5 min se siente rápido y satisfactorio? Ajustar solo `moveSpeed / fireRate / spread / bot inaccuracy / map densidad` si el video 60fps muestra fricción.
2. **Eficiencia:** Mantener 60fps PC y móvil modesto. No añadir tienda/skins/mapas/armas/multiplayer hasta validar núcleo.
3. **No añadir nada más** hasta pasar los 13 tests irrefutables.

## 3. Qué no hacer

Parado hasta validar FFA: tienda, monedas, skins, battle pass, ranking, multiplayer online, matchmaking, loot, vehículos, clanes, chat, 20 armas/mapas.

## 4. Arquitectura mínima (para continuar sin romper)

```
src/core/Game.js        # scene, renderer, loop, match
src/core/Input.js       # KeyboardMouse + Touch → {move,fire,jump}
src/player/PlayerController.js # movimiento, gravedad, cámara, colisión
src/combat/WeaponSystem.js     # WeaponData + hitscan + recoil
src/bots/Bot.js         # 7 bots, mismo WeaponSystem que humano
src/world/Map.js        # 48×48, spawns, colisión, raycast
src/ui/HUD.js + src/audio/AudioManager.js
main.js → window.__BLOCKFIRE__ , ?runTests=1 , ?capture=playing
```

Reglas: <400 líneas/archivo, datos ≠ sistema, humanos/bots comparten `WeaponSystem`, PC/móvil solo cambia `Input`.

## 5. Cómo correr / verificar

```bash
python3 -m http.server 8002 --directory /home/alex/Documentos/BlockFire
# http://localhost:8002 → ENTRAR A PARTIDA → click canvas para lock
# http://localhost:8002/?runTests=1 → 6/6 PASS
# http://localhost:8002/?capture=playing → screenshot estado jugando
```

## 6. Evidencia

`capturas/` solo lo actual (01-ready, 02-playing, 03-mobile, 04-tests). Histórico en `git log`, no en carpeta.

*Actualizado: 2026-08-30 — fix strafe invertido, foco IA, eficiencia.*
