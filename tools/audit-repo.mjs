#!/usr/bin/env node
// BLOCKFIRE — auditoría de repositorio: encuentra lo que sobra y lo PRUEBA.
//
// Nace de una limpieza real: 2.7 GB de árbol, assets muertos de 77 MB, metadata
// huérfana y ~94 MB de blobs anclados por refs de agente. Todo eso se hizo a
// mano, tres veces, con grep y du. Este comando lo hace en un paso y con la
// evidencia al lado de cada hallazgo: borrar sin prueba fue justo lo que casi
// rompe el proyecto (un `--invert-paths` sobre un path todavía vivo).
//
// USO
//   node tools/audit-repo.mjs [--root <dir>] [--json]
//
// NO borra nada. Solo informa. Reporta cuatro clases, con tamaño y prueba:
//   1. assets sin referencia local  ficheros rastreados que nada cita
//   2. metadata huérfana     .import/.uid de un fuente que ya no existe
//   3. refs que anclan basura ramas/refs que retienen objetos muertos
//   4. caché regenerable     artefactos ignorados que se reconstruyen solos
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const rootIndex = args.indexOf('--root');
const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.cwd());

function git(...cmd) {
  try {
    return execFileSync('git', cmd, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

function tracked() {
  return git('ls-files').split('\n').filter(Boolean);
}

function sizeOf(rel) {
  try {
    return statSync(path.join(root, rel)).size;
  } catch {
    return 0;
  }
}

const HUMAN = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// --- 1. Assets huérfanos -----------------------------------------------------
// Un asset "vive" si su nombre aparece en código, escenas, presets, docs o
// scripts. Los binarios de datos (.bin/.png/.jpg sueltos) se comprueban por
// nombre porque un GLB puede referenciarlos por URI.
// Solo se afirma "sin referencias" para formatos que NO pueden ser citados por
// URI desde otro binario. Un PNG junto a un GLB puede vivir fuera del repo y
// estar referenciado por ruta externa: Godot resuelve esas rutas al importar, y
// borrar una así rompió el showcase en esta misma sesión (el smoke test lo cazó,
// este auditor no). Ante duda: no se afirma, se calla la boca.
const ASSET_EXT = /\.(glb|gltf|bin|ttf|blend)$/i;
const JUDGEMENT_CALL = /\.(png|jpg|jpeg|wav|ogg|mp3)$/i;
const SOURCE_EXT = /\.(gd|tscn|tres|godot|cfg|py|mjs|js|sh|json|md|txt)$/i;
const IGNORE_DIRS = new Set(['.git', '.godot', 'node_modules', 'builds', 'captures']);

function allSources() {
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
        if (IGNORE_DIRS.has(entry.name)) continue;
      }
      const abs = path.join(dir, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(abs, childRel);
      } else if (SOURCE_EXT.test(entry.name)) {
        out.push({ rel: childRel, abs });
      }
    }
  };
  walk(root, '');
  return out;
}

function orphanAssets(files) {
  const sources = allSources();
  const findings = [];
  const assets = files.filter((f) => ASSET_EXT.test(f));
  for (const asset of assets) {
    const base = path.basename(asset);
    const stem = base.replace(/\.[^.]+$/, '');
    let refs = 0;
    for (const { rel, abs } of sources) {
      if (rel === asset || rel.startsWith(`${asset}.`)) continue; // su propio .import
      let text;
      try {
        text = execFileSync('grep', ['-l', '-F', base, abs], { encoding: 'utf8' });
      } catch {
        text = '';
      }
      if (text) refs += 1;
      else {
        // Segundo intento por nombre sin extensión: los .import de Godot y los
        // prefijos de pipeline citan el fuente sin sufijo.
        try {
          if (execFileSync('grep', ['-l', '-F', stem, abs], { encoding: 'utf8' })) refs += 1;
        } catch {
          /* sin referencia */
        }
      }
    }
    if (refs === 0) findings.push({ path: asset, bytes: sizeOf(asset) });
  }
  return findings.sort((a, b) => b.bytes - a.bytes);
}

// --- 2. Metadata huérfana ----------------------------------------------------
// Godot crea `<fuente>.import` y ahora `<script>.gd.uid`: si el fuente se borró
// a mano, el metadata queda y contamina inventarios y diffs.
function orphanMetadata(files) {
  const findings = [];
  for (const file of files) {
    if (file.endsWith('.import')) {
      const source = file.slice(0, -'.import'.length);
      if (!existsSync(path.join(root, source))) findings.push({ path: file, missing: source });
    } else if (file.endsWith('.uid')) {
      const source = file.slice(0, -'.uid'.length);
      if (!existsSync(path.join(root, source))) findings.push({ path: file, missing: source });
    }
  }
  return findings;
}

