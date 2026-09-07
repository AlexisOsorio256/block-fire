// ControlLayout — dueño ÚNICO del layout de controles táctiles: posición,
// tamaño y opacidad INDIVIDUALES, persistencia NORMALIZADA (fracción 0..1 del
// viewport, sobrevive a cambios de resolución) y MODO EDICIÓN con panel
// propio: tocar un control lo selecciona → arrastrar lo mueve, sliders de
// tamaño/opacidad, y GUARDAR · RESTABLECER · SALIR. En edición el gameplay no
// ve ningún pointer: los handlers de Input preguntan controlLayout.editMode y
// aquí se bloquea en fase de captura todo lo que no sea el editor.
// Safe-area: el clamp de posición usa --sat/--sab/--sal/--sar
// (env(safe-area-inset-*) definidas en style.css) — nada crítico bajo notch.
import { settings } from './Settings.js';

const CONTROL_IDS = ['joystick-base', 'btn-sprint', 'btn-crouch', 'btn-jump',
  'btn-reload', 'btn-switch', 'btn-aim', 'btn-fire', 'btn-fire-left'];
const EDITABLE_SELECTOR = CONTROL_IDS.map(c => `#${c}`).join(',');
const BASE_PX = { 'joystick-base': 110 }; // resto: botones de 54px (style.css)
const SCALE_MIN = 0.6, SCALE_MAX = 2.0, OPACITY_MIN = 0.2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

class ControlLayout {
  constructor() {
    this.editMode = false;
    this.selectedId = null;
    this._bound = false;
    this._onSelection = null;
    this._onEditModeChange = null;
    window.addEventListener('resize', () => this.apply());
  }

  // Defaults canónicos (fracciones del viewport; referencia 800×360 landscape
  // — reproducen el layout fijo que vivía en style.css).
  defaults() {
    return {
      'joystick-base': { fx: 0.0988, fy: 0.7806, scale: 1, opacity: 1 },
      'btn-fire':      { fx: 0.9463, fy: 0.8806, scale: 1, opacity: 1 },
      'btn-fire-left': { fx: 0.0588, fy: 0.3972, scale: 1, opacity: 1 },
      'btn-aim':       { fx: 0.9463, fy: 0.7028, scale: 1, opacity: 1 },
      'btn-jump':      { fx: 0.8663, fy: 0.5250, scale: 1, opacity: 1 },
      'btn-reload':    { fx: 0.9463, fy: 0.5250, scale: 1, opacity: 1 },
      'btn-switch':    { fx: 0.8663, fy: 0.7028, scale: 1, opacity: 1 },
      'btn-sprint':    { fx: 0.8663, fy: 0.3472, scale: 1, opacity: 1 },
      'btn-crouch':    { fx: 0.9463, fy: 0.3472, scale: 1, opacity: 1 },
    };
  }

  get(id) {
    const d = this.defaults()[id];
    const s = (settings.get('controlLayout') || {})[id];
    if (!s || typeof s !== 'object') return { ...d };
    return {
      fx: clamp(Number(s.fx) || 0, 0, 1),
      fy: clamp(Number(s.fy) || 0, 0, 1),
      scale: clamp(Number(s.scale) || 1, SCALE_MIN, SCALE_MAX),
      opacity: clamp(Number(s.opacity) === 0 ? OPACITY_MIN : Number(s.opacity) || 1, OPACITY_MIN, 1),
    };
  }

  // set() escribe por control; persist:false evita un localStorage por frame
  // durante el drag (se persiste al soltar / GUARDAR / SALIR).
  set(id, patch, opts = {}) {
    const all = settings.get('controlLayout') || {};
    const next = this.get(id);
    for (const k of ['fx', 'fy', 'scale', 'opacity']) {
      if (patch && patch[k] !== undefined) {
        if (k === 'scale') next.scale = clamp(Number(patch.scale) || 1, SCALE_MIN, SCALE_MAX);
        else if (k === 'opacity') next.opacity = clamp(Number(patch.opacity) === 0 ? OPACITY_MIN : Number(patch.opacity) || 1, OPACITY_MIN, 1);
        else next[k] = clamp(Number(patch[k]) || 0, 0, 1);
      }
    }
    all[id] = next;
    settings._values.controlLayout = all;
    if (opts.persist !== false) settings._persist();
    if (this._onSelection && id === this.selectedId) this._onSelection(id, next);
  }

  resetAll() {
    settings._values.controlLayout = {};
    settings._persist();
    this.select(null);
  }

  isDefault(id) {
    const d = this.defaults()[id], c = this.get(id);
    return Math.abs(c.fx - d.fx) < 1e-6 && Math.abs(c.fy - d.fy) < 1e-6
      && c.scale === 1 && c.opacity === 1;
  }

