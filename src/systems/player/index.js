// Player workstream: character controller, cameras, vehicle hookup, HUD, menus and the gig loop.
import * as THREE from 'three/webgpu';
import { PlayerController } from './controller.js';
import { createAvatar } from './avatar.js';
import { createZones } from './zones.js';
import { Gigs } from './gigs.js';
import { Settings } from './settings.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function addSafetyGround(ctx) {
  const { RAPIER, world } = ctx.physics;
  // Large safety floor whose top is at y = 0 (street level). Other systems add the real geometry colliders.
  // Tiled (300 m tiles): a single multi-km cuboid breaks Rapier's character-controller shape casts (precision loss → sinking).
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const T = 150;
  for (let x = -750 + T; x < 750; x += 2 * T) {
    for (let z = -1050 + T; z < 450; z += 2 * T) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(T, 0.5, T).setTranslation(x, -0.5, z).setFriction(0.9), body);
    }
  }
}

function carPosition(car) {
  if (!car) return null;
  return car.position?.isVector3 ? car.position : car.object?.position || car.mesh?.position || car.group?.position || null;
}
const CN_CAR_NAMES = {
  hero: '西子智驾·凌波超跑',
  kei: '江南轻型代步车',
  taxi: '钱塘礼宾出租',
  van: '武林货运厢车',
  av: '雷峰重工·浮空艇',
};
function cnCarName(car) {
  if (!car) return '智能载具';
  const raw = (car.name || car.model || car.type || '').toString().toLowerCase();
  for (const [k, v] of Object.entries(CN_CAR_NAMES)) if (raw.includes(k)) return v;
  return (car.name || car.model || '智能载具').toString();
}