// --- 3. Refs que anclan basura ----------------------------------------------
// Poda el pack y mide cuánto peso queda alcanzable: si una ref de herramienta
// (agentes, snapshots por turno) mantiene viva historia muerta, aquí se ve.
function refAudit() {
  const refs = git('for-each-ref', '--format=%(refname) %(objecttype)').split('\n').filter(Boolean);
  const unusual = [];
  for (const line of refs) {
    const [name, type] = line.split(' ');
    if (!name) continue;
    const isStandard =
      name.startsWith('refs/heads/') || name.startsWith('refs/remotes/') || name.startsWith('refs/tags/');
    if (!isStandard || type !== 'commit') unusual.push({ ref: name, type });
  }
  const packBytes = Number(
    (git('count-objects', '-v').match(/size-pack:\s*(\d+)/) || [0, 0])[1] || 0,
  ) * 1024;
  const loose = Number((git('count-objects', '-v').match(/^count:\s*(\d+)/m) || [0, 0])[1] || 0);
  return { unusual, packBytes, loose };
}

// --- 4. Caché regenerable ----------------------------------------------------
const CACHE_DIRS = ['.godot', 'builds', 'captures', '.tmp', 'tools/__pycache__'];

function dirSize(rel) {
  let total = 0;
  const walk = (abs) => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = path.join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else {
        try {
          total += statSync(child).size;
        } catch {
          /* carrera con el escritor */
        }
      }
    }
  };
  walk(path.join(root, rel));
  return total;
}

function regenerable() {
  const findings = [];
  for (const rel of CACHE_DIRS) {
    if (!existsSync(path.join(root, rel))) continue;
    const trackedIn = git('ls-files', rel).split('\n').filter(Boolean);
    findings.push({ path: rel, bytes: dirSize(rel), tracked: trackedIn.length });
  }
  return findings.sort((a, b) => b.bytes - a.bytes);
}

// --- Informe -----------------------------------------------------------------
const files = tracked();
const report = {
  root,
  trackedFiles: files.length,
  notJudged: files.filter((f) => JUDGEMENT_CALL.test(f)).length,
  orphans: orphanAssets(files),
  metadata: orphanMetadata(files),
  refs: refAudit(),
  caches: regenerable(),
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`audit ${root}`);
console.log(`  rastreados ${files.length} · pack ${HUMAN(report.refs.packBytes)} · sueltos ${report.refs.loose}`);

const orphanBytes = report.orphans.reduce((sum, f) => sum + f.bytes, 0);
console.log(`\nassets sin referencias locales: ${report.orphans.length} (${HUMAN(orphanBytes)})`);
for (const f of report.orphans.slice(0, 15)) console.log(`  ${HUMAN(f.bytes).padStart(8)}  ${f.path}`);
if (report.orphans.length > 15) console.log(`  … ${report.orphans.length - 15} más`);

console.log(`\nmetadata huérfana: ${report.metadata.length}`);
for (const f of report.metadata.slice(0, 10)) console.log(`  ${f.path}  (falta ${f.missing})`);

console.log(`\nrefs fuera de lo normal: ${report.refs.unusual.length}`);
for (const r of report.refs.unusual.slice(0, 10)) console.log(`  ${r.type.padEnd(6)} ${r.ref}`);
if (report.refs.unusual.length) {
  console.log('  → una ref de herramienta ancla objetos muertos: mira el pack tras `git gc`');
}

const cacheBytes = report.caches.reduce((sum, c) => sum + c.bytes, 0);
console.log(`\ncaché regenerable: ${HUMAN(cacheBytes)}`);
for (const c of report.caches) {
  console.log(`  ${HUMAN(c.bytes).padStart(8)}  ${c.path}${c.tracked ? `  (¡${c.tracked} rastreados!)` : ''}`);
}

// Señal de peligro: caché con ficheros rastreados significa que borrarla destruye
// producto, no caché. Es el error que este comando existe para evitar.
const risky = report.caches.filter((c) => c.tracked > 0);
if (risky.length) {
  console.log('\nAVISO: hay caché con ficheros rastreados; no borrar sin revisar.');
}
console.log(`\ntexturas/audio junto a un binario: no se juzgan (${report.notJudged} ficheros).`);
console.log('  Un PNG puede estar citado por URI desde un GLB; Godot lo resuelve al importar.');
console.log('  Para comprobarlo: borra una copia, reimporta y corre `tools/bf test`.');
console.log('\nnada se borra aquí: cada línea es un candidato con su prueba.');
