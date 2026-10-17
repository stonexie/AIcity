// Title / press-start screen and pause menu (settings, controls). Keyboard + mouse navigable.
import { QUALITY_PRESETS } from '../systems/player/settings.js';

const CONTROLS = [
  ['MOVE', ['W', 'A', 'S', 'D']], ['LOOK', ['MOUSE']], ['SPRINT', ['SHIFT']], ['JUMP', ['SPACE']],
  ['CROUCH', ['C', 'CTRL']], ['CAMERA FP / TP', ['V']], ['ENTER / EXIT VEHICLE', ['F']], ['INTERACT', ['F']],
  ['TOGGLE HUD', ['H']], ['BLENDER / TRIPO 3D', ['B']], ['PAUSE MENU', ['ESC']], ['DRIVE', ['W', 'S']],
];

const SETTINGS = [
  { key: 'quality', label: 'GRAPHICS PRESET', type: 'enum', options: QUALITY_PRESETS, fmt: (v) => v.toUpperCase(), desc: 'Overall rendering quality (reflections, shadows, draw distance). Applied on restart via ?q=<preset>.' },
  { key: 'fov', label: 'FIELD OF VIEW', type: 'range', min: 55, max: 100, step: 5, fmt: (v) => `${v}°`, desc: 'Vertical field of view on foot. Sprinting adds a short FOV kick.' },
  { key: 'sensitivity', label: 'MOUSE SENSITIVITY', type: 'range', min: 0.3, max: 2.5, step: 0.1, fmt: (v) => v.toFixed(1), desc: 'Mouse look speed while the neural link (pointer lock) is active.' },
  { key: 'invertY', label: 'INVERT Y AXIS', type: 'bool', desc: 'Invert vertical mouse look.' },
  { key: 'headBob', label: 'HEAD BOB', type: 'bool', desc: 'Camera bob while walking and sprinting. Disable if you get motion sick.' },
  { key: 'cameraSway', label: 'CAMERA SWAY', type: 'bool', desc: 'Idle breathing, strafe lean and look lag on the first-person camera.' },
  { key: 'minimapRotate', label: 'ROTATING MINIMAP', type: 'bool', desc: 'Minimap rotates with your heading. Off = north-up.' },
  { key: 'hud', label: 'SHOW HUD', type: 'bool', desc: 'Show or hide the HUD overlay. Shortcut: [H].' },
];

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const key = (k) => `<span class="nk-key">${k}</span>`;

export class Menus {
  constructor(root, settings, cb) {
    this.root = root; this.settings = settings; this.cb = cb;
    this.buildTitle();
    this.buildPause();
    this.sel = 0; this.setSel = 0; this.tab = 'main';
    addEventListener('keydown', (e) => this.onKey(e));
  }

  buildTitle() {
    const t = el('div', 'nk-title', `
      <div class="frame"></div><div class="topline"></div><div class="scan"></div>
      <div class="corner-tl"><div class="barcode"></div><div class="tiny">KAIDO INTERACTIVE · NC-2077<br>NEURAL LINK PROTOCOL 6520-A44<br>BRAINDANCE CERTIFIED</div></div>
      <div class="vert">00032 05 54 08 CP // NEON KAIDO // 夜の街道 // SYS.BOOT OK</div>
      <div class="logo">
        <div class="kicker">AN OPEN CITY · 開かれた街</div>
        <div class="nk-logo-wrap"><div class="nk-logo"><span>NEON</span><span>KAIDO</span><div class="gl"><b></b><b></b><b></b></div></div></div>
        <div class="jpline"><i></i><span class="jp">ネオン街道</span><i style="width:60px"></i></div>
        <div class="tagline">THE CITY NEVER SLEEPS. NEITHER DO YOU.</div>
      </div>
      <div class="press"><div class="btn">${key('ENTER')}<span class="blink">PRESS ANY KEY</span></div><div class="tiny">CLICK TO LINK NEURAL INTERFACE<br>MOUSE + KEYBOARD RECOMMENDED</div></div>
      <div class="legal"><div class="tiny">This braindance is a work of fiction. Any resemblance to real megacorporations, fixers or ramen stands is purely coincidental. Neural feedback may cause mild dissociation. Kaido Interactive is not liable for lost eddies.</div><div class="ver">BUILD 0.9.186 · WEBGPU<br>© 2077 KAIDO INTERACTIVE</div></div>
      <div class="flash"></div>`);
    this.root.appendChild(t);
    this.title = t;
    t.addEventListener('click', () => this.cb.start());
  }

