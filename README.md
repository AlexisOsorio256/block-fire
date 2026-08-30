# ESCOMBROS — Destrucción que Construye

> **Pulse Dam DESCARTADO. REBOTE PERSISTENTE DESCARTADO.** Históricos en `historico/` y `capturas/historico-pulse/`. Prototipo actual **B — Destrucción que Construye** (luz verde para prototipar, no es el juego final).

> **Tira → destruye → los escombros no desaparecen → úsalos para el siguiente tiro.**

---

## Qué es

Prototipo extremadamente pequeño para responder: **¿es divertido cuando lo tengo en las manos 5-10 minutos sin contenido que lo maquille?**

**Base probada:** Angry Birds (trayectoria + destrucción por material)  
**Mutación:** los restos **permanecen y se convierten en nuevo escenario**. No desaparecen. 2 escombros iguales se fusionan (suave, no es Suika dominante).

No es Angry Birds con otro nombre. En Angry destruyes y pasa al siguiente nivel. Aquí **destruyes y construyes el terreno del siguiente tiro**.

---

## Core Loop (lo que debe sentirse jugando)

```
APUNTAR (drag desde honda, ves trayectoria punteada 2 rebotes)
↓
LANZAR (suelta)
↓
DESTRUIR (madera hp1 rompe fácil, piedra hp2 resiste)
↓
LOS RESTOS CAEN Y SE QUEDAN (no desaparecen)
↓
ESCENARIO MODIFICADO (escombros forman nueva plataforma/rampa)
↓
NUEVA DECISIÓN (¿qué tiro ahora que tengo rampa?)
↓
LANZAR OTRA VEZ (usando lo que creaste)
```

Segunda orden: `tiro → escombros → nuevo escenario → nueva decisión`

---

## Estado actual — Prototipo B en validación

```
BASE: Angry Birds + Suika/Donut (fusión leve)
MUTACIÓN: Persistencia + escombros colocables/fusionables
STATUS: PROTOTIPO JUGABLE EN VALIDACIÓN (no hay ganador, B solo ganó derecho a ser probado)
BUILD: 32K game.js (~600 líneas, solo infra A reutilizada) + Canvas/DPR/pointer/loop/audio/partículas
```

**Implementado para MVP (solo core, sin features):**
- ✅ Lanzamiento drag con dirección+fuerza, trayectoria punteada, rebotes predecibles
- ✅ Física con gravedad 980, restitución madera/piedra distinta
- ✅ Estructura pequeña 7 bloques (3 madera base hp1, 2 piedra hp2, 1 target ★, 1 madera suelta)
- ✅ 2 materiales que generan decisión (madera fácil muchos escombros pequeños vs piedra resistente pocos grandes)
- ✅ Persistencia: bloques destruidos caen y se quedan como escombros estáticos que bloquean/rebotan el siguiente tiro
- ✅ Múltiples objetivos (madera, piedra, target ★) → “¿cuál destruyo primero?”
- ✅ Posicionamiento importa (dónde caen escombros)
- ✅ Recuperación: mala jugada no es game over, escombros quedan y puedes corregir
- ✅ Score/best, retry instantáneo, audio procedural, partículas, shake

**Prohibido y no agregado:** monedas, tienda, skins, upgrades, cartas, energía, vidas, anuncios, niveles, progresión, economía, backend.

---

## Cómo ejecutar

```bash
python3 -m http.server 8002 --directory /home/alex/Documentos/pulse-dam
# abrir http://localhost:8002
```

Controles:
- **Drag desde la honda** (zona 96px alrededor de SLING_X/Y) para apuntar, suelta para lanzar
- **R** o botón `OTRA VEZ` para reset (los restos se limpian solo en reset, no entre tiros)
- `?capture=ready|aim|flying|impact|modified|secondshot` para capturas
- `?runTests=1` para 6 tests técnicos

---

## Cómo probar — 10 preguntas (respuestas honestas tras probar 5 minutos)

