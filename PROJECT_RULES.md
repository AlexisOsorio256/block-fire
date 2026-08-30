# PROJECT_RULES.md — BLOCKFIRE

> Fuente canónica del proyecto. Si dudas, lee esto antes de tocar código.

---

## 1. IDENTIDAD

**Nombre:** `BLOCKFIRE` (provisional)  
**Descripción:** FPS 3D blocky low-poly, 1 jugador + 7 bots, FFA, 20 kills o 5 minutos, 1 mapa pequeño, 3 armas, movimiento rápido, disparo satisfactorio. PC (WASD+Mouse) y Móvil (joystick+botones) con **misma lógica**, solo input distinto.

---

## 2. OBJETIVO IRREFUTABLE

> **¿Es divertido entrar, moverse rápido, encontrar enemigos, disparar, matar y volver a hacerlo inmediatamente sin fricción, con un FPS que se siente real desde el primer segundo?**

Si la respuesta es no, no importa cuán bonita sea la arquitectura.

---

## 3. TESTS IRREFUTABLES (prototipo es éxito si los 13 pasan)

1. Entra a partida en 1 click
2. Se mueve fluido (sin peso militar)
3. Apunta con precisión (mouse y táctil)
4. Disparar se siente satisfactorio (flash, sonido, recoil, hitmarker)
5. Impactos tienen feedback (sangre, impacto, shake)
6. Enemigos reaccionan (se mueven, disparan, mueren)
7. Muertes funcionan (feedback + 1.8s respawn)
8. Respawn es rápido y en spawn lejano
9. Encuentros <10s (mapa pequeño)
10. 60fps estable en PC y móvil modesto
11. PC funciona (teclado+ratón)
12. Móvil funciona (joystick+botones)
13. Otra IA puede continuar sin reescribir todo (arquitectura clara)

---

## 4. PRINCIPIOS CANÓNICOS

- **El proyecto no busca una mecánica complicada; busca una interacción simple con un espacio de decisiones profundo. La simplicidad del input es deseable. La simplicidad del gameplay NO.**
- **No inventar la rueda cuando existe una base probada. Investigar, extraer, mutar estructuralmente.**
- **La infraestructura se reutiliza por valor técnico; ninguna mecánica se conserva por sentimentalismo.**
- **Código reutilizable ≠ gameplay reutilizable.**
- **Simple de entender. Rápido de jugar. Satisfactorio de disparar. Difícil de romper. Fácil de extender.**
- **GAMEPLAY > ESTABILIDAD > PERFORMANCE > UX > FEATURES** y `DIVERSIÓN > CLARIDAD > AGENCIA ...`

---

## 5. COSAS PROHIBIDAS (en prototipo)

No agregar hasta validar el núcleo FFA:

tienda, monedas, skins, battle pass, ranking, cuentas, multiplayer online, matchmaking, servidores, anuncios, campaña, inventario, loot, vehículos, clanes, chat, habilidades, 20 armas, 20 mapas, progresión.

---

## 6. NO CLONAR

Inspirado en *sensación* de KUBOOM 3D / Warzone (accesibilidad y ritmo), pero **no copiar** mapas, personajes, armas, nombres, UI, assets ni identidad visual de ningún juego. Estética blocky low-poly propia, colorida no infantil, ligera.

---

## 7. ARQUITECTURA

```
src/core      Game, Input, Time
src/player    PlayerController, CameraController
src/combat    Weapon (WeaponData) + WeaponSystem + DamageSystem
src/bots      Bot + BotController
src/match     Match (FFA 20 kills / 5 min), Team, Score
src/world     Map, SpawnSystem
src/effects   VFX, HitFeedback
src/audio     AudioManager
src/ui        HUD
```

Reglas:
- Pocos sistemas, responsabilidades claras, dependencias simples
- Datos separados de comportamiento (`WeaponData` vs `WeaponSystem`)
- Humanos y bots usan **el mismo** `WeaponSystem`
- PC y móvil solo cambian `Input`

---

## 8. DATOS + SISTEMAS

Armas configuradas por datos, no por clases distintas:
```
WeaponData { damage, fireRate, magazineSize, reloadTime, spread, recoil, range, pellets, automatic }
```
Agregar pistola/SMG/rifle/escopeta/sniper sin reescribir `WeaponSystem`.

---

## 9. MVP = FFA 8

- 1 humano + 7 bots, todos contra todos
- +1 kill por eliminación, gana 20 kills o tiempo 5 min
- 1 mapa pequeño con rutas, coberturas, alturas
- 3 armas (rifle auto, pistola semi, escopeta 6 pellets) mismo sistema
- Hitscan raycast: Camera → Raycast → Target → DamageSystem
- Daño: cuerpo, cabeza x2
- Muerte → 1.8s → respawn en spawn lejano
- Sin espectador, sin ragdoll complejo

---

## 10. ORDEN DE PRIORIDADES

1. Estabilidad
2. Gameplay
3. Rendimiento
4. UX
5. Inmersión
6. Features

No sacrificar estabilidad por feature, ni gameplay por arquitectura innecesaria.

---

## 11. REGLAS PARA LA IA

1. No reescribir sistemas funcionales sin necesidad
2. Inspeccionar antes de modificar
3. No duplicar sistemas
4. No crear segunda implementación de una feature existente
5. No introducir dependencias sin razón técnica clara
6. No refactors masivos por estética
7. Mantener archivos <400 líneas
8. Reutilizar sistemas existentes
9. No añadir features no solicitadas
10. Si puede romper gameplay, comprobar comportamiento actual primero

---

## 12. ESTRUCTURA REPO (eficiente)

```
BLOCKFIRE/
├── README.md
├── PROJECT_RULES.md
├── DESIGN_LOG.md
├── index.html
├── style.css
├── src/
│   ├── core/Game.js, Input.js
│   ├── player/PlayerController.js
│   ├── combat/WeaponSystem.js
│   ├── bots/Bot.js
│   ├── world/Map.js
│   ├── ui/HUD.js
│   └── audio/AudioManager.js
├── capturas/          # solo evidencia visual actual (vacía hasta generar)
└── .gitignore, LICENSE
```

Nada de `historico/` con 10 markdowns ni `capturas/historico-pulse/` con 15 PNGs. Si hace falta histórico, queda en git history, no en la carpeta.

---

*Última actualización: 2026-08-30 — BLOCKFIRE FFA 8, 20 kills, 5 min, PC+Móvil, arquitectura limpia.*
