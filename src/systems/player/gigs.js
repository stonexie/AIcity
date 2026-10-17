// Light gameplay loop: fixer "gigs" — waypoint beam in the world, objective text, reward toasts, next gig.
import * as THREE from 'three/webgpu';
import { uv, time, float, sin, abs, smoothstep, normalView, pow, vec3, color, fract, mix, step, positionLocal, atan, length, uniform } from 'three/tsl';

export function makeGigList(L) {
  const al = L.alley, ov = L.overlook, pr = L.promenade, br = L.bridges[0];
  return [
    {
      id: 'ramen', fixer: '苏小小', title: '片儿川暗桩交接', area: '钱塘霓虹大道',
      text: '前往奎元片儿川老面馆门外与信使接头', jp: '片儿川',
      pos: [-(L.avenue.roadHalfWidth + 2.2), 0, -18], reward: 850, cred: 4, radius: 3.2,
    },
    {
      id: 'river', fixer: '苏小小', title: '柳浪闻莺秘钥', area: '柳浪闻莺步道',
      text: '在西湖沿河繁花树下取回加密数据芯片', jp: '西子湖',
      pos: [(pr.xMin + pr.xMax) / 2, pr.y, -120], reward: 2400, cred: 9, radius: 3.5,
    },
    {
      id: 'alley', fixer: '白娘子', title: '河坊街灯笼巷密会', area: '御街灯笼巷',
      text: '拾级而上穿过红灯笼古巷，与黑客会合', jp: '河坊街',
      pos: [al.stairs.xEnd - 6, al.stairs.rise, al.z], reward: 3100, cred: 12, radius: 3.2,
    },
    {
      id: 'overlook', fixer: '白娘子', title: '俯瞰钱塘天际线', area: '钱塘天际观景台',
      text: '搭乘货运升降梯登上顶楼天际观景台', jp: '观景台',
      pos: [ov.position[0], ov.position[1] - 1.7, ov.position[2]], reward: 4200, cred: 15, radius: 4, elevator: true,
    },
    {
      id: 'bridge', fixer: '苏小小', title: '拱宸桥夜渡接应', area: '拱宸映月桥',
      text: '在拱宸映月桥头与中间人的专车司机汇合', jp: '拱宸桥',
      pos: [pr.xMax + 6, 0, br.z + 12], reward: 5600, cred: 20, radius: 4,
    },
  ];
}

export const beamNear = uniform(1);
function beamMaterial(col, gain = 1, nearK = 0.4) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const v = uv().y;
  const edge = pow(float(1).sub(abs(normalView.z)), 1.6);
  const scan = sin(v.mul(420).sub(time.mul(9))).mul(0.5).add(0.5);
  const bands = smoothstep(0.92, 1.0, fract(v.mul(14).sub(time.mul(0.35))));
  const fade = smoothstep(0.0, 0.02, v).mul(float(1).sub(smoothstep(0.25, 1.0, v)));
  const a = edge.mul(0.85).add(0.12).mul(scan.mul(0.35).add(0.65)).add(bands.mul(0.6)).mul(fade);
  const g = mix(float(nearK), float(1), beamNear).mul(gain);
  m.colorNode = col.mul(a).mul(g).mul(3.2);
  m.opacityNode = a.mul(g);
  return m;
}

function ringMaterial(col) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const p = positionLocal.xy;
  const ang = atan(p.y, p.x).div(Math.PI * 2).add(0.5);
  const seg = step(0.35, fract(ang.mul(24).add(time.mul(0.25))));
  const r = length(p);
  const pulse = fract(time.mul(0.6));
  const wave = smoothstep(0.12, 0.0, abs(r.div(2.2).sub(pulse))).mul(float(1).sub(pulse));
  const a = seg.mul(0.8).add(wave.mul(1.2));
  m.colorNode = col.mul(a).mul(3);
  m.opacityNode = a;
  return m;
}

