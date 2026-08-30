# REBOTE PERSISTENTE — Nuevo juego (Pulse Dam descartado)

> **Pulse Dam está DESCARTADO como juego activo.** Este repo conserva Pulse Dam como histórico en `README_PULSE_DAM_HISTORICO.md` / `capturas/historico-pulse/`. El juego activo ahora es **REBOTE PERSISTENTE**.

> **1 bola, drag para ángulo+fuerza, rebota, rompe totens, SE QUEDA donde cae.** Cada tiro cambia el siguiente.

---

## Qué es

Juego mobile-first de **1 acción (drag y suelta) + sistema muy expresivo**.

Base probada: **8 Ball Pool** (1B+ descargas, apuntar+fuerza+rebote+siguiente jugada)  
Mutación fuerte: **posición persistente** — la bola no resetea al centro, queda donde se detuvo. Totens con hp/material obligan a elegir rebote.

No es Pool (vertical, totens), no es Angry Birds (sin resortera), no es Peggle (sin clavijas). Es *el pool que deja la bola donde cae*.

---

## Core Loop

```
VER totens + dónde quedó bola
↓
ELEGIR qué totens atacar (madera hp1 vs piedra hp2)
↓
APUNTAR con drag (línea punteada 2 rebotes) + ELEGIR fuerza
↓
SOLTAR → bola vuela → rebota en paredes → golpea
↓
TOTENS caen si hp0 → bola se detiene y SE QUEDA
↓
NUEVO ESCENARIO (bola en nueva posición, totens restantes)
↓
REPETIR (siguiente tiro desde ahí)
```

Segunda orden: `tiro → resultado → nuevo escenario → nueva decisión`

---

## Qué estamos intentando conseguir

> **Que el jugador diga “sé cómo funciona” en 5s, “oh, pero puedo hacer esto” a los 30s, y “espera, si hago esto primero, puedo hacer aquello” a los 60s.**

Un input tonto, decenas de decisiones: ángulo, fuerza, rebote, objetivo, material, dónde deja la bola, si sacrifica toten fácil para preparar combo.

---

## Estado actual

```
BASE PROBADA: 8 Ball Pool
MUTACIÓN: Posición persistente + totens hp/material
STATUS: READY FOR PROTOTYPE (no hay código nuevo aún)
```

- Infraestructura reutilizable lista: Canvas setup, resize/DPR, pointer events, loop, audio, partículas, shake, harness (ver `PROPUESTA_NUEVO_JUEGO.md` §A)
- Gameplay Pulse Dam eliminado (dam/gate/pressure borrado conceptualmente, código aún en `game.js` histórico — se refactorizará al prototipar)
- Informe completo: `PROPUESTA_NUEVO_JUEGO.md` (40 conceptos → TOP 15 → 7 → 3 → ganador con tests 5s/30s/60s/10/100)
- Histórico archivado: `README_PULSE_DAM_HISTORICO.md`, `PROJECT_RULES_PULSE_DAM_HISTORICO.md`, `capturas/historico-pulse/`

**No agregar tienda, monedas, niveles, skins hasta validar core con 5 testers.**

---

## Cómo ejecutar (cuando haya prototipo)

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Controles (MVP): drag desde bola para ángulo+fuerza, suelta. Siguiente bola aparece donde quedó la anterior. `R` retry.

Parámetros futuros: `?capture=...` y `?runTests=1` reutilizando harness existente.

---

## Cómo probar (cuando haya MVP)

**6 preguntas + 3 cualitativas:**

1. ¿entiende en 5s? 2. ¿se tensa entre seguro vs arriesgado? 3. ¿se arriesga a doble rebote? 4. ¿sorprende rebote? 5. ¿quiere volver tras esquina mala? 6. ¿piensa “dónde dejo bola”?

Cualitativo:
- 1ª muerte ¿vuelve solo?
- 3ª ¿experimenta con fuerza?
- 5ª ¿mejora decisión de posición?

Si 3 de 5 dicen sí → tenemos juego.

---

## Estructura

```
pulse-dam/ (repo renombrado pendiente → rebote-persistente)
├── README.md                           # este archivo (nuevo juego)
├── PROJECT_RULES.md                    # reglas canónicas nuevo juego
├── DESIGN_LOG.md                       # por qué Rebot Persistente, por qué no otros 39
├── PROPUESTA_NUEVO_JUEGO.md            # informe 40 conceptos + filtros + TOP
├── README_PULSE_DAM_HISTORICO.md       # histórico descartado
├── PROJECT_RULES_PULSE_DAM_HISTORICO.md
├── DESIGN_LOG_PULSE_DAM_HISTORICO.md
├── capturas/historico-pulse/           # evidencia Pulse Dam (no usar)
├── capturas/                           # vacía, para nuevo juego
├── game.js                             # histórico Pulse Dam (se refactorizará, solo infra A reutilizable)
├── index.html / style.css              # esqueleto reutilizable
└── RESET_TOTAL.md / INFORME_SHIELD_SURGE.md # históricos
```

---

## Reglas

- Ver `PROJECT_RULES.md` nuevo (no el histórico)
- Ver `PROPUESTA_NUEVO_JUEGO.md` para el porqué del ganador
- No programar metajuego/economía/tienda hasta validar core

---

*Última actualización: 2026-08-30 — Pulse Dam descartado, RebotPersistente READY FOR PROTOTYPE*
