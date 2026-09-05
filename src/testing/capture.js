// Harness de capturas — ?capture=lobbybare|playing|combat
// Herramienta de auditoría visual (reglas §8): pone el juego en la situación
// pedida para fotografiarlo siempre desde la misma situación.
export function setupCapture(game, mode) {
  setTimeout(()=>{
    if(mode==='lobbybare'){
      // Auditoría visual del lobby 3D sin el velo del overlay
      document.getElementById('overlay').style.display = 'none';
    }
    if(mode==='playing'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
      // acortar la fase de compra para la captura del combate
      game.phaseTime = 1.5;
    }
    if(mode==='combat'){
      game.startMatch();
      document.getElementById('overlay').classList.add('hidden');
      // fase de compra corta → combate real con bots GLB en movimiento
      game.phaseTime = 1.2;
      }
  }, 600);
}
