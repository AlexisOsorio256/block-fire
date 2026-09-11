# Plan quirúrgico: DeepSeek V4.1 Flash + BLOCKFIRE

Fecha: 2026-09-11. Modelo elegido por el usuario: DeepSeek V4.1 Flash en max.
La cuota a cuidar es su ventana de Codex Plus; no es un presupuesto de
80 llamadas de DeepSeek. No se presupone equivalencia entre mensajes, llamadas,
tokens o consumo de las dos cuentas.

## Diagnóstico basado en este repositorio

El harness ya dispone de las herramientas esenciales. La ganancia inmediata
viene de decisiones mejor guiadas y evidencia verificable. No hay evidencia
para prometer que una capa de herramientas iguale dos modelos distintos.

| Lo usado en la corrección 51b643e | Equivalente existente en BUILD |
|---|---|
| Shell, rg, lectura, edición y git | bash, grep/glob, read, edit/write |
| Procesos largos y resultados | bash + job_output/job_list/job_kill |
| Ver capturas locales | read_image, con ruta del modelo compatible |
| Evaluar animación real y comparar fases | tools/bf qa motion + PNG + montage/ffmpeg |
| Verificar contratos de movimiento | tools/bf test, qa slide/ik |
| Editar fuente de clips si hace falta | bf_capability → blender_exec/blender_screenshot |
| Cargar conocimiento específico | skill y directorios de skills de BUILD |
| Medir coste de la trayectoria | bin/session-report.mjs |

En 51b643e se usaron capturas del laboratorio Godot, no control interactivo de
una partida. No se editó Blender: los defectos eran del runtime. El laboratorio
inyecta movimiento manual; hubo que inspeccionar aparte el camino público para
encontrar `sprinting = sprinting`. Esta distinción se incorpora a la skill.

Auditoría local inicial: runtime activo 0.1.5-alpha.2; 18 tools base y 16,247
caracteres de schema en montaje real. Blender mínimo añade dos tools y 891
caracteres. El contrato cita también rc.1: eso no demuestra qué versión está
activa. No hace falta actualizar DSH para esta transferencia.

`install.sh --check` encontró ausente `.agent-presets/shared`; faltaba sincronizar
las skills compartidas. Se corrige con el instalador dueño, sin parchear DSH.

Una sesión CREATOR histórica reportó 240 solicitudes, 10 mensajes de usuario y
99.3% de cache hit. No es una evaluación de V4.1 Flash ni prueba de despilfarro;
sí muestra que cache alto y prompt pequeño no bastan para medir eficiencia.

## Entrega inmediata e inyección

1. Ampliar la skill existente `blockfire-animation-craft` con el árbol de
   decisión gameplay → mezcla → montaje/IK → clip. Añadir receta de captura y
   fases en una referencia que se carga solo para locomoción.
2. Sincronizar mediante `harness/install.sh` y comprobar `harness/test.sh`.
3. Empezar una sesión BUILD nueva para usar la composición instalada. Pedir
   explícitamente la skill durante la primera evaluación para separar calidad
   de ejecución de calidad de descubrimiento automático.

La metadata de la skill está disponible para descubrimiento; su cuerpo y la
referencia se leen bajo demanda mediante `skill`. Esto no es un inyector nuevo
ni garantiza que el modelo siempre la seleccione. Después se prueba un prompt
natural, sin nombrarla. Solo si falla ese descubrimiento se justifica una frase
de enrutamiento en la persona. El plan completo no se mete en cada petición.

## Primer uso con DeepSeek: demostrar visión y ejecución