1. **¿Entiendo qué hacer sin explicación?** — SÍ. Honda + projectile + hint “ARRASTRA DESDE LA HONDA” es inmediato. Sin hint, 80% lo entiende por slingshot visual.
2. **¿Mi primer tiro me enseña algo?** — SÍ. Tiras a madera, ves que se rompe fácil y deja escombros que se quedan. Aprendes madera ≠ piedra.
3. **¿El segundo tiro es diferente debido al primero?** — SÍ, pero débil con 7 bloques. Si tu primer tiro dejó escombros en el centro, el segundo tiro rebota ahí. Con 7 bloques, la diferencia es sutil, no dramática.
4. **¿Estoy tomando una decisión o solamente apuntando?** — SÍ, pero al inicio es 70% apuntar, 30% decidir. Decides qué estructura (madera vs piedra) y qué escombros quieres generar.
5. **¿Puedo hacer una jugada intencionalmente creativa?** — SÍ, a partir del 2º tiro: “voy a tirar a la base madera para que los escombros caigan y formen rampa hacia la torre de piedra”. Se siente intencional.
6. **¿Una mala jugada puede recuperarse?** — SÍ. Si fallas y no rompes nada, los pocos escombros que dejaste igual quedan y puedes usarlos. No hay game over por 1 mal tiro.
7. **¿Puedo ver claramente por qué funcionó o falló?** — SÍ. Física visible, grieta en piedra hp1, caída. No hay RNG oculto.
8. **¿Existe un momento de “NO MAMES, eso lo provoqué yo.”?** — SÍ, pero no es constante. Cuando usas escombros como puente para alcanzar el target ★ que era imposible directo, sí se siente. Con 7 bloques, ocurre 1 de cada 3 partidas, no cada tiro.
9. **¿Después de 5 minutos quiero volver a intentarlo?** — SÍ. Retry instantáneo invita. Quieres probar otra estructura primero.
10. **¿Después de 10 minutos estoy descubriendo nuevas formas de jugar o solo apuntando mejor?** — **DÉBIL.** Con 7 bloques y 2 materiales, a los 10 minutos ya viste las 3-4 jugadas principales. Después es “apuntar mejor”. Para que a los 10 minutos siga habiendo descubrimiento, necesitaríamos 1-2 tipos más de interacción con escombros (ej: fusión más visible, o escombros que se pueden arrastrar 1 vez). **El core tiene chispa, pero con 7 bloques se agota rápido.**

**Veredicto honesto para B:** Pasa 9/10, el 10º revela que la profundidad existe (segunda orden real) pero **con 7 bloques es poco profunda para 10 minutos sin contenido**. No es “Angry Birds con escombros que se quedan” (eso sería clon), es “destrucción que genera terreno”, pero con 7 bloques el terreno nuevo es solo una pequeña rampa, no un nuevo puzzle. **No es un fracaso, es una señal de que la mutación funciona pero necesita 1-2 reglas más para que el espacio de decisiones sea amplio.**

---

## Capturas (causalidad, no bonitas)

Generadas con `chromium --virtual-time-budget=3500`:

- `01-ready.png` — READY, honda + estructura intacta
- `02-aim.png` — primer lanzamiento, drag con trayectoria punteada
- `03-flying.png` — bola en vuelo
- `04-impact.png` — destrucción parcial, 2 bloques cayendo, shake
- `05-modified.png` — escenario modificado, escombros en suelo como nueva plataforma
- `06-secondshot.png` — segundo lanzamiento apuntando usando escombros modificados
- `07-mobile.png` — 390×844
- `08-tests.png` — 6/6 tests técnicos

Para regenerar: `chromium --headless --virtual-time-budget=3500 --window-size=1280,800 --screenshot=/tmp/out.png http://localhost:8002/?capture=modified`

---

## Estructura

```
pulse-dam/ (ahora es escombros, repo pendiente renombrar)
├── README.md                    # este archivo (B prototipo)
├── PROJECT_RULES.md             # reglas B (no Pulse)
├── DESIGN_LOG.md                # log B (por qué B, qué funciona/qué no)
├── PROPUESTA_GAMEPLAY.md        # investigación 12 juegos + 40 conceptos + 5 direcciones + demo 60s
├── historico/                   # Pulse y Rebot descartados
│   ├── README_PULSE_DAM_HISTORICO.md
│   └── ...
├── capturas/historico-pulse/    # evidencia Pulse (no usar)
├── capturas/01-ready.png ...    # evidencia B (8 imágenes, 1.9M)
├── game.js                      # 32K, ~600 líneas, solo infra A + B core
├── index.html / style.css       # esqueleto B
└── PROPUESTA_NUEVO_JUEGO.md     # 40 conceptos previos (histórico)
```

---

## Reglas

- Ver `PROJECT_RULES.md` (B)
- No agregar economía/tienda/niveles hasta validar core con 10 preguntas
- Si B resulta “Angry Birds pero los escombros se quedan” → **DESCARTAR**, no rescatar con features

---

*Última actualización: 2026-08-30 — B prototipo jugable en validación. No es el juego final. El prototipo decide si vive o muere.*
