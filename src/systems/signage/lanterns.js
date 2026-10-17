// Chōchin paper lanterns (Blender models), andon floor lanterns on the river promenade.
// All lanterns are merged into 2 meshes (paper + caps) and sway in the vertex shader around their hang point.
import * as THREE from 'three/webgpu';
import {
  attribute, texture, uv, float, vec2, vec3, vec4, sin, cos, fract, step, mix, smoothstep, clamp, positionLocal, select, normalLocal, abs,
} from 'three/tsl';
import { Batch } from './batch.js';
import { uTime, uWind } from './materials.js';
import { mulberry32 } from './util.js';

function meshes(gltf) {
  const out = {};
  gltf?.scene.traverse((o) => { if (o.isMesh) out[o.name] = o; });
  return out;
}

function swayPosition() {
  const pivot = attribute('pivot', 'vec3');
  const lp = attribute('lp', 'vec4'); // seed, glow, swayAmp, kind
  const t = uTime;
  const s = lp.x;
  const amp = lp.z.mul(uWind.mul(0.6).add(0.3));
  const ax = sin(t.mul(1.13).add(s.mul(2.1))).mul(0.07).add(sin(t.mul(2.71).add(s.mul(5.3))).mul(0.025)).mul(amp);
  const az = sin(t.mul(0.93).add(s.mul(3.7))).mul(0.06).add(sin(t.mul(2.3).add(s.mul(1.3))).mul(0.02)).mul(amp);
  const rel = positionLocal.sub(pivot).toVar();
  // rotate about X then Z (small angles)
  const y1 = rel.y.mul(cos(ax)).sub(rel.z.mul(sin(ax)));
  const z1 = rel.y.mul(sin(ax)).add(rel.z.mul(cos(ax)));
  const x2 = rel.x.mul(cos(az)).sub(y1.mul(sin(az)));
  const y2 = rel.x.mul(sin(az)).add(y1.mul(cos(az)));
  return pivot.add(vec3(x2, y2, z1));
}

