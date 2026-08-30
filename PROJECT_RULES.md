# PROJECT_RULES — BLOCKFIRE (canónico para IAs)

> Si eres IA y vas a tocar este repo, esto es la verdad. README explica qué es; esto explica cómo trabajar.

## 1. IDENTIDAD

**BLOCKFIRE** — FPS 3D blocky, 1 humano + 7 bots, FFA, 20 kills o 5 min, 1 mapa 48×48, 3 armas. PC y móvil misma lógica, solo `Input` cambia.

## 2. PREGUNTA FUNDAMENTAL

> **¿Es divertido entrar, moverte rápido, encontrar, disparar, matar y respawnear sin fricción desde el segundo 1?**

Si no, nada más importa.

## 3. ESTADO ACTUAL (2026-08-30)

Prototipo jugable FFA 8, strafe fix aplicado, 6/6 tests, 60fps objetivo, `capturas/` limpias. Siguiente: validar con video 60fps y pulir eficiencia, no añadir contenido.

## 4. TEST 13 — éxito = todos pasan

1 Entrar 1 click · 2 mover fluido · 3 apuntar preciso (mouse/touch) · 4 disparo satisfactorio (flash/recoil/hitmarker/sonido) · 5 feedback impactos · 6 bots reaccionan · 7 muerte+respawn 1.8s · 8 spawn lejano · 9 encuentro <10s · 10 60fps PC/móvil · 11 PC ok · 12 móvil ok · 13 otra IA puede continuar sin reescribir

## 5. PROHIBIDO hasta validar núcleo

Tienda, monedas, skins, battle pass, ranking, cuentas, multiplayer online/matchmaking, anuncios, campaña, inventario, loot, vehículos, clanes, chat, habilidades, 20 armas/mapas.

## 6. NO CLONAR

Inspiración en sensación KUBOOM/Warzone, no copiar mapas/armas/nombres/UI/assets. Blocky low-poly propio.

## 7. ARQUITECTURA (no inventar otra)

```
src/core      Game, Input
src/player    PlayerController
src/combat    Weapon (WeaponData) + WeaponSystem
src/bots      Bot
src/world     Map + SpawnSystem
src/ui        HUD
src/audio     AudioManager
```

Reglas: <400 líneas/archivo, datos separados de sistema (`WeaponData {damage,fireRate,mag,reload,spread,recoil,range,pellets,auto}`), humanos y bots usan mismo `WeaponSystem`, PC/móvil solo cambia `Input`.

## 8. PRIORIDAD

**Estabilidad > Gameplay > Performance > UX > Features**  
**Diversión > Claridad > Agencia**  
No romper estabilidad por feature, ni gameplay por arquitectura.

## 9. EFICIENCIA (no negociable)

- 60fps PC y móvil modesto. Shadows 1024, sin antialias pesado en móvil, pixelRatio ≤1.5.
- Geometrías/materiales pooled, no crear `Geometry/Material` por disparo.
- Efectos (impact/blood) en loop central, no `requestAnimationFrame` por partícula.
- Archivos <400 líneas, sin frameworks gigantes, sin deps.

## 10. REGLAS IA

1 Inspecciona antes de modificar · 2 No dupliques sistema · 3 No segunda implementación · 4 No deps sin razón · 5 No refactors gigantes por estética · 6 Reusa sistemas · 7 No añadas features no pedidas · 8 Si puede romper gameplay, prueba antes

## 11. REPO EFICIENTE

```
BLOCKFIRE/
├── README.md / PROJECT_RULES.md / DESIGN_LOG.md
├── index.html / style.css
├── src/ (8 archivos)
├── capturas/ (solo evidencia actual)
└── .gitignore / LICENSE
```

Histórico queda en `git log`, no en carpeta.

*Actualizado: 2026-08-30 — foco IA, eficiencia, sin extras.*