  // ---- Aplicación al DOM: fracción → px contra el viewport actual ----
  apply() {
    const mc = document.getElementById('mobile-controls');
    if (!mc) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cs = getComputedStyle(document.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    const gScale = settings.get('btnScale') || 1;
    const gOp = settings.get('btnOpacity') === undefined ? 1 : settings.get('btnOpacity');
    for (const id of CONTROL_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const d = this.get(id);
      const s = d.scale * gScale;
      const base = BASE_PX[id] || 54;
      const w = base * s, h = base * s;
      el.style.setProperty('--ctl-scale', String(s));
      el.style.opacity = String(clamp(d.opacity * gOp, 0, 1));
      if (id === 'joystick-base') {
        // La zona de activación acompaña la base, pero el centro del joystick
        // puede vivir en TODO el viewport útil. El editor no "protege" lados
        // para el producto: la elección del jugador prevalece.
        const zone = document.getElementById('joystick-zone');
        if (!zone) continue;
        const zoneW = Math.max(156, w + 68), zoneH = Math.max(156, h + 68);
        const cx = clamp(d.fx * vw, sal + w / 2, Math.max(sal + w / 2, vw - sar - w / 2));
        const cy = clamp(d.fy * vh, sat + h / 2, Math.max(sat + h / 2, vh - sab - h / 2));
        zone.style.width = `${Math.round(zoneW)}px`;
        zone.style.height = `${Math.round(zoneH)}px`;
        zone.style.left = `${Math.round(cx - zoneW / 2)}px`;
        zone.style.top = `${Math.round(cy - zoneH / 2)}px`;
        zone.style.bottom = 'auto';
      } else {
        const cx = clamp(d.fx * vw, sal + w / 2, Math.max(sal + w / 2, vw - sar - w / 2));
        const cy = clamp(d.fy * vh, sat + h / 2, Math.max(sat + h / 2, vh - sab - h / 2));
        el.style.position = 'fixed';
        el.style.left = `${Math.round(cx - w / 2)}px`;
        el.style.top = `${Math.round(cy - h / 2)}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    }
  }

  // ---- Modo edición ----
  setEditMode(on) {
    this.editMode = !!on;
    const mc = document.getElementById('mobile-controls');
    if (mc) mc.classList.toggle('editing', this.editMode);
    document.body.classList.toggle('ctl-editing', this.editMode);
    if (this.editMode) {
      this._ensureBindings();
      this._ensurePanel();
      const panel = document.getElementById('ctl-editor');
      if (panel) panel.classList.remove('hidden');
      this.apply();
      this.select(null);
      // El panel de configuración SE APARTA: el gameplay/lobby queda de fondo.
      this._hidConfig = false;
      const cfg = document.getElementById('config-panel');
      if (cfg && !cfg.classList.contains('hidden')) {
        cfg.classList.add('hidden');
        this._hidConfig = true;
      }
    } else {
      this.select(null);
      settings._persist();
      this.apply();
      const panel = document.getElementById('ctl-editor');
      if (panel) panel.classList.add('hidden');
      // Solo el SALIR propio del editor reabre el panel (si lo ocultó él);
      // un setEditMode(false) externo (Game) ya gestiona su panel.
      if (this._exitFromPanel && this._hidConfig) {
        const cfg = document.getElementById('config-panel');
        if (cfg) cfg.classList.remove('hidden');
      }
      this._exitFromPanel = false;
      this._hidConfig = false;
    }
    if (this._onEditModeChange) this._onEditModeChange(this.editMode);
  }

  onSelect(fn) { this._onSelection = fn; }
  onEditModeChange(fn) { this._onEditModeChange = fn; }

  select(id) {
    this.selectedId = id || null;
    for (const cid of CONTROL_IDS) {
      const el = document.getElementById(cid);
      if (el) el.classList.toggle('ctl-selected', cid === this.selectedId);
    }
    this._syncPanel();
    if (this._onSelection) this._onSelection(this.selectedId, this.selectedId ? this.get(this.selectedId) : null);
  }

  setSelectedScale(v) { if (this.selectedId) this.set(this.selectedId, { scale: v }, { persist: false }); this.apply(); }
  setSelectedOpacity(v) { if (this.selectedId) this.set(this.selectedId, { opacity: v }, { persist: false }); this.apply(); }

  // ---- Panel del editor (HUD pequeño dentro de #mobile-controls) ----
  _ensurePanel() {
    if (document.getElementById('ctl-editor')) return;
    const mc = document.getElementById('mobile-controls');
    if (!mc) return;
    const panel = document.createElement('div');
    panel.id = 'ctl-editor';
    panel.innerHTML = `
      <div class="ce-title">EDITAR CONTROLES</div>
      <div class="ce-hint" id="ce-hint">Toca un control para seleccionarlo y arrastrarlo</div>
      <div class="ce-row" id="ce-sliders" style="display:none">
        <label>TAMAÑO</label>
        <span><input type="range" id="ce-scale" min="0.6" max="2" step="0.05" value="1"><output id="ce-scale-out">1.00×</output></span>
        <label>OPACIDAD</label>
        <span><input type="range" id="ce-opacity" min="0.2" max="1" step="0.05" value="1"><output id="ce-op-out">100%</output></span>
      </div>
      <div class="ce-actions">
        <button id="ce-save">GUARDAR</button>
        <button id="ce-reset">RESTABLECER</button>
        <button id="ce-exit">SALIR</button>
      </div>`;
    mc.appendChild(panel);
    panel.querySelector('#ce-scale').addEventListener('input', e => this.setSelectedScale(parseFloat(e.target.value)));
    panel.querySelector('#ce-opacity').addEventListener('input', e => this.setSelectedOpacity(parseFloat(e.target.value)));
    panel.querySelector('#ce-save').addEventListener('click', () => {
      settings._persist();
      const hint = panel.querySelector('#ce-hint');
      hint.textContent = '✓ Disposición guardada';
      setTimeout(() => this._syncPanel(), 1400);
    });
    panel.querySelector('#ce-reset').addEventListener('click', () => {
      this.resetAll();
      this.apply();
    });
    panel.querySelector('#ce-exit').addEventListener('click', () => {
      this._exitFromPanel = true;
      this.setEditMode(false);
    });
  }

  _syncPanel() {
    const panel = document.getElementById('ctl-editor');
    if (!panel) return;
    const hint = panel.querySelector('#ce-hint');
    const row = panel.querySelector('#ce-sliders');
    if (!this.editMode) { row.style.display = 'none'; return; }
    if (this.selectedId) {
      const d = this.get(this.selectedId);
      hint.textContent = `SELECCIONADO: ${this._label(this.selectedId)} — arrastra para moverlo`;
      row.style.display = 'grid';
      panel.querySelector('#ce-scale').value = String(d.scale);
      panel.querySelector('#ce-scale-out').textContent = `${d.scale.toFixed(2)}×`;
      panel.querySelector('#ce-opacity').value = String(d.opacity);
      panel.querySelector('#ce-op-out').textContent = `${Math.round(d.opacity * 100)}%`;
    } else {
      hint.textContent = 'Toca un control para seleccionarlo y arrastrarlo';
      row.style.display = 'none';
    }
  }

  _label(id) {
    if (id === 'joystick-base') return 'JOYSTICK';
    const el = document.getElementById(id);
    const lbl = el && el.querySelector('.lbl');
    return lbl ? lbl.textContent : id.toUpperCase();
  }

    // ---- Routing de punteros en edición (fase captura, UN solo camino) ----
    // En edición TODO pointerdown que no sea del panel se bloquea (sin gameplay)
    // salvo el del control editable, que inicia un drag de layout. El drag
    // escucha en #mobile-controls con captura: aunque el dedo salga del botón
    // (o del viewport) los pointermove siguen llegando al mismo dueño.
    _ensureBindings() {
      if (this._bound) return;
      const mc = document.getElementById('mobile-controls');
      if (!mc) return;
      this._bound = true;
      const pass = t => t && t.closest && (t.closest('#ctl-editor') || t.closest(EDITABLE_SELECTOR));
      mc.addEventListener('pointerdown', e => {
        if (!this.editMode) return;
        if (pass(e.target)) return; // el editor y los controles gestionan el suyo
        e.stopImmediatePropagation();
        e.preventDefault();
      }, true);
      mc.addEventListener('click', e => {
        if (!this.editMode) return;
        if (pass(e.target)) return;
        e.stopImmediatePropagation();
        e.preventDefault();
      }, true);
      let dragId = null, dragEl = null, isJoy = false, sx = 0, sy = 0, sfx = 0, sfy = 0;
      mc.addEventListener('pointerdown', e => {
        if (!this.editMode || dragId !== null) return;
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('#ctl-editor')) return; // el panel gestiona los suyos
        const btn = t.closest('.action-btn');
        const joyBase = t.closest('#joystick-base');
        if (!btn && !joyBase) return; // fondo/look-zone: ya bloqueado arriba
        e.preventDefault();
        e.stopImmediatePropagation();
        dragId = e.pointerId;
        dragEl = (btn || joyBase);
        isJoy = !!joyBase;
        sx = e.clientX; sy = e.clientY;
        const d = this.get(dragEl.id);
        sfx = d.fx; sfy = d.fy;
        this.select(dragEl.id);
        try { mc.setPointerCapture(e.pointerId); } catch (err) {}
      }, true);
      mc.addEventListener('pointermove', e => {
        if (dragId !== e.pointerId || !this.editMode) return;
        e.preventDefault();
        this.set(dragEl.id, {
          fx: clamp(sfx + (e.clientX - sx) / window.innerWidth, 0, 1),
          fy: clamp(sfy + (e.clientY - sy) / window.innerHeight, 0, 1),
        }, { persist: false });
        this.apply();
      }, true);
      const drop = e => {
        if (dragId !== e.pointerId) return;
        dragId = null; dragEl = null;
        settings._persist(); // drop = persistir la fracción final
      };
      mc.addEventListener('pointerup', drop, true);
      mc.addEventListener('pointercancel', drop, true);
    }
}

export const controlLayout = new ControlLayout();
