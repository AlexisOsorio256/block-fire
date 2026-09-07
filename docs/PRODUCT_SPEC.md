# BLOCKFIRE — especificación de producto

## Promesa

Una partida arcade inmediata: el jugador entra, entiende el espacio en
segundos, se mueve con precisión, dispara con feedback claro y vuelve a
intentar sin fricción.

## Plataforma y dirección

Godot 4.7.2 Standard, GDScript, renderer Mobile y Android landscape-first.
La estética es estilizada, colorida y legible a distancia. Los operadores se
distinguen por silueta y paleta; las armas tienen silueta, manejo, sonido y
cadencia propios. La geometría primitiva solo es fallback técnico.

## Modos y reglas

- **Escuadras:** dos equipos 4v4, fase de compra, sin respawn durante la
  ronda, primero a cuatro rondas y sin empate.
- **FFA:** ocho combatientes, respawn y primero en alcanzar 20 kills.
- **Jugador:** 200 HP, fuego amigo desactivado y feedback de impacto, muerte
  y score.
- **Arsenal:** rifle, pistola, escopeta y SMG; compra y skins son locales,
  ficticias y cosméticas.
- **Bots:** roles, percepción, línea de visión, navegación nativa y
  dificultad ajustable por parámetros.

## Experiencia y controles

El flujo es lobby → compra → combate → muerte o victoria → espectador cuando
corresponda → resultado → retry. En PC se usa teclado y ratón. En táctil hay
joystick, mirada independiente, fuego arrastrable, ADS por toque,
multitouch, salto, recarga, cambio, sprint y agacharse.

La asistencia móvil es deliberadamente fuerte para compensar la pantalla
pequeña, pero se limita a candidatos visibles dentro de un cono y distancia:
no autofire, no wallhack y no snap violento. El editor guarda posiciones
normalizadas, escala y opacidad; perder foco, visibilidad u orientación libera
todos los pointers.

## No objetivos

No hay backend, cuentas, economía real, multijugador online, anuncios,
ranking, chat, clanes, vehículos, campaña, loot ni matchmaking.

## Legal

No se incorporan assets sin licencia y atribución. Las atribuciones vigentes
están en `CREDITS.md`; la atribución de audio se puede consultar en el lobby
y en Ajustes → Legal.
