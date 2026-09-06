# BLOCKFIRE — especificación de producto

## Promesa

Una partida arcade inmediata: el jugador entra, entiende el espacio en
segundos, se mueve con precisión, dispara con feedback claro y vuelve a
intentar sin fricción.

## Dirección

- Estética estilizada y colorida con contraste de lectura a distancia.
- Operadores reconocibles por silueta y paleta; equipo visible en visor y banda.
- Armas con silueta, manejo, sonido y cadencia propios.
- La geometría primitiva existe solo como fallback técnico.

## Experiencia

El flujo principal es lobby → compra → combate → muerte o victoria →
espectador cuando corresponda → fin de ronda/partida → retry. La pantalla es
horizontal siempre. La fase de compra usa monedas ficticias; las skins son
cosméticas y locales.

## Controles

PC usa teclado y ratón. Táctil usa joystick, mirada independiente, fuego
arrastrable, ADS por toque, multitouch, salto, recarga, cambio, sprint y
agacharse. La configuración permite editar posiciones normalizadas, tamaño y
opacidad. Perder foco, visibilidad, orientación o captura debe liberar todos
los estados.

## Plataforma

El runtime Three.js/WebGL es único. La entrega Android se empaqueta con
Capacitor y la actividad fija landscape. DPR dinámico, safe areas, peso de
assets y superficies CSS se evalúan con criterio de WebView móvil. Android
físico es la verificación de plataforma; el navegador responsive es
laboratorio.

## No objetivos

No hay backend, cuentas, economía real, multijugador online, anuncios,
ranking, chat, clanes, vehículos, campaña, loot ni matchmaking.

## Legal

No se incorporan assets nuevos sin licencia y atribución. Las atribuciones
vigentes están en CREDITS.md y la autoría de los disparos se muestra en el
lobby.
