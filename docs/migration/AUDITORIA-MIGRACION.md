# AUDITORÍA DE MIGRACIÓN A UNITY 6 — FASES 0–2 (FASE 0: capacidades · FASE 1: ver BEHAVIOR-MAP.md · FASE 2: decisión)

> Estado del análisis: **decisión preliminar fundamentada en evidencia**.
> No se ha tocado el juego, la estructura del repositorio ni Git.
> Fase 1 (mapa de comportamiento): `docs/migration/BEHAVIOR-MAP.md`.
> Auditor independiente previsto: Qwen (este documento está preparado para
> ser revisado por Qwen sin contexto previo).

## 1. Estado real del repositorio (verificado)

- HEAD `7db1129` "ACTUALIZACION GRANDE"; rama `main`; árbol de trabajo LIMPIO
  (sin cambios pendientes); remoto `origin` GitHub (`block-fire`).
- Superficie real de código propio: **4,278 LOC** en 12 archivos JS/CSS/HTML
  (Game 916, WeaponSystem 590, Bot 482, Input 432, main 353, Map 302,
  PlayerController 280, AudioManager 208, HUD 135, Settings 108, index 211,
  style 264) + three.module.js vendido (53K LOC, read-only).
- Assets: 19 .ogg (disparos CC-BY + sintetizados propios), 4 texturas CC0,
  7 capturas de evidencia. Sin package.json, sin build, sin dependencias npm.
- Tests: 18/18 PASS (suite propia en `?runTests=1`, corren headless).
- HIGIENE: el remote de Git contiene un **token de GitHub embebido en la URL**
  (`.git/config`, no trackeado en archivos). RIESGO de seguridad: rotarlo y
  usar credential helper o SSH. Requiere intervención del propietario en
  GitHub (no lo hice: rotar credenciales es una acción de cuenta).

## 2. Herramientas verificadas en el entorno real (FASE 0)

Medido con comandos reales el día de la auditoría. Nada asumido.

