// BUILD ID inyectado en tiempo de build por tools/build-web.sh (--define).
// En desarrollo (sin bundle) vale 'dev'. Nunca player-facing: solo consola/debug.
export const BUILD_ID = typeof BF_BUILD_ID !== 'undefined' ? BF_BUILD_ID : 'dev';
