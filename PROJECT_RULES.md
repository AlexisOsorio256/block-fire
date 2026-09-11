# PROJECT RULES — BLOCKFIRE

Reglas estables del producto. Léelas solo cuando la tarea necesite una decisión
de producto/arquitectura. Código y pruebas mandan sobre documentación obsoleta;
atribuciones viven en `CREDITS.md`.

## Quién mantiene esto

BLOCKFIRE lo mantienen y lo escriben modelos de IA, guiados por una persona en
las decisiones de producto. Eso decide cómo se escribe el código, no es una
excusa para bajarlo de calidad.

**La comprensión por parte de un modelo es un requisito de diseño, igual que
los fps o el gamefeel.** Un archivo que un modelo no puede leer entero, un
estado que vive en dos sitios, o un símbolo muerto que parece vivo cuestan
trabajo real en cada tarea futura: son deuda, no estilo. La calidad del juego no
se negocia para conseguirlo: si algo hay que reescribir, se reescribe **mejor**,
no más pequeño ni más listo.

Cómo se paga esto en concreto:

- **Un archivo, un ciclo de vida.** Si dos cosas no cambian a la misma cadencia
  (una vez por proceso, una vez por actor, una vez por fotograma), no van en el
  mismo archivo. Un archivo de mil líneas que mezcla tres cadencias es ilegible
  aunque cada función sea correcta.
- **Frontera declarada en la cabecera.** Cada archivo dice en su comentario de
  clase qué posee, qué NO posee y quién manda sobre qué, con el orden del frame
  si participa en él.
- **Cero símbolos muertos.** Nada de código comentado, funciones sin llamadas ni
  metadata huérfana: se borran en el mismo commit que los deja sin uso. Lo que
  no se puede borrar sin riesgo se prueba (`tools/audit-repo.mjs`).
- **Lo que se mueve se prueba idéntico.** Mover código entre archivos sólo vale
  si el resultado es el mismo número, no "parecido": ver el oráculo y las
  capturas en `docs/ARCHITECTURE.md`.

## Producto

TPS arcade estilizado para Android landscape. Prioridad:
**estabilidad → gameplay → rendimiento → UX → inmersión → features**.
Presentación canónica: tercera persona sobre el hombro. Runtime canónico: Godot
4.7.2 Standard + GDScript + renderer Mobile. No reintroducir Unity, runtime web,
PWA, WebView/Capacitor ni brazos/FPS antiguos.

Modos: Duelo de Escuadras 4v4 por rondas y FFA de 8. Jugador: 200 HP. Skins
locales/cosméticas y moneda ficticia. Sin backend, cuentas, economía real,
multijugador online, anuncios, ranking, chat, clanes, vehículos, campaña, loot o
matchmaking.

## Invariantes de ingeniería

- Un dueño y una fuente de verdad por input, daño, muerte/respawn, HUD, audio,
  colisión, VFX, navegación y assets. Evita managers/autoloads nuevos; hoy
  `SettingsStore` es el único autoload.
- Disparo: intención → cadencia/munición → trayectoria/oclusión → daño → feedback
  → muerte/score/respawn. Jugador y bots comparten las reglas de combate.
- Aim assist móvil: cono visible + línea de visión; nunca autofuego, wallhack ni
  teletransporte de mira. Fuego amigo desactivado.
- Animación no decide desplazamiento ni gameplay. Procesos iniciados por una
  tarea deben cerrarse al terminar.
- No añadir assets sin licencia/provenance; `CREDITS.md` es la autoridad legal.
- Haz el cambio causal mínimo que cierre el problema; no reorganices código sano
  por estética mientras exista un defecto de mayor impacto.

## Evidencia y Git

La prueba depende del cambio, no de un ritual global. Ejecuta la evidencia más
barata que demuestre el comportamiento tocado; usa Android físico cuando la
conclusión dependa del dispositivo/plataforma. No declares una prueba que no se
ejecutó: usa `SIN VERIFICAR` o `INFERENCIA` cuando corresponda.

Los cambios deben ser enfocados y revisables. Commit + push están autorizados al
cerrar trabajo verificado; no se pide permiso adicional.