DeepSeek anuncia V4.1 Flash con visión nativa y el identificador `deepseek-flash`
en su API oficial. Eso no certifica el alias/configuración de otro proveedor ni
la admisión de imágenes en una sesión instalada. Fuente consultada:
[anuncio de V4.1 Flash](https://deepseek.com/en/news/deepseek-v4-1-flash/).

En una sesión real del usuario, abrir una captura con `read_image` y pedir una
observación visual concreta sin sugerir la respuesta. Verificar imagen recibida,
sin placeholder ni error de modalidad. Repetir con Blender cuando se edite un
clip. Si falla, corregir catálogo/adaptador en su dueño antes de aumentar prompt.
No falsear `inputModalities` ni ocultar un fallo de imagen tras una descripción.
Esta entrega no realiza llamadas al proveedor ni certifica la ruta DeepSeek.

Prompt inicial utilizable:

> Usa blockfire-animation-craft. Continúa desde main actual. Reproduce y mira
> la inversión izquierda/derecha y diagonal a 4.8 m/s con rifle. Identifica un
> defecto visible y su dueño antes de editar. Corrige solo la causa de mayor
> impacto; conserva gameplay, velocidades, foot-lock y CRAFT_LOCKED. Compara
> fases antes/después y prueba también el camino público si el fallo depende
> del jugador. No construyas infraestructura. Si dos intentos no aportan
> evidencia nueva, entrega archivos, hipótesis y capturas para revisión.

## Repartir trabajo sin agotar Codex

DeepSeek max: reproducir, leer dueños, editar, usar Blender cuando corresponda,
ejecutar pruebas y preparar evidencia. Conservar max según preferencia del
usuario; no cambiar modelo/proveedor automáticamente ni inventar su traducción
a parámetros de la API.

Codex: revisar un caso acotado si falla el diagnóstico, la comparación visual
es ambigua o hay regresión persistente. El paquete de revisión debe contener
SHA/diff, una frase del defecto, antes/después comparables, comando exacto,
resultados y dos hipótesis ya intentadas. No hacer que cada modelo repita toda
la exploración. No añadir subagentes por defecto al bucle secuencial de craft.

Preferir una causa por iteración y normalmente una o dos iteraciones con alto
impacto. No cortar una corrección útil por un número arbitrario de pasos; cortar
la repetición sin aprendizaje. Batch de lecturas independientes y logs acotados;
esperar jobs cuando corresponda en vez de sondear cada segundo. Pruebas locales
no requieren otra inferencia por cada comando, aunque decidir/revisar sí la use.

## Cómo medir si esto potencia de verdad al modelo

Usar copias aisladas al evaluar bugs históricos; nunca retroceder main. Mismo
modelo, esfuerzo, tarea y commit inicial, con y sin skill. Pocas tareas:

- Sprint que funciona en laboratorio pero no desde el jugador.
- Pop al activar crouch/ADS mientras se mueve.
- Sliding diagonal con cardinales correctos.

Registrar dueño identificado, corrección comprobada, invariantes, evidencia
visual recibida y revisada, solicitudes, duración, tokens sin cache y reintentos.
`node harness/bin/session-report.mjs --session <id>` ya aporta métricas de
sesión; se enlazan a su resultado, no se crea otro recolector.

Una suite de montaje valida tools/skills y compatibilidad, no capacidad del
modelo. El beneficio conductual y el ahorro de Codex quedan SIN VERIFICAR hasta
esa evaluación. No afirmar porcentajes de mejora a partir de esta auditoría.

## Siguiente frente del juego: agilidad con apoyo creíble

Vale la pena atacar la inversión/diagonal antes de más oscilación decorativa.
Sospecha a comprobar: el mezclador usa magnitudes escalares para cadencia, pero
combinar clips perpendiculares puede acortar el desplazamiento efectivo del pie.
No está medido ni corregido por 51b643e: comparar movimiento mundial del apoyo
contra velocidad real y fase antes de cambiar la fórmula.

Orden propuesto: medir diagonal/inversión → corregir pesos/reloj si es runtime
→ mirar otra vez → editar clip en Blender solo si allí está el defecto. Después
evaluar arranque/parada y peso visual del sprint con entrada de jugador real.
Mantener 4.8/7.0/2.6 m/s salvo autorización de cambiar gameplay. Una sensación
tipo Free Fire exige también revisión de cámara, input y latencia real; abrir
esos frentes solo si la evidencia apunta allí. No certificarlos con poses.

La entrega inmediata cambia instrucciones y sincronización del harness. Las
pruebas A/B con DeepSeek y la siguiente corrección diagonal son trabajo posterior
acotado, no resultados ya obtenidos.

## Verificación de esta entrega

`harness/test.sh`: PASS sobre el runtime activo, instalación sincronizada.
BUILD/CREATOR conservan 18 tools y 16,247 caracteres de schema base. La aclaración
de consultas Python lleva Blender JIT de +891 a +928 caracteres, solo al activarlo.
Metadata DSH y enlace de la receta verificados. El validador genérico de skills
Codex rechaza `whenToUse`, un campo existente de este formato DSH; se conserva
el formato del consumidor y se valida con el montaje real del harness.
