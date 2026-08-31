<div align="center">

# 🔥 BLOCKFIRE

**FPS arcade 3D blocky — partidas rápidas, combate directo, kills constantes.**

Corre en tu navegador. Sin descargas, sin instalación.

```bash
python3 -m http.server 8002
# → http://localhost:8002
```

</div>

---

## 🎮 El juego

- **8 jugadores** FFA: tú contra 7 bots — primero en llegar a **20 kills** gana.
- **3 armas**: rifle automático, pistola y escopeta. Cambia con 1-2-3.
- **Arena de 96×96** con cobertura, plataformas y spawns que mantienen los
  enfrentamientos frecuentes.
- **Respawn en 2 segundos**: morir cuesta poco, volver a pelear cuesta menos.
- **Movimiento ágil**: aceleración instantánea, sprint, salto, strafe.
- **Feedback contundente**: hitmarker, kill banner, headshot, screen shake,
  audio procedural con impacto en cada disparo.

## 📱 Plataformas

| PC | Móvil |
|---|---|
| WASD + ratón (click para pointer lock) | Joystick virtual |
| Click izq: disparar · Click der: apuntar (ADS) | Deslizar: cámara |
| R: recargar · 1-3: armas · Shift: sprint | Botones: disparar/apuntar/saltar/recargar |

El juego es el mismo en ambas plataformas; solo cambia cómo lo controlas.

## 🖼️ Así se ve

| Lobby | Partida |
|---|---|
| ![Lobby](capturas/01-lobby.png) | ![Partida](capturas/05-gameplay-post-polish.png) |

| Móvil vertical | Móvil horizontal |
|---|---|
| ![Portrait](capturas/03-mobile.png) | ![Landscape](capturas/06-mobile-landscape.png) |

---

## 🛠️ Para desarrolladores e IAs

### Arquitectura

```
src/main.js                    arranque y smoke tests
src/core/Game.js               escena, ciclo, partida, daño y VFX
src/core/Input.js              teclado/mouse/táctil → acciones neutrales
src/player/PlayerController.js movimiento, cámara, gravedad y respawn humano
src/combat/WeaponSystem.js     datos de armas, hitscan, munición y feedback
src/bots/Bot.js                IA simple: wander → chase → attack
src/world/Map.js               geometría, spawns, colisión y raycast
src/ui/HUD.js                  HUD, kill feed y banners de feedback
src/audio/AudioManager.js      audio procedural
```

Una responsabilidad por sistema, una sola ruta de gameplay para jugador/bots y
PC/móvil. No crear rutas paralelas: extender el sistema dueño.

### Convenciones espaciales (crítico para IA)

- `position.y` = altura del **ojo**; pies en `y − height` (1.65). Los meshes
  se apoyan con los pies exactamente en `getGroundY()`.
- `Map.getGroundY(x, z, feetY, stepUp)` solo acepta plataformas alcanzables.
- `Map.raycast` (slab ray-AABB) resuelve oclusión **antes** de aplicar daño.
- Hitboxes medidos hacia abajo desde el ojo: cabeza `eye−0.10`, torso `eye−0.63`.

### Verificación

- `?runTests=1` — suite mínima. **No aceptar cambios sin 7/7 PASS.**
- `?capture=playing` — partida iniciada para capturas.
- `tools/gemini-vision.py` — puente a modelos de visión de Google para
  verificar capturas (requiere `GOOGLE_API_KEY` en `.env`, gitignored).
  **Regla de calidad: una mejora visual no está terminada hasta capturar y
  verificar visualmente.** Visión para detectar; píxeles para explicar.
- Para game feel: grabar gameplay táctil real vía CDP (`dispatchTouchEvent` +
  screencast); medir movimiento fino con crops amplificados entre frames, no
  con video completo (los modelos de visión fallan ahí).

Las reglas del proyecto están en [`PROJECT_RULES.md`](PROJECT_RULES.md) —
léelas antes de tocar código. Son sagradas.
