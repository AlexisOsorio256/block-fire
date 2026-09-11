// Prueba de tools/audit-repo.mjs: la auditoría debe ENCONTRAR lo que sobra y no
// inventar lo que no. Un auditor que no detecta no sirve; uno que grita en falso
// hace borrar producto, así que se prueban las dos direcciones.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let failures = 0;
const check = (ok, message) => {
  if (!ok) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
};

const AUDIT = path.resolve(process.argv[2] ?? 'tools/audit-repo.mjs');

function runAudit(root) {
  const out = execFileSync('node', [AUDIT, '--root', root, '--json'], { encoding: 'utf8' });
  return JSON.parse(out);
}

// --- Caso 1: repo fabricado con basura a propósito --------------------------
const fixture = mkdtempSync(path.join(tmpdir(), 'bf-audit-'));
try {
  mkdirSync(path.join(fixture, 'assets'), { recursive: true });
  mkdirSync(path.join(fixture, 'game'), { recursive: true });
  writeFileSync(path.join(fixture, 'game', 'vivo.gd'), 'const MODEL := "assets/used.glb"\n');
  writeFileSync(path.join(fixture, 'assets', 'used.glb'), 'x'.repeat(4096));
  writeFileSync(path.join(fixture, 'assets', 'muerto.glb'), 'y'.repeat(8192));
  // Una textura junto a un GLB NO se juzga: puede estar citada por URI desde el
  // binario y romper el import si se borra.
  writeFileSync(path.join(fixture, 'assets', 'textura.png'), 'z'.repeat(4096));
  // .import huérfano de verdad (su fuente no existe) y .import sano, que NO
  // debe aparecer: un auditor que marca el metadata de un asset vivo hace
  // borrar imports que Godot necesita.
  writeFileSync(path.join(fixture, 'assets', 'fantasma.glb.import'), '[remap]\n');
  writeFileSync(path.join(fixture, 'assets', 'used.glb.import'), '[remap]\n');
  writeFileSync(path.join(fixture, 'game', 'borrado.gd.uid'), 'uid://x\n');
  execFileSync('git', ['init', '-q'], { cwd: fixture });
  execFileSync('git', ['add', '-A'], { cwd: fixture });

  const report = runAudit(fixture);
  const orphans = report.orphans.map((f) => f.path);
  check(orphans.includes('assets/muerto.glb'), 'detecta el asset sin referencias');
  check(!orphans.includes('assets/used.glb'), 'no marca el asset que el código usa');
  check(
    !orphans.includes('assets/textura.png'),
    'no juzga texturas: un GLB puede citarlas por URI',
  );
  check(
    report.metadata.some((m) => m.path === 'game/borrado.gd.uid'),
    'detecta el .uid huérfano',
  );
  check(
    report.metadata.some((m) => m.path === 'assets/fantasma.glb.import'),
    'detecta el .import huérfano',
  );
  check(
    !report.metadata.some((m) => m.path === 'assets/used.glb.import'),
    'no marca el .import de un asset vivo',
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

// --- Caso 2: el repo real no debe tener basura probada ----------------------
const root = path.resolve('.');
const real = runAudit(root);
check(real.orphans.length === 0, `repo real sin assets huérfanos (hay ${real.orphans.length})`);
check(real.metadata.length === 0, `repo real sin metadata huérfana (hay ${real.metadata.length})`);
check(real.refs.unusual.length === 0, `repo real sin refs de herramienta (hay ${real.refs.unusual.length})`);
const risky = real.caches.filter((cache) => cache.tracked > 0);
check(risky.length === 0, `ninguna caché contiene ficheros rastreados (${risky.map((c) => c.path).join(', ')})`);

if (failures === 0) {
  console.log(`AUDIT_REPO: PASS (${real.trackedFiles} rastreados, ${real.orphans.length} huérfanos)`);
  process.exit(0);
}
console.error(`AUDIT_REPO: FAIL failures=${failures}`);
process.exit(1);