export default {
  async init(ctx) {
    this.ctx = ctx;
    addSafetyGround(ctx);
    const sp = ctx.layout.spawn.position;
    this.object = new THREE.Group();
    this.object.name = 'player';
    this.object.position.set(sp[0], 0, sp[2]);
    ctx.scene.add(this.object);
    const api = { object: this.object, mode: 'foot', view: 'fp', state: ctx.isShot ? 'shot' : 'title', position: this.object.position };
    ctx.api.player = api;
    this.api = api;
    if (ctx.isShot) return; // never touch the camera / DOM in screenshot mode

    this.settings = new Settings(ctx.quality);
    ctx.settings = this.settings;
    ctx.quality = this.settings.activeQuality;
    this.ctrl = new PlayerController(ctx, this.settings);
    this.zones = createZones(ctx.layout);

    const [{ HUD }, { Menus }] = await Promise.all([import('../../ui/hud.js'), import('../../ui/menus.js')]);
    this.hud = new HUD(ctx, this.settings);
    this.menus = new Menus(this.hud.root, this.settings, {
      start: () => this.start(),
      resume: () => this.resume(true),
      quitToTitle: () => this.toTitle(),
      state: () => this.state,
      consumeEsc: () => {},
    });
    this.fader = document.createElement('div');
    Object.assign(this.fader.style, { position: 'absolute', inset: '0', background: '#000', opacity: '0', transition: 'opacity .5s', pointerEvents: 'none' });
    this.hud.root.appendChild(this.fader);
    this.dmg = document.createElement('div');
    Object.assign(this.dmg.style, { position: 'absolute', inset: '0', opacity: '0', pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(255,0,30,0) 45%, rgba(255,20,40,.55) 100%)', transition: 'opacity .2s' });
    this.hud.root.appendChild(this.dmg);

    // Avatar: prefer crowd's character factory, else our placeholder
    this.avatar = null;
    try {
      const c = ctx.api.crowd?.createCharacter?.({ sex: 'male', outfit: 'm_techwear', seed: 2077, tint: 0, hairTint: 5 });
      const obj = c && (c.isObject3D ? c : c.object || c.mesh || c.group);
      if (obj) this.avatar = this.wrapCrowdCharacter(c, obj);
    } catch (e) { console.warn('[player] crowd.createCharacter failed, using placeholder', e); }
    if (!this.avatar) this.avatar = createAvatar();
    this.object.add(this.avatar.object);
    this.avatar.object.visible = false;

    this.gigs = new Gigs(ctx, this.hud);
    this.hud.newGig(this.gigs.current, true);

    // state
    this.state = 'title';
    this.hud.root.classList.add('state-title');
    this.titleT = 0;
    this.blend = 0; // title → gameplay camera blend
    this.titleCam = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    this.zone = null; this.zoneCand = null; this.zoneT = 0;
    this.prompt = null;
    this.hp = 100; this.ram = 8; this.hurtT = 10;
    this.playTime = 0;
    this.car = null; this.carSpeed = 0; this.carPrev = new THREE.Vector3();
    this.hadLock = false; this.pausedAt = 0;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    ctx.cameraMode = 'title';
    this.ctrl.placed = false;

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === ctx.renderer.domElement;
      if (locked) {
        this.hadLock = true;
        if (this.hud?.aiBridge?.open) this.hud.aiBridge.toggle(false);
      } else if (this.state === 'playing' && this.hadLock && !ctx.uiModalOpen) {
        this.pause();
      }
    });
    ctx.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing' && !ctx.uiModalOpen && !document.pointerLockElement) {
        this.lockPointer();
      }
    });
    addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.hud?.aiBridge?.open) { this.hud.aiBridge.toggle(false); return; }
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' && performance.now() - this.pausedAt > 300) this.resume(false);
    });
    addEventListener('keydown', (e) => { if (e.code === 'Tab') e.preventDefault(); });

    window.__player = {
      get state() { return api.state; },
      start: () => this.start(),
      pause: () => this.pause(),
      resume: () => this.resume(false),
      setYaw: (y, p = 0) => { this.ctrl.yaw = y; this.ctrl.pitch = p; },
      teleport: (x, y, z, yaw) => this.ctrl.placeAt(x, y, z, yaw),
      completeGig: () => this.gigs.complete(),
      ctrl: this.ctrl, gigs: this.gigs, hud: this.hud,
    };
  },

  // Adapts a crowd-system skinned character ({ object, play(name, fade), actions, clipInfo, update(dt) }) to our avatar API.
  // Crowd characters face +Z at yaw 0; our convention is -Z, so the mesh is flipped inside a wrapper.
  wrapCrowdCharacter(c, obj) {
    const root = new THREE.Group(); root.name = 'player-avatar';
    const lean = new THREE.Group(); root.add(lean);
    obj.rotation.y = Math.PI;
    obj.position.y = c.sole || 0;
    lean.add(obj);
    const info = c.clipInfo || {};
    const has = (n) => !!c.actions?.[n];
    let crouchK = 0, leanK = 0, airK = 0;
    // protagonist look: CP-yellow trim glow (dimmed) instead of the random crowd trim colour
    obj.traverse((o) => { if (o.isMesh && (o.userData.matName || o.material?.name || '').startsWith('trim')) o.userData.tint = new THREE.Color(0.32, 0.24, 0.02); });
    let cur = has('idle') ? 'idle' : Object.keys(c.actions || {})[0];
    let cand = cur, candT = 0;
    c.play?.(cur, 0);
    return {
      object: root,
      update(dt, st) {
        const s = st.speed;
        let want = 'idle';
        if (s > 0.35) want = s < 1.6 && has('walk_slow') ? 'walk_slow' : s < 3.2 || !has('walk_fast') ? 'walk' : 'walk_fast';
        if (!has(want)) want = has('walk') ? 'walk' : want;
        // hysteresis: avoid stacking cross-fades (partial weights blend toward the bind/A-pose)
        if (want !== cand) { cand = want; candT = 0; }
        candT += dt;
        if (cand !== cur && (candT > 0.18 || cur === 'idle')) { cur = cand; c.play?.(cur, 0.3); }
        const clip = cur;
        const a = c.actions?.[clip];
        const natural = info[clip]?.speed || 1.4;
        if (a) a.timeScale = clip.startsWith('idle') ? 1 : Math.max(0.6, Math.min(2.6, s / natural));
        crouchK += ((st.crouch ? 1 : 0) - crouchK) * Math.min(1, dt * 10);
        leanK += (Math.min(1, s / 7.8) - leanK) * Math.min(1, dt * 6);
        airK += ((st.grounded ? 0 : 1) - airK) * Math.min(1, dt * 8);
        // sprint lean + crouch squash (approximate — the crowd rig has no crouch/run clips)
        lean.rotation.x = -leanK * 0.22 - crouchK * 0.18;
        lean.position.y = -crouchK * 0.42 + airK * 0.05;
        lean.scale.y = 1 - crouchK * 0.12;
        c.update?.(dt);
      },
    };
  },

  lockPointer() {
    const c = this.ctx.renderer.domElement;
    try { const p = c.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* not allowed */ }
  },

  start() {
    if (this.state !== 'title') return;
    this.hud.root.classList.add('title-leaving');
    this.state = 'starting';
    this.api.state = 'playing';
    this.lockPointer();
    this.titleCam.pos.copy(this.ctx.camera.position); this.titleCam.quat.copy(this.ctx.camera.quaternion);
    this.blend = 0.0001;
    if (!this.ctrl.placed) { const sp = this.ctx.layout.spawn; this.ctrl.placeAt(sp.position[0], 0.5, sp.position[2], sp.yaw || 0); this.ctrl.placed = true; }
    setTimeout(() => {
      this.hud.root.classList.remove('state-title', 'title-leaving');
      this.state = 'playing';
      this.ctx.cameraMode = 'player';
      this.zone = null; this.zoneT = 0.6;
    }, 1400);
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.api.state = 'paused'; this.ctx.paused = true;
    this.pausedAt = performance.now();
    this.menus.openPause();
    this.menus.updateStats({ eddies: this.gigs.eddies, gigs: this.gigs.completed, cred: this.gigs.cred, zone: this.zone?.area, gig: this.gigs.state === 'active' ? this.gigs.current.title : 'WAITING FOR CALL', time: this.playTime, journal: this.gigs.journal() });
    this.hud.root.classList.add('state-paused');
    if (document.pointerLockElement) document.exitPointerLock?.();
  },

  resume(fromClick) {
    if (this.state !== 'paused') return;
    this.state = 'playing'; this.api.state = 'playing'; this.ctx.paused = false;
    this.hud.root.classList.remove('state-paused');
    if (fromClick) this.lockPointer();
  },

  toTitle() {
    if (this.car) this.exitCar();
    this.state = 'title'; this.api.state = 'title'; this.ctx.paused = false;
    this.hud.root.classList.remove('state-paused');
    this.hud.root.classList.add('state-title');
    this.ctx.cameraMode = 'title';
    this.titleT = 0;
  },

  fade(cb) {
    this.fader.style.opacity = '1';
    setTimeout(() => { cb(); setTimeout(() => { this.fader.style.opacity = '0'; }, 250); }, 520);
  },

  enterCar(car) {
    const veh = this.ctx.api.vehicles;
    try { veh.enter(car); } catch (e) { console.warn('[player] vehicles.enter failed', e); return; }
    this.car = car;
    this.api.mode = 'car';
    this.ctx.cameraMode = 'car';
    this.ctrl.setEnabled(false);
    this.avatar.object.visible = false;
    const p = carPosition(veh.activeCar || car);
    if (p) this.carPrev.copy(p);
    this.carSpeed = 0;
    this.hud.toast({ kind: 'info', k: 'VEHICLE LINK ESTABLISHED', h: (car.name || car.model || 'VEHICLE').toString().toUpperCase(), body: '<span>[F] EXIT · [W/S] THROTTLE · [A/D] STEER</span>' }, 3000);
  },

  exitCar() {
    const veh = this.ctx.api.vehicles;
    const car = veh?.activeCar || this.car;
    let out = null;
    try { out = veh?.exit?.(); } catch (e) { console.warn('[player] vehicles.exit failed', e); }
    const obj = carObject(car);
    const p = carPosition(car);
    let x = this.ctrl.feet.x, z = this.ctrl.feet.z, y = this.ctrl.feet.y;
    if (out && (out.isVector3 || out.x !== undefined)) { x = out.x; y = out.y ?? y; z = out.z; }
    else if (p) {
      // driver side (local -X), fall back to passenger side / behind if blocked
      const q = obj ? obj.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
      const cands = [[-2.0, 0, 0.2], [2.0, 0, 0.2], [0, 0, 3.6], [0, 0, -3.6]];
      let chosen = null;
      for (const c of cands) {
        const off = new THREE.Vector3(...c).applyQuaternion(q);
        const from = { x: p.x, y: p.y + 1.0, z: p.z };
        const len = off.length(); off.normalize();
        const hit = this.ctx.physics.world.castShape(from, { x: 0, y: 0, z: 0, w: 1 }, off, this.ctrl.ball, 0, len, true, undefined, undefined, undefined, undefined, (col) => !this.isCarCollider(col, obj));
        if (!hit) { chosen = new THREE.Vector3(p.x + off.x * len, p.y, p.z + off.z * len); break; }
      }
      if (!chosen) chosen = new THREE.Vector3(p.x, p.y + 2.5, p.z);
      x = chosen.x; y = chosen.y; z = chosen.z;
      if (obj) { const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); this.ctrl.yaw = Math.atan2(-fwd.x, -fwd.z); }
    }
    this.car = null;
    this.api.mode = 'foot';
    this.ctx.cameraMode = 'player';
    this.ctrl.setEnabled(true);
    this.ctrl.placeAt(x, y + 0.5, z);
  },

  isCarCollider(col, obj) {
    const body = col.parent?.();
    const ud = body?.userData || col.userData;
    if (ud && obj && (ud.object === obj || ud === obj)) return true;
    return false;
  },

  readInput(ctx) {
    const i = ctx.input;
    return {
      fwd: (i.down('KeyW') || i.down('ArrowUp') ? 1 : 0) - (i.down('KeyS') || i.down('ArrowDown') ? 1 : 0),
      right: (i.down('KeyD') || i.down('ArrowRight') ? 1 : 0) - (i.down('KeyA') || i.down('ArrowLeft') ? 1 : 0),
      sprint: i.down('ShiftLeft') || i.down('ShiftRight'),
      crouchHeld: i.down('KeyC') || i.down('ControlLeft'),
      jump: i.justPressed('Space'),
    };
  },

  titleCamera(dt, cam) {
    this.titleT += dt;
    const t = this.titleT;
    const sp = this.ctx.layout.spawn.position;
    const z = sp[2] + 14 - (t * 0.9) % 40;
    cam.position.set(sp[0] - 1.2 + Math.sin(t * 0.13) * 1.2, 3.2 + Math.sin(t * 0.21) * 0.4, z);
    this._v.set(0.6 + Math.sin(t * 0.07) * 3, 7.5, z - 80);
    cam.lookAt(this._v);
    cam.rotateZ(Math.sin(t * 0.17) * 0.012);
    if (Math.abs(cam.fov - 50) > 0.01) { cam.fov = 50; cam.updateProjectionMatrix(); }
  },

  update(dt, t, ctx) {
    if (ctx.isShot || !this.ctrl) return;
    const cam = ctx.camera;
    const input = ctx.input;
    const ctrl = this.ctrl;
    const veh = ctx.api.vehicles;

    if (this.state === 'title') { this.titleCamera(dt, cam); this.hud.update(dt, this.hudState(ctx)); return; }

    const playing = this.state === 'playing' || this.state === 'starting';
    if (this.state === 'playing') this.playTime += dt;

    // mouse look (pointer-locked)
    if (playing && this.api.mode === 'foot') ctrl.look(input.mouse.dx, input.mouse.dy);

    // toggles
    if (this.state === 'playing') {
      if (input.justPressed('KeyV') && this.api.mode === 'foot') ctrl.toggleView();
      if (input.justPressed('KeyH')) this.settings.set('hud', !this.settings.get('hud'));
    }

    let events = [];
    if (this.api.mode === 'foot') {
      const inp = playing && this.state === 'playing' ? this.readInput(ctx) : { fwd: 0, right: 0, sprint: false, crouchHeld: false, jump: false };
      // sub-step on long frames for stable collision
      const n = Math.max(1, Math.min(6, Math.ceil(dt * 60 - 0.25)));
      for (let s = 0; s < n; s++) events = events.concat(ctrl.step(dt / n, { ...inp, jump: inp.jump && s === 0 }));
      this.object.position.copy(ctrl.feet);
      ctrl.updateCamera(dt, cam, t);
      // avatar
      const av = this.avatar;
      av.object.visible = ctrl.viewK > 0.35 && ctrl.armLen > 0.85; // hide when the spring arm is squeezed into the head
      if (av.object.visible) {
        if (ctrl.speed > 0.3) this.avYaw = damp(this.avYaw ?? ctrl.yaw, this.angleNear(Math.atan2(-ctrl.vel.x, -ctrl.vel.z), this.avYaw ?? ctrl.yaw), 10, dt);
        else this.avYaw = this.avYaw ?? ctrl.yaw;
        av.object.rotation.y = this.avYaw;
        av.object.position.y = ctrl.camY - ctrl.feet.y;
        av.update(dt, { speed: ctrl.speed, grounded: ctrl.grounded, crouch: ctrl.crouch, sprint: ctrl.sprinting });
      }
      for (const e of events) {
        ctx.events.dispatchEvent(new CustomEvent(`player-${e.type}`, { detail: e }));
        if (e.type === 'land' && e.impact > 13) this.hurt((e.impact - 13) * 7);
      }
    } else {
      // in a car — vehicles system drives, we follow with its chase camera
      const car = veh?.activeCar || this.car;
      const p = carPosition(car);
      if (p) {
        const sp = dt > 0 ? this._w.subVectors(p, this.carPrev).length() / dt : 0;
        this.carSpeed = damp(this.carSpeed, Math.min(typeof car.speed === 'number' ? Math.abs(car.speed) : sp, 120), 8, dt);
        this.carPrev.copy(p);
        this.object.position.copy(p);
        ctrl.feet.copy(p);
      }
      if (typeof veh?.updateChaseCamera === 'function') veh.updateChaseCamera(cam, dt);
      else if (car) this.fallbackChase(dt, cam, car);
      if (Math.abs(cam.fov - ctrl.fov) > 0.01 && typeof veh?.updateChaseCamera !== 'function') { cam.fov = ctrl.fov; cam.updateProjectionMatrix(); }
    }

    // title → gameplay camera blend
    if (this.blend > 0 && this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 1.6);
      const k = ease(this.blend);
      cam.position.lerpVectors(this.titleCam.pos, cam.position, k);
      cam.quaternion.slerpQuaternions(this.titleCam.quat, cam.quaternion, k);
    }

    // interaction prompts
    this.prompt = null;
    if (this.state === 'playing') {
      const gp = this.gigs.update(dt, t, ctrl.feet, this.api.mode);
      if (this.api.mode === 'car') {
        if (input.justPressed('KeyF')) this.exitCar();
      } else if (gp) {
        this.prompt = { key: gp.key, text: gp.text, sub: 'SERVICE ACCESS' };
        if (input.justPressed('KeyF')) this.fade(() => { ctrl.placeAt(gp.target[0] - 2, gp.target[1] + 3, gp.target[2] + 2); });
      } else if (veh?.nearestCar) {
        let car = null;
        try { car = veh.nearestCar(ctrl.feet); } catch { car = null; }
        const p = carPosition(car);
        const dist = car && p ? p.distanceTo(ctrl.feet) : 99;
        // only offer the car you're actually facing (or brushing against) — avoids prompt spam along parked rows
        const fwd = cam.getWorldDirection(this._v);
        const facing = p ? ((p.x - ctrl.feet.x) * fwd.x + (p.z - ctrl.feet.z) * fwd.z) / Math.max(0.01, Math.hypot(p.x - ctrl.feet.x, p.z - ctrl.feet.z) * Math.hypot(fwd.x, fwd.z)) : -1;
        if (car && p && Math.abs(p.y - ctrl.feet.y) < 2.5 && (dist < 2.6 || (dist < 5 && facing > 0.55))) {
          const name = (car.name || car.model || '').toString().toUpperCase();
          this.prompt = { key: 'F', text: 'ENTER VEHICLE', sub: name || 'VEHICLE' };
          if (input.justPressed('KeyF')) this.enterCar(car);
        }
      }
    } else if (this.state === 'starting') this.gigs.update(dt, t, ctrl.feet, this.api.mode);

    // districts
    const fp = this.object.position;
    const z = this.zones.at(fp.x, fp.y, fp.z);
    if (this.state === 'playing') {
      if (z !== this.zoneCand) { this.zoneCand = z; this.zoneT = 0; }
      this.zoneT += dt;
      if (this.zoneT > 0.7 && this.zone !== z) { this.zone = z; this.hud.showDistrict(z); }
    }

    // health regen + ram
    this.hurtT += dt;
    if (this.hurtT > 4 && this.hp < 100) this.hp = Math.min(100, this.hp + dt * 6);
    this.dmg.style.opacity = String(Math.max(0, 1 - this.hurtT * 1.5) * 0.9 + (this.hp < 35 ? 0.35 + Math.sin(t * 5) * 0.1 : 0));

    this.api.view = ctrl.view;
    this.hud.update(dt, this.hudState(ctx));
  },

  hurt(amount) {
    this.hp = Math.max(5, this.hp - amount);
    this.hurtT = 0;
    this.hud.sweep();
  },

  angleNear(a, ref) { while (a - ref > Math.PI) a -= Math.PI * 2; while (a - ref < -Math.PI) a += Math.PI * 2; return a; },

  fallbackChase(dt, cam, car) {
    const obj = carObject(car); if (!obj) return;
    const q = obj.getWorldQuaternion(new THREE.Quaternion());
    const p = obj.getWorldPosition(new THREE.Vector3());
    const want = new THREE.Vector3(0, 2.4, 6.5).applyQuaternion(q).add(p);
    cam.position.lerp(want, 1 - Math.exp(-6 * dt));
    cam.lookAt(p.x, p.y + 1.2, p.z);
  },

  hudState(ctx) {
    const ctrl = this.ctrl, cam = ctx.camera;
    const g = this.gigs;
    const active = g.state === 'active' && this.state !== 'title';
    let wp = null, target = null, dist = 0;
    if (active) {
      target = g.worldPos(this._w.clone());
      dist = target.distanceTo(this.object.position);
      const v = target.clone().setY(target.y + 2.5).project(cam);
      const W = innerWidth, H = innerHeight;
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const behind = v.z > 1;
      // off-screen / behind: pin to an ellipse around the screen centre (keeps clear of HUD corners)
      let dx = x - W / 2, dy = y - H / 2;
      if (behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1 && Math.abs(dx) < 1) dy = 1; dy = Math.abs(dy) + H; }
      const rx = W * 0.4, ry = H * 0.36;
      const e = Math.hypot(dx / rx, dy / ry);
      const edge = behind || e > 1;
      if (edge) { dx /= e; dy /= e; }
      x = W / 2 + dx; y = H / 2 + dy;
      const near = dist < 6;
      wp = { x, y, edge, visible: !near };
    }
    const car = ctx.api.vehicles?.activeCar || this.car;
    return {
      pos: this.object.position, yaw: this.api.mode === 'car' ? this.cameraYaw(cam) : ctrl.yaw,
      mode: this.api.mode, view: ctrl.view, speed: ctrl.speed, sprinting: ctrl.sprinting && ctrl.speed > 4.5, crouch: ctrl.crouch,
      zone: this.zone || this.zones.at(this.object.position.x, this.object.position.y, this.object.position.z),
      target, targetDist: dist, gig: active ? g.current : null, wp, prompt: this.prompt,
      rain: ctx.weather?.rain, hp: this.hp, ram: this.ram,
      carSpeed: this.carSpeed, carName: car ? (car.name || car.model || 'VEHICLE').toString().toUpperCase() : '', carReverse: !!car?.reverse,
    };
  },

  cameraYaw(cam) {
    const d = cam.getWorldDirection(this._v);
    return Math.atan2(-d.x, -d.z);
  },
};
