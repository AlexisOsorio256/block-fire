# BLOCKFIRE — roadmap

Este documento describe el estado y los siguientes criterios de aceptación;
no es un diario de cambios.

## Estado actual

- Runtime web y Capacitor comparten el mismo juego.
- Flujo de escuadras, FFA, compra, HUD, espectador, armas, bots, lobby y
  decoración están implementados.
- Input táctil usa ownership por pointer, multitouch y editor persistente.
- Diagnóstico DEV expone render, DPR, WebGL, touch y métricas de frame.
- La suite DEV y el build de producción son los gates automatizados.

## Siguiente frente

1. Validación en Android físico landscape: flujo completo, multitouch,
   orientación, audio, suspensión/reanudación y lectura de controles.
2. Ajustes basados en métricas reales del dispositivo sin degradar claridad.
3. Pulido de landmarks y feedback solo si estabilidad y gameplay siguen
   verdes.

## Aceptación

Un cambio se considera listo cuando:

- la suite completa actual pasa y la consola no muestra errores propios;
- el build de producción termina sin harness DEV;
- no hay proceso auxiliar vivo al finalizar;
- el flujo afectado conserva reset, muerte, espectador, retry y orientación;
- la comprobación física Android pendiente queda explícitamente marcada si no
  se ejecutó.