export async function buildLanterns(ctx, L, colorTex, pool, featured) {
  const { scene, assets, layout } = ctx;
  const [gC, gT, gA, paperTex] = await Promise.all([
    assets.gltf('models/signage/chochin.glb'), assets.gltf('models/signage/chochin_tall.glb'), assets.gltf('models/signage/andon.glb'),
    assets.texture('textures/signage/lantern_paper.png', { srgb: true }),
  ]);
  const C = meshes(gC), T = meshes(gT), A = meshes(gA);
  const rnd = mulberry32(777);
  const paper = new Batch({ pivot: 3, cell: 4, lp: 4 });
  const caps = new Batch({ pivot: 3, cell: 4, lp: 4 });
  const wires = new Batch({ pivot: 3, cell: 4, lp: 4 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const cellOf = (t) => { const r = L.lanternCells[t] || L.lanternCells['杭']; const uvr = r.uv; return [uvr[0], uvr[1], uvr[2] - uvr[0], uvr[3] - uvr[1]]; };
  let seed = 1;
  let lightCount = 0;

  const hang = (src, pos, yaw, text, s = 1, glow = 1, kind = 0, swayAmp = 1) => {
    if (!src.paper) return;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m4.compose(pos, q, sc.set(s, s, s));
    const a = { pivot: [pos.x, pos.y, pos.z], cell: cellOf(text), lp: [seed++, glow, swayAmp, kind] };
    paper.geometry(src.paper.geometry, m4, a);
    caps.geometry(src.caps.geometry, m4, a);
  };

  const wire = (a, b, sag = 0, r = 0.008) => {
    const N = sag > 0 ? 10 : 1;
    let prev = a.clone();
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t);
      const d = p.clone().sub(prev); const len = d.length();
      const z = d.clone().normalize();
      const x = Math.abs(z.y) < 0.9 ? new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize() : new THREE.Vector3(1, 0, 0);
      const y = new THREE.Vector3().crossVectors(z, x);
      const c = prev.clone().add(p).multiplyScalar(0.5);
      wires.box(c, [x, y, z], [r, r, len / 2], { pivot: [c.x, c.y, c.z], cell: [0, 0, 0, 0], lp: [0, 0, 0, 0] });
      prev = p;
    }
  };

  // yaw so that lantern local Z (kanji direction) points along n
  const yawFor = (n) => Math.atan2(n.x, n.z);

  // rows under awnings
  for (const row of featured.lanternRows) {
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), row.p1.clone().sub(row.p0)).normalize();
    // normal should point away from wall: rows are built from facade right; cross(up, right) = -normal → flip
    n.negate();
    wire(row.p0.clone().setY(row.p0.y + 0.18), row.p1.clone().setY(row.p1.y + 0.18), 0, 0.012);
    for (let i = 0; i < row.count; i++) {
      const t = row.count === 1 ? 0.5 : i / (row.count - 1);
      const p = row.p0.clone().lerp(row.p1, t);
      p.y += 0.18;
      hang(C, p, yawFor(row.p1.clone().sub(row.p0).normalize()), row.texts[i % row.texts.length], row.scale * rnd.range(0.95, 1.05), rnd.range(0.9, 1.1), 0, 0.8);
      if (i % 2 === 0) {
        pool.add({ pos: p.clone().add(new THREE.Vector3(0, -0.5, 0)).addScaledVector(n, 0.3), color: [1, 0.22, 0.06], intensity: 3.5, distance: 7, seed: 1, ftype: 0, importance: 2 });
        lightCount++;
      }
    }
  }
  // strings across the alley (catenary wire, lanterns hang on short cords)
  const textsA = ['杭', '茶', '酒', '西湖', '龙井', '知味'];
  for (const s of featured.lanternStrings) {
    wire(s.a, s.b, s.sag, 0.006);
    for (let i = 0; i < s.count; i++) {
      const t = (i + 0.5) / s.count;
      const p = s.a.clone().lerp(s.b, t); p.y -= s.sag * 4 * t * (1 - t);
      const dir = s.b.clone().sub(s.a); dir.y = 0; dir.normalize();
      const n = new THREE.Vector3(-dir.z, 0, dir.x);
      hang(C, p, yawFor(n), rnd.pick(textsA), rnd.range(0.75, 0.9), rnd.range(0.8, 1.1), 0, 1.4);
    }
    const mid = s.a.clone().lerp(s.b, 0.5); mid.y -= s.sag + 0.6;
    pool.add({ pos: mid, color: [1, 0.25, 0.07], intensity: 4, distance: 8, seed: 1, ftype: 0, importance: 1.6 });
    lightCount++;
  }
  // tall cylindrical lanterns (叫花鸡)
  for (const tl of featured.tallLanterns) {
    const p = tl.pos.clone(); p.y += 1.95;
    hang(T, p, Math.PI / 2, tl.text, 1, 1.1, 1, 0.25);
    pool.add({ pos: tl.pos.clone().add(new THREE.Vector3(0, 0.6, 0.6)), color: [1, 0.25, 0.06], intensity: 6, distance: 9, seed: 1, ftype: 0, importance: 3 });
    lightCount++;
  }

  // andon floor lanterns along the promenade (static: sway amp 0, kind 2 = warm white paper)
  const andon = new Batch({ pivot: 3, cell: 4, lp: 4 });
  const andonFrame = new Batch({ pivot: 3, cell: 4, lp: 4 });
  if (A.paper) {
    const pr = layout.promenade;
    let k = 0;
    for (let z = pr.zStart - 8.5; z > pr.zEnd; z -= 18) {
      if (layout.bridges.some((b) => Math.abs(b.z - z) < 8)) continue;
      const pos = new THREE.Vector3(pr.xMax - 0.9, pr.y, z);
      m4.compose(pos, q.identity(), sc.set(1, 1, 1));
      const a = { pivot: [pos.x, pos.y, pos.z], cell: cellOf('杭'), lp: [seed++, 1, 0, 2] };
      andon.geometry(A.paper.geometry, m4, a);
      andonFrame.geometry(A.frame.geometry, m4, a);
      if (k++ % 1 === 0) { pool.add({ pos: pos.clone().add(new THREE.Vector3(0, 0.55, 0)), color: [1, 0.68, 0.38], intensity: 2.5, distance: 7, seed: 1, ftype: 0, importance: 1.2 }); lightCount++; }
      const col = ctx.physics?.RAPIER && ctx.physics.world.createCollider(ctx.physics.RAPIER.ColliderDesc.cuboid(0.2, 0.45, 0.2).setTranslation(pos.x, pos.y + 0.45, pos.z));
    }
  }

  // ---- materials
  const lp = attribute('lp', 'vec4');
  const cell = attribute('cell', 'vec4');
  const u = uv();
  const paperMat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  paperMat.positionNode = swayPosition();
  const kind = lp.w;
  const pt = paperTex ? texture(paperTex, vec2(u.x.mul(3.0), u.y.mul(select(kind.greaterThan(0.5), float(2.4), float(1.0))))).rgb : vec3(0.8, 0.1, 0.05);
  // kanji: two copies around (front/back); andon (kind 2) uses its box uv -> no ink
  const uu = fract(u.x.mul(2.0)).sub(0.25).div(0.5);
  const v = float(1).sub(u.y); // glTF uv origin is top-left
  const vv = select(kind.greaterThan(0.5).and(kind.lessThan(1.5)), v.sub(0.1).div(0.8), v.sub(0.2).div(0.6));
  const inCell = step(0.0, uu).mul(step(uu, 1.0)).mul(step(0.0, vv)).mul(step(vv, 1.0));
  const ink = float(1).sub(texture(colorTex, cell.xy.add(vec2(clamp(uu, 0.0, 1.0), clamp(vv, 0.0, 1.0)).mul(cell.zw))).r).mul(inCell).mul(select(kind.greaterThan(1.5), float(0), float(1)));
  // inner bulb: brightest at the middle, ribs (paper texture lines) darker
  const prof = select(kind.greaterThan(1.5), float(1.0), sin(v.mul(Math.PI)).pow(1.6));
  // bamboo rib shadow lines
  const ribN = select(kind.greaterThan(0.5), float(34.0), float(16.0));
  const rib = smoothstep(0.0, 0.22, abs(fract(v.mul(ribN)).sub(0.5)).mul(2.0)).mul(0.35).add(0.65);
  // andon (kind 2): bleached washi instead of red paper
  const ptA = select(kind.greaterThan(1.5), vec3(pt.r.mul(0.35).add(0.62)), pt);
  const paperLin = ptA.mul(ptA);
  const warm = select(kind.greaterThan(1.5), vec3(1.0, 0.82, 0.55), vec3(1.0, 1.0, 1.0));
  const hot = vec3(1.0, 0.42, 0.12).mul(prof.pow(4.0)).mul(0.35);
  const glow = paperLin.mul(warm).mul(prof.mul(2.0).add(0.12)).add(hot).mul(lp.y).mul(float(1).sub(ink.mul(0.96))).mul(select(kind.greaterThan(1.5), float(1), rib));
  paperMat.colorNode = paperLin.mul(0.25).mul(float(1).sub(ink.mul(0.9)));
  paperMat.emissiveNode = glow.mul(select(kind.greaterThan(1.5), float(1.6), float(1.7)));
  paperMat.roughnessNode = float(0.7);
  paperMat.metalnessNode = float(0);

  const capMat = new THREE.MeshStandardNodeMaterial();
  capMat.positionNode = swayPosition();
  capMat.colorNode = vec3(0.015, 0.012, 0.01);
  capMat.roughnessNode = float(0.3);
  capMat.metalnessNode = float(0.1);

  const wireMat = new THREE.MeshStandardNodeMaterial({ color: 0x050505, roughness: 0.6, metalness: 0.2 });
  const frameMat = new THREE.MeshStandardNodeMaterial({ color: 0x1a0e08, roughness: 0.55, metalness: 0 });

  const add = (b, m, name) => { if (!b.count) return; const mesh = new THREE.Mesh(b.build(), m); mesh.name = name; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; scene.add(mesh); };
  add(paper, paperMat, 'lantern_paper');
  add(caps, capMat, 'lantern_caps');
  add(wires, wireMat, 'lantern_wires');
  add(andon, paperMat, 'andon_paper');
  add(andonFrame, frameMat, 'andon_frame');
  console.log(`[signage] lanterns: ${seed - 1} (lights ${lightCount})`);
  return { update() {} };
}
