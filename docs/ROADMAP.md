# BLOCKFIRE — roadmap

Este documento describe próximos criterios de aceptación; no es un diario de
cambios.

## Base cerrada

- Runtime Godot 4.7.2 Android landscape-first y renderer Mobile.
- Lobby, Escuadras 4v4, FFA, compra, HUD, espectador, armas, bots,
  navegación, aim assist móvil y editor de controles implementados.
- Suite headless, export APK y ciclo de procesos documentados.

## Siguientes frentes

1. **Android físico:** probar instalación, landscape, multitouch,
   fuego-arrastre, aim assist, audio, suspensión/reanudación y lectura de
   controles.
2. **Rendimiento móvil:** medir frame time, memoria, temperatura y batería;
   ajustar sombras, resolución y densidad solo con evidencia.
3. **Gameplay y lectura:** pulir operadores, landmarks, recoil, feedback de
   daño, compra y claridad de score sin romper los contratos de los modos.
4. **Audio y VFX:** validar mezcla, espacialidad, impactos, muerte, reload y
   señales de estado en hardware real.
5. **Distribución:** preparar iconos, nombre/versionado, privacidad,
   firma, permisos mínimos y checklist de Play Store.
6. **Monetización futura:** evaluar únicamente cosméticos locales o servicios
   explícitamente autorizados; no introducir economía real durante estos
   frentes.

## Aceptación

Un cambio está listo cuando la suite actual pasa, el APK exporta, la consola
no muestra errores propios, no quedan procesos auxiliares vivos y el flujo
afectado conserva reset, muerte, espectador, retry y orientación. La
validación física Android pendiente se marca explícitamente como
`SIN VERIFICAR`.