  buildPause() {
    const m = el('div', 'nk-menu', `
      <div class="grid"></div><div class="wm jp">ネオン街道</div><div class="scan"></div><div class="topbar"></div>
      <div class="header"><div class="ico">01<br>10</div><h1>SYSTEM // PAUSED</h1></div>
      <div class="tabs"><span class="on" data-t="main"></span><span data-t="settings"></span><span data-t="controls"></span></div>
      <div class="subtitle">IN KABUKICHO-9, NOBODY WAITS FOR YOU.</div>
      <div class="protocol"><div class="tiny">ONLY CC35 AND OHSF-5 CERTIFIED<br>TECH OFFICERS MAY ACCESS.<br>OPERATE OR DISABLE THIS DEVICE.</div></div>
      <div class="vert">00032 05 54 08 CP  ·  KBK-09 NODE  ·  00032 05 54 08 CP</div>
      <div class="left"><h2>MENU</h2><div class="items"></div></div>
      <div class="right">
        <div class="panel on" data-p="main"><h2>CURRENT STATUS</h2>
          <div class="stats"><div><div class="k">EDDIES</div><div class="v st-ed">0</div></div><div><div class="k">GIGS DONE</div><div class="v c st-gigs">0</div></div><div><div class="k">STREET CRED</div><div class="v st-cred">0</div></div></div>
          <div class="stats"><div><div class="k">DISTRICT</div><div class="v c st-zone" style="font-size:18px">—</div></div><div><div class="k">ACTIVE GIG</div><div class="v st-gig" style="font-size:18px">—</div></div><div><div class="k">TIME ON STREETS</div><div class="v c st-time" style="font-size:18px">0:00</div></div></div>
          <h2 style="margin-top:28px">GIG JOURNAL</h2><div class="journal"></div>
          <div class="quote">"Wake up, choom. The rain doesn't stop in Kabukicho-9 — it just changes color."</div>
        </div>
        <div class="panel" data-p="settings"><h2>SETTINGS</h2><div class="sets"></div><div class="desc"></div></div>
        <div class="panel" data-p="controls"><h2>CONTROLS</h2><div class="nk-ctrls">${CONTROLS.map(([n, ks]) => `<div class="c"><span>${n}</span><span class="k">${ks.map(key).join('')}</span></div>`).join('')}</div></div>
      </div>
      <div class="foot"><div class="logo-s">NEON<br>KAIDO</div><div class="tiny">The data you entered on this terminal will only be used for the purpose you entered them. Your personal data will be protected in accordance with the 2069 Privacy Act.</div></div>
      <div class="legend"><span>${key('ESC')} BACK</span><span>${key('ENTER')} SELECT</span><span>${key('◀')}${key('▶')} ADJUST</span></div>`);
    this.root.appendChild(m);
    this.menu = m;
    this.items = [
      { label: 'RESUME', act: () => this.cb.resume() },
      { label: 'SETTINGS', panel: 'settings' },
      { label: 'CONTROLS', panel: 'controls' },
      { label: 'QUIT TO TITLE', act: () => this.cb.quitToTitle() },
    ];
    const box = m.querySelector('.items');
    this.itemEls = this.items.map((it, i) => {
      const e = el('div', 'nk-mi', `<span>${it.label}</span><span class="ix">0${i + 1}</span>`);
      e.addEventListener('mouseenter', () => this.select(i));
      e.addEventListener('click', () => this.activate(i));
      box.appendChild(e);
      return e;
    });
    const sets = m.querySelector('.sets');
    this.setEls = SETTINGS.map((s, i) => {
      const e = el('div', 'nk-set', `<div class="lab"><span>${s.label}</span><span class="v"></span></div><div class="ctl"><div class="arrow l">◁</div><div class="pips"></div><div class="arrow r">▷</div></div>${s.key === 'quality' ? '<div class="note"></div>' : ''}`);
      e.querySelector('.l').addEventListener('click', () => { this.setSel = i; this.adjust(-1); });
      e.querySelector('.r').addEventListener('click', () => { this.setSel = i; this.adjust(1); });
      e.addEventListener('mouseenter', () => { this.setSel = i; this.renderSettings(); });
      if (s.key === 'quality') e.querySelector('.note').addEventListener('click', () => this.settings.qualityPending && this.settings.applyQualityReload());
      sets.appendChild(e);
      return e;
    });
    this.select(0);
    this.renderSettings();
  }

  select(i) {
    this.sel = i;
    this.itemEls.forEach((e, j) => e.classList.toggle('sel', j === i));
    const it = this.items[i];
    this.showPanel(it.panel || 'main');
  }

  showPanel(p) {
    this.panel = p;
    this.menu.querySelectorAll('.panel').forEach((e) => e.classList.toggle('on', e.dataset.p === p));
    this.menu.querySelectorAll('.tabs span').forEach((e) => e.classList.toggle('on', e.dataset.t === p));
  }

