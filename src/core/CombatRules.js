// Contrato de combate compartido. Jugador y bots nacen, reciben feedback y
// reaparecen con la misma reserva de vida; el balance de armas escala desde
// aquí para que elevar la lectura del HUD no convierta las peleas en esponjas.
export const MAX_HEALTH = 200;
export const LEGACY_HEALTH = 125;
export const DAMAGE_SCALE = MAX_HEALTH / LEGACY_HEALTH;