| Herramienta | Estado | Evidencia |
|---|---|---|
| Unity Editor | **NO instalado** | sin binarios ni rutas (~, /opt, ~/.local) |
| Unity Hub | **NO instalado** | ídem |
| Android SDK / NDK | **NO instalados** | sin rutas ni sdkmanager/aapt2 |
| OpenJDK / Java | **NO instalado** (`java: orden no encontrada`) | requisito de Unity Android (JDK 17) y de bubblewrap |
| dotnet / mono (C#) | NO instalados | sin toolchain C# fuera de Unity |
| Unity MCP (oficial `com.unity.mcp`) | **NO disponible** | 404 en docs de paquete; no existe paquete oficial con ese nombre |
| MCP for Unity (CoplayDev, comunidad) | Existe (MIT, v10, 13.8k★) pero **NO configurado**: no hay `.mcp.json` ni servidores MCP en `opencode.jsonc`, y requeriría Unity Editor corriendo | verificado en config real y GitHub |
| Unity AI Assistant / Agent Mode | **No disponible/No verificado** — viven DENTRO del Editor GUI y con licencia Unity; no sirven a un modelo vía API desde OpenCode | docs oficiales no accesibles en este entorno; clasificado NO VERIFICADO |
| bubblewrap (ruta TWA) | NO instalado | instalable con npm + JDK (trivial comparado con Unity) |
| Node/npm, Python3 | instalados | ✔ |
| Chromium headless (tests/capturas) | funciona | usado en todas las sesiones |
| Gemini Vision (bridge propio) | funciona (con límites de cuota) | `tools/gemini-vision.py` + `.env` (gitignored) |
| Git/GitHub | funciona | remoto configurado (con el problema del token arriba) |
| Internet | parcial: github.com ✔, docs.unity3d.com ✔ (301), unity.com **timeout** | descarga multi-GB del Editor/Hub: factibilidad incierta |

### Hardware de la máquina (medido, no estimado)

| Recurso | Valor | Requisito oficial Unity 6 (Linux Editor) |
|---|---|---|
| CPU | 4 núcleos, ~3 GHz (Intel gen-6, laptop ~2015-16) | sin mínimo duro declarado; builds Android son lentas aquí |
| RAM | **7.6 GB total, ~2.5–3 GB libres en sesión típica** | **8 GB recomendados como MÍNIMO solo para abrir el Editor** (docs oficiales), antes de importar proyecto y toolchain Android |
| GPU | Intel HD 520 (iGPU) | Linux Editor soporta oficialmente **"Nvidia propietario o AMD Mesa"** — Intel iGPU queda FUERA del soporte declarado |
| SO | Linux Mint 22.3 (Cinnamon) | soporte oficial: **solo Ubuntu 22.04/24.04 con Gnome** |
| Disco | 417 GB libres | sobra (Editor+Android ≈ 10–15 GB) |

Conclusión de hardware: **esta máquina está por debajo del sobre de soporte
oficial de Unity 6 en Linux por tres vías simultáneas** (distro/DE, driver
GPU, RAM en el suelo del mínimo). No es "no arrancará seguro", es "fuera de
garantía oficial y con margen de memoria negativo en sesiones reales".

## 3. Ecosistema Unity 6 para trabajo asistido por IA (FASE 0, verificado)

| Capacidad | Clasificación | Nota |
|---|---|---|
| Editor Linux + builds Android desde CLI (`-batchmode -executeMethod`, Unity Test Framework) | **Verificada por docs** | sí automatizable desde OpenCode UNA VEZ instalado y licenciado |
| Creación de escenas/prefabs por scripts de Editor ejecutados en batchmode | **Verificada por docs** | viable sin GUI, ciclo lento (minutos) |
| Assets Unity (escenas/prefabs) como YAML legible | **Verificada** | inspeccionable por GLM; `Library/` es máquina-generada (gitignore) |
| MCP for Unity (comunidad) controlando Editor vivo | **Parcialmente verificada** (proyecto sano y activo) pero **NO disponible aquí**: requiere Editor corriendo + paquete + cliente MCP configurado en OpenCode (hoy no existe) | no basar estrategia en ello |
| Unity AI Assistant / Agent Mode oficiales | **No disponible para este flujo** | dentro del Editor GUI, no accesible por API de GLM |
| Licencia | **Intervención humana obligatoria**: cuenta Unity + login en Hub (GUI) para licencia Personal | no automatizable desde OpenCode |
| Descarga/instalación Hub+Editor+Android (~10–15 GB) | **Intervención humana probable** (GUI de Hub; factibilidad de red incierta: unity.com dio timeout) | disk OK (417 GB), RAM no |

## 4. Auditoría arquitectónica del stack actual (FASE 1, preguntas A–O)

**A. Qué está bien:** dependencias explícitas por constructor (WeaponSystem
recibe `(scene, camera, audio, vfx, applyDamage)` — inyección de función de
daño, no del objeto Game); Input/Settings/Map/HUD/Audio sin acoplamiento a
Game; contrato espacial único (Map.boxes alimenta movimiento, balas y visión);
una sola ruta de daño/respawn; 18 tests; documentación viva (README + RULES).

**B. Qué empieza a acoplarse:** `Game.js` (916 LOC) concentra composición +
estado de partida + daño + VFX + pausa. Es un *composition root* cargado de
responsabilidades, pero con contratos claros hacia afuera. Riesgo de God
Object futuro, no presente.

**C. Dependencia de Game:** main.js (bootstrap, 120 refs esperadas) y los
sistemas reciben dependencias puntuales en el constructor; **cero** `this.game`
en WeaponSystem/Bot/PlayerController/HUD/Audio/Input (medido con grep). El
acoplamiento al objeto Game es menor del que parece: es ensamblaje, no red.

**D. Infraestructura que Unity daría "gratis":** CharacterController/físicas,
NavMesh, animación por clips, mezclador de audio, partículas, post-proceso
URP, empaquetado APK/AAB nativo, test framework NUnit, editor de escenas.

**E. Ventajas reales de Three.js hoy:** cero instalación/ejecución (navegador),
iteración en milisegundos (refresh), distribución instantánea (URL estática),
tests headless reales, control total del input (multitouch con ownership
per-pointer ya resuelto y probado), 4.3K LOC legibles por una IA al completo.

**F. Límites de Three.js que YA dueñen o dolerán:** sin NavMesh (bots por
steering — suficiente hoy), sin animación por clips (procedural — suficiente
para blocky), sin post-procesado barato en móvil, APK solo vía TWA (contenedor
de Chrome), sin consolas/PC-store nativo, sin ragdolls/física avanzada
(añadirlos a mano sería caro).

**G. Problemas que desaparecerían con Unity:** empaquetado Android nativo
(IL2CPP/Vulkan), herramientas visuales de escena, audio mezclado, partículas,
test framework NUnit, ecosistema de assets.

**H. Problemas NUEVOS que introduciría Unity:** (1) máquina por debajo del
soporte oficial (distro/GPU/RAM) — riesgo de que el Editor ni siquiera opere
fiable aquí; (2) licencia + instalación = intervención humana bloqueante;
(3) ciclo de verificación pasa de milisegundos (browser) a minutos (batchmode)
→ cada cambio de feel se verifica 100–1000× más lento; (4) reescritura del
game feel recién pulido durante varias sesiones (riesgo máximo sobre la
prioridad #1: estabilidad); (5) multitouch sutil (ownership por pointerId,
drag-fuego, ADS toggle, editor de HUD) re-implementado y re-validado desde
cero en Unity Input System, solo verificable en Android físico; (6) los 18
tests se reescriben (los de DOM/HUD no traducen 1:1); (7) distribución:
URL instantánea → APK/sideloading/Play Store (cuenta de desarrollador $25,
revisión); (8) a Unity WebGL móvil (para conservar el canal web) la propia
documentación de Unity señala límites de memoria en navegadores móviles —
se perdería el canal web actual tal como es.

**I. Fácil de migrar:** datos de armas/daño/tiempos (tablas), mapa (geometría
→ prefabs/ScriptableObjects), audio (assets), HUD lógico, reglas de partida.

**J. Costoso:** Input móvil completo (el sistema más fino del proyecto),
PlayerController con su feel (curvas, aceleraciones, FOV kick, crouch blend),
trazadoras/impactos con presupuesto por frame, suite de pruebas, distribuir
de nuevo lo ya distribuido.

**K. NO migrar todavía:** HUD editor, skins de bots como prefabs múltiples,
economía/tienda (fuera de alcance por regla 21), multijugador, backend.

**L. GLM puede hacer desde OpenCode (si Unity existiera):** escribir C#,
generar scripts de Editor que construyan escenas/prefabs, correr tests y
builds batchmode, leer logs, versionar YAML. — **todo post-instalación**.

**M. Requiere Unity Editor (GUI o batchmode):** compilar, importar assets,
abrir/validar escenas, generar GUIDs/.meta coherentes, construir APK.

**N. Requiere intervención humana (hoy, en este entorno):** instalar Hub,
instalar Editor+Android module (~10–15 GB), crear cuenta/licencia (GUI),
posible actualización de RAM (8→16 GB) para operar fiable; y en cualquier
ruta: pruebas táctiles en Android físico.

**O. Requiere Android real:** validación de feel (joystick, drag-fuego, ADS
toggle), rendimiento (FPS/frame time/temperatura), landscape lock, latencia —
tanto para la versión web actual como para cualquier Unity.

## 5. Comparación con evidencia (FASE 2)

| Criterio (§19) | Three.js/WebGL actual | Unity 6 en ESTE entorno |
|---|---|---|
| Mantener gameplay | ✔ ya validado (18 tests + sesiones de pulido) | riesgo alto: reescritura del feel recién pulido |
| Mantener rendimiento | ✔ presupuesto activo (DPR+downscale); Android real pendiente | probable ✔ nativo, PERO no medible fiable en esta máquina (fuera de soporte) |
| Mejorar capacidad visual | posible con esfuerzo (shader material ya en uso) | ✔ real (URP/post/partículas) — pero es prioridad 5/6 |
| Facilitar Android | TWA ya documentado: APK ~2 MB sin reescribir nada | ✔ nativo, a costa de J+H (instalación/licencia/hardware) |
| Creación de contenido | editar JS/constants (aceptable) | ✔ prefabs/datos — ventaja real a medio plazo |
| Mantenimiento | 12 archivos, contratos claros | reescritura completa primero |
| Trabajo autónomo de GLM | ✔ total (todo es texto+browser) | parcial: bloqueado por instalación/licencia/GUI; batchmode lento |
| Funcionar desde OpenCode Desktop | ✔ hoy | ✖ hoy (nada instalado; máquina fuera de soporte oficial) |
| Reducir acoplamiento | acoplamiento ya bajo (medido §4.A-C) | no aporta vs. refactor local |
| Armas/modos futuros sin rehacer | ✔ (datos+contratos ya lo permiten) | ✔ |
| Proyecto entendible | ✔ 4.3K LOC completos para una IA | selva inicial: Library/YAML/GUI-state |
| Menos trabajo manual del usuario | ✔ (cero instalado) | ✖ primero: instalación+licencia+RAM+pruebas físicas |
| Verificación reproducible | ✔ 18 tests headless ahora | ✔ NUnit después de reconstruir la suite |
| Recuperación vía Git | ✔ trivial | ✔ (proyecto paralelo) |

## 6. DECISIÓN (preliminar, sujeta a auditoría de Qwen)

### ✋ DETENER MIGRACIÓN A UNITY 6 — NO CONTINUAR (por ahora)

Razones, cada una con evidencia verificada:

1. **La máquina está fuera del sobre de soporte oficial de Unity 6 Linux**
   (Mint≠Ubuntu, Cinnamon≠Gnome, Intel iGPU no listada, RAM bajo el mínimo
   declarado). Afirmar que Unity "funcionará" sería inventar un resultado.
2. **El flujo de trabajo real (OpenCode + GLM por API) pierde más de lo que
   gana**: hoy GLM opera el proyecto COMPLETO (código, tests, capturas,
   métricas, visión). Con Unity, GLM quedaría bloqueado por instalación,
   licencia GUI y ciclo batchmode lento, y el usuario pasaría de 0 tareas
   manuales a 4–6 obligatorias — lo contrario del objetivo declarado.
3. **El objetivo Android (única carencia dura del stack actual) tiene una
   ruta ~100× más barata ya documentada**: PWA → TWA con bubblewrap
   (APK ~2 MB contenedor de Chrome, landscape forzado, actualizaciones sin
   rebuild). Requiere JDK 17 + bubblewrap (instalación trivial aprobable)
   y pruebas en Android físico — no una reescritura.
4. **La prioridad #1 es estabilidad y el producto acaba de alcanzar su mejor
   estado** (feel pulido, multitouch fino, audio arreglado, 18/18 tests).
   Migrar ahora es apostar las prioridades 1–3 por las 5–6 sin necesidad
   demostrada.
5. **La arquitectura actual no está podrida** (medición §4.A-C): migrar
   "por arquitectura" no está justificado; si Game.js crece, se refactoriza
   dentro del stack (más barato que una reescritura).

### Condiciones que REABRIRÍAN la decisión (disparadores objetivos)

- Requisito de producto aprobado que el stack no pueda cumplir: distribución
  en Play Store con contenido pesado / consolas / ragdolls / NavMesh real /
  físico avanzado / post-procesado intensivo en Android.
- Hardware apto (≥16 GB RAM, GPU con driver soportado) y voluntad de
  instalación + licencia por parte del propietario.
- Presupuesto para reescribir y RE-VALIDAR el feel en Android físico sin
  congelar el producto web (que seguiría siendo la referencia).

### Plan si el propietario decide ignorar la recomendación

Fases 3–7 del plan original siguen siendo el camino correcto (proyecto Unity
paralelo en `unity/`, prueba de migración con los 6 bloques del §9, Qwen
auditor antes de declarar nada). El repo web queda intacto y es la
referencia de paridad (BEHAVIOR-MAP.md es el contrato de equivalencia).

## 7. Intervenciones humanas pendientes (independientes de la decisión)

1. **Rotar el token de GitHub** embebido en la URL del remote (seguridad) y
   migrar a credential helper o SSH. — Propietario, ahora.
2. Probar el juego en **un Android físico** (pendiente desde siempre, aplica
   al stack actual): controles, rendimiento, landscape, audio.
3. Si se aprueba la ruta TWA: aprobar la instalación de `openjdk-17-jdk` +
   `@bubblewrap/cli` (npm) y un hosting HTTPS. GLM puede automatizar el resto.

## 8. Qué queda en el repo tras esta fase (sin tocar código)

- `docs/migration/BEHAVIOR-MAP.md` — contrato de comportamiento a preservar.
- `docs/migration/AUDITORIA-MIGRACION.md` — este documento (fases 0–2).
- El juego, los tests y Git: INTACTOS. Sin commits automáticos.