  activate(i) {
    const it = this.items[i];
    if (it.act) it.act();
    else { this.select(i); this.tab = it.panel; this.renderSettings(); }
  }

  adjust(dir) {
    const s = SETTINGS[this.setSel]; const v = this.settings.get(s.key);
    let nv = v;
    if (s.type === 'bool') nv = !v;
    else if (s.type === 'enum') { const i = s.options.indexOf(v); nv = s.options[Math.max(0, Math.min(s.options.length - 1, i + dir))]; }
    else nv = Math.round(Math.max(s.min, Math.min(s.max, v + dir * s.step)) * 100) / 100;
    if (nv !== v) this.settings.set(s.key, nv);
    this.renderSettings();
  }

  renderSettings() {
    SETTINGS.forEach((s, i) => {
      const e = this.setEls[i]; const v = this.settings.get(s.key);
      e.classList.toggle('sel', this.tab === 'settings' && i === this.setSel);
      e.querySelector('.v').textContent = s.type === 'bool' ? (v ? 'ON' : 'OFF') : s.fmt(v);
      let n = 8, on = 0;
      if (s.type === 'bool') { n = 2; on = v ? 2 : 1; }
      else if (s.type === 'enum') { n = s.options.length; on = s.options.indexOf(v) + 1; }
      else { n = 10; on = Math.round(((v - s.min) / (s.max - s.min)) * 10); }
      const pips = e.querySelector('.pips');
      if (s.type === 'bool') { pips.innerHTML = `<b class="${v ? '' : 'on'}">OFF</b><b class="${v ? 'on' : ''}">ON</b>`; pips.classList.add('bool'); }
      else pips.innerHTML = Array.from({ length: n }, (_, j) => `<i class="${j < on ? 'on' : ''}"></i>`).join('');
      if (i === this.setSel) this.menu.querySelector('.desc').innerHTML = `<b>${s.label}</b>${s.desc || ''}`;
      if (s.key === 'quality') e.querySelector('.note').textContent = this.settings.qualityPending ? `▶ RESTART REQUIRED — PRESS [ENTER] OR CLICK TO APPLY ${v.toUpperCase()}` : `ACTIVE PRESET: ${this.settings.activeQuality.toUpperCase()}`;
    });
  }

  updateStats(s) {
    const q = (c) => this.menu.querySelector(c);
    q('.st-ed').textContent = `€$ ${Math.round(s.eddies).toLocaleString('en-US')}`;
    q('.st-gigs').textContent = String(s.gigs);
    q('.st-cred').textContent = String(s.cred);
    q('.st-zone').textContent = s.zone || '—';
    q('.st-gig').textContent = s.gig || '—';
    if (s.journal) {
      q('.journal').innerHTML = s.journal.map((g) => `<div class="jr ${g.status}"><span class="st">${{ done: '✓', active: '◆', locked: '·' }[g.status]}</span><span class="tt">${g.title}</span><span class="ar">${g.area}</span><span class="rw">${g.status === 'locked' ? '???' : '€$ ' + g.reward.toLocaleString('en-US')}</span></div>`).join('');
    }
    const t = Math.floor(s.time); q('.st-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  onKey(e) {
    if (document.querySelector('.nk-aibridge.open')) return;
    const state = this.cb.state();
    if (state === 'title') {
      if (e.code === 'Escape' || e.code === 'KeyB' || e.repeat) return;
      this.cb.start();
      return;
    }
    if (state !== 'paused') return;
    if (this.tab === 'settings') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.setSel = (this.setSel + SETTINGS.length - 1) % SETTINGS.length; this.renderSettings(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.setSel = (this.setSel + 1) % SETTINGS.length; this.renderSettings(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.adjust(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.adjust(1);
      else if (e.code === 'Enter') { if (SETTINGS[this.setSel].key === 'quality' && this.settings.qualityPending) this.settings.applyQualityReload(); else this.adjust(1); }
      else if (e.code === 'Escape' || e.code === 'Backspace') { this.tab = 'main'; this.renderSettings(); e.stopImmediatePropagation(); this.cb.consumeEsc(); }
      return;
    }
    if (this.tab === 'controls') {
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Enter') { this.tab = 'main'; e.stopImmediatePropagation(); this.cb.consumeEsc(); }
      return;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') this.select((this.sel + this.items.length - 1) % this.items.length);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.select((this.sel + 1) % this.items.length);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') this.activate(this.sel);
  }

  openPause() { this.tab = 'main'; this.select(0); this.renderSettings(); }
}