export class Gigs {
  constructor(ctx, hud) {
    this.ctx = ctx; this.hud = hud;
    this.list = makeGigList(ctx.layout);
    this.index = 0;
    this.state = 'active'; // 'active' | 'cooldown'
    this.cooldown = 0;
    this.eddies = 1200;
    this.cred = 0;
    this.completed = 0;
    this.groundY = new Map();

    const col = color(0xffe23a);
    this.marker = new THREE.Group();
    this.marker.name = 'gig-marker';
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 260, 32, 1, true), beamMaterial(col));
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 200, 32, 1, true), beamMaterial(col, 0.28, 0.0));
    halo.position.y = 100; halo.renderOrder = 9; halo.frustumCulled = false;
    beam.position.y = 130; beam.renderOrder = 10; beam.frustumCulled = false;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 260, 8, 1, true), beamMaterial(color(0xfff6c0)));
    core.position.y = 130; core.renderOrder = 10; core.frustumCulled = false;
    const ring = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), ringMaterial(col));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 11;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 6), ringMaterial(color(0xff3b4e)));
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.07; inner.renderOrder = 11;
    // floating diamond glyph
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicNodeMaterial({ color: 0xffe23a, fog: false }));
    dia.material.colorNode = color(0xffe23a).mul(float(5).add(sin(time.mul(4)).mul(2)));
    dia.scale.y = 1.6; dia.position.y = 2.4;
    const light = new THREE.PointLight(0xffd24a, 18, 9, 2);
    light.position.y = 1.2;
    this.marker.add(beam, halo, core, ring, inner, dia, light);
    this.dia = dia; this.innerRing = inner;
    ctx.scene.add(this.marker);
    this.place();
  }

  get current() { return this.list[this.index % this.list.length]; }

  journal() {
    const cur = this.index % this.list.length;
    return this.list.map((g, i) => ({
      title: g.title, area: g.area, reward: g.reward,
      status: i < cur ? 'done' : i === cur ? (this.state === 'active' ? 'active' : 'done') : 'locked',
    }));
  }

  surfaceY(g) {
    if (this.groundY.has(g.id)) return this.groundY.get(g.id);
    const { RAPIER, world } = this.ctx.physics;
    const top = g.pos[1] + 6;
    const hit = world.castRay(new RAPIER.Ray({ x: g.pos[0], y: top, z: g.pos[2] }, { x: 0, y: -1, z: 0 }), 40, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const y = hit ? top - hit.timeOfImpact : g.pos[1];
    this.groundY.set(g.id, y);
    return y;
  }

  place() {
    const g = this.current;
    this.groundY.delete(g.id);
    this.marker.position.set(g.pos[0], g.pos[1], g.pos[2]);
    this.marker.visible = true;
    this.surfaceResolved = false;
  }

  worldPos(out = new THREE.Vector3()) { return out.copy(this.marker.position).setY(this.marker.position.y + 1.4); }

  // Returns interaction prompt (e.g. elevator) or null
  update(dt, t, playerPos, mode) {
    if (!this.surfaceResolved) { this.marker.position.y = this.surfaceY(this.current); this.surfaceResolved = true; }
    const dCam = this.ctx.camera.position.distanceTo(this.marker.position);
    beamNear.value = Math.min(1, Math.max(0, (dCam - 8) / 45));
    this.dia.rotation.y += dt * 1.6;
    this.dia.position.y = 2.4 + Math.sin(t * 2) * 0.15;
    this.innerRing.rotation.z -= dt * 0.8;
    if (this.state === 'cooldown') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) { this.state = 'active'; this.index++; this.place(); this.hud.newGig(this.current); }
      return null;
    }
    const g = this.current;
    const m = this.marker.position;
    const dx = playerPos.x - m.x, dz = playerPos.z - m.z;
    const d2 = Math.hypot(dx, dz);
    const dy = playerPos.y - m.y;
    if (mode === 'foot' && d2 < g.radius && Math.abs(dy) < 2.6) { this.complete(); return null; }
    if (g.elevator && mode === 'foot' && d2 < 34 && dy < -6) return { key: 'F', text: '搭乘观景升降梯', action: 'elevator', target: [m.x, m.y, m.z] };
    return null;
  }

  complete() {
    const g = this.current;
    this.state = 'cooldown';
    this.cooldown = 4.5;
    this.marker.visible = false;
    this.eddies += g.reward; this.cred += g.cred; this.completed++;
    this.hud.gigComplete(g, this.eddies);
    this.ctx.events.dispatchEvent(new CustomEvent('gig-complete', { detail: { id: g.id, reward: g.reward } }));
  }
}
