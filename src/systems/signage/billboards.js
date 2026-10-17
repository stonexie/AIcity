// Giant animated billboards (未来へ A BRIGHTER TOMORROW, KAZE TECH), corner video screens, floating holograms.
import * as THREE from 'three/webgpu';
import {
  texture, uv, float, vec2, vec3, vec4, sin, cos, fract, floor, step, mix, smoothstep, clamp, hash, abs, exp, select, max, min, length,
  mrt, attribute, positionWorld, positionLocal, cameraPosition, normalWorld, dot, pow,
} from 'three/tsl';
import { uTime } from './materials.js';
import { NEON } from './util.js';
import { makeFacade } from './featured.js';

const UP = new THREE.Vector3(0, 1, 0);

// ---- animated anime billboard material
function mkMiraiMaterial(tex) {
  const m = new THREE.MeshStandardNodeMaterial();
  const t = uTime;
  const u0 = uv();
  // slow ken-burns
  const z = sin(t.mul(0.12)).mul(0.015).add(0.975);
  const pan = vec2(sin(t.mul(0.07)).mul(0.006), cos(t.mul(0.05)).mul(0.008));
  let u1 = u0.sub(0.5).mul(z).add(0.5).add(pan);
  // glitch windows (~every 7 s, 0.25 s long)
  const gwin = step(0.86, hash(floor(t.mul(4.0)).add(17))).mul(step(0.5, hash(floor(t.mul(0.5)).add(3))));
  const slice = hash(floor(u0.y.mul(38.0)).add(floor(t.mul(30.0)).mul(57)).add(11)).sub(0.5);
  const off = slice.mul(0.05).mul(gwin);
  const ca = float(0.003).add(gwin.mul(0.012));
  const uR = u1.add(vec2(off.add(ca), 0)), uG = u1.add(vec2(off, 0)), uB = u1.add(vec2(off.sub(ca), 0));
  const r = texture(tex, uR).r, g = texture(tex, uG).g, b = texture(tex, uB).b;
  let col = vec3(r, g, b);
  col = col.mul(col); // sRGB-ish -> linear (texture is loaded as data to keep CA cheap)
  // sakura petals drifting across the screen
  const pu = u0.mul(vec2(9.0, 13.5)).add(vec2(sin(t.mul(0.3)).mul(0.6), t.mul(0.55)));
  const cid = floor(pu);
  const h1 = hash(cid.x.add(cid.y.mul(97)).add(1000));
  const h2 = hash(cid.x.add(cid.y.mul(97)).add(2000));
  const pc = fract(pu).sub(vec2(h1.mul(0.6).add(0.2), h2.mul(0.6).add(0.2)));
  const petal = smoothstep(0.07, 0.02, length(pc.mul(vec2(1.0, 1.6)))).mul(step(0.55, h1));
  col = col.add(vec3(1.0, 0.55, 0.75).mul(petal).mul(0.9));
  // diagonal light sweep + rolling refresh bar + fine LED rows
  const sweep = smoothstep(0.06, 0.0, abs(fract(u0.x.mul(0.6).add(u0.y.mul(0.4)).sub(t.mul(0.07))).sub(0.5))).mul(0.35);
  const roll = exp(abs(fract(u0.y.sub(t.mul(0.18))).sub(0.5)).mul(-40.0)).mul(0.12);
  const rows = sin(u0.y.mul(1536.0 * 3.14159)).mul(0.06).add(0.94);
  const flash = float(1).add(gwin.mul(0.4));
  const e = col.mul(float(1).add(sweep).add(roll)).mul(rows).mul(flash).mul(2.6);
  m.colorNode = vec3(0.01);
  m.emissiveNode = e;
  m.roughnessNode = float(0.5);
  m.metalnessNode = float(0);
  return m;
}

// ---- video screen material: cycles through the 2x2 ad grid with a wipe + scanlines
function mkScreenMaterial(tex) {
  const m = new THREE.MeshStandardNodeMaterial();
  const t = uTime;
  const u0 = uv();
  const sd = attribute('sd', 'vec2'); // seed, intensity
  const period = float(6.0);
  const tt = t.add(sd.x.mul(2.3));
  const idx = floor(tt.div(period));
  const ph = fract(tt.div(period));
  const cellOf = (i) => { const k = fract(i.mul(0.25)).mul(4.0).add(0.01).floor(); return vec2(k.mod(2.0), floor(k.div(2.0))); };
  const ca = cellOf(idx.add(sd.x)), cb = cellOf(idx.add(sd.x).add(1));
  const wipe = smoothstep(0.9, 1.0, ph);
  const showB = step(u0.x, wipe);
  const zoom = ph.mul(0.04).oneMinus();
  const lu = u0.sub(0.5).mul(zoom).add(0.5);
  const sAf = texture(tex, vec2(ca.x.add(lu.x), float(1).sub(ca.y).add(lu.y)).mul(0.5));
  const sBf = texture(tex, vec2(cb.x.add(u0.x), float(1).sub(cb.y).add(u0.y)).mul(0.5));
  const c = mix(sAf.rgb, sBf.rgb, showB);
  const lin = c.mul(c);
  const scan = sin(u0.y.mul(720.0)).mul(0.08).add(0.92);
  const bar = smoothstep(0.02, 0.0, abs(u0.x.sub(wipe))).mul(step(0.9, ph)).mul(3.0);
  m.colorNode = vec3(0.01);
  m.emissiveNode = lin.mul(scan).mul(sd.y).add(vec3(0.6, 0.9, 1.0).mul(bar));
  m.roughnessNode = float(0.35);
  m.metalnessNode = float(0);
  return m;
}

// ---- hologram material (additive, no MRT contribution)
function mkHoloMaterial(tex, tint, cell) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const t = uTime;
  const u0 = uv();
  const flick = step(0.06, hash(floor(t.mul(14.0)).add(5))).mul(0.25).add(0.75);
  const jitter = step(0.95, hash(floor(t.mul(6.0)).add(9))).mul(hash(floor(u0.y.mul(60.0)).add(floor(t.mul(40.0)))).sub(0.5)).mul(0.03);
  const s = texture(tex, vec2(float(cell[0]).add(clamp(u0.x.add(jitter), 0.0, 1.0)), float(1 - cell[1]).add(u0.y)).mul(0.5));
  const lum = dot(s.rgb, vec3(0.3, 0.55, 0.15));
  const lines = sin(u0.y.mul(420.0).sub(t.mul(6.0))).mul(0.5).add(0.5).pow(2.0).mul(0.55).add(0.45);
  const edge = smoothstep(0.0, 0.06, u0.x).mul(smoothstep(1.0, 0.94, u0.x)).mul(smoothstep(0.0, 0.05, u0.y)).mul(smoothstep(1.0, 0.95, u0.y));
  const base = mix(vec3(...tint).mul(lum), s.rgb.mul(s.rgb), 0.45);
  const fres = abs(dot(normalWorld, positionWorld.sub(cameraPosition).normalize())).oneMinus().mul(0.5).add(0.6);
  const c = base.mul(lines).mul(flick).mul(edge).mul(fres).mul(1.6);
  m.colorNode = vec4(c, 1);
  m.fog = true;
  return m;
}

function mkRingMaterial(colorTex, uvr, tint) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const t = uTime;
  const u0 = uv();
  const uu = fract(u0.x.mul(2.0).add(t.mul(0.02)));
  const s = texture(colorTex, vec2(mix(float(uvr[0]), float(uvr[2]), uu), mix(float(uvr[1]), float(uvr[3]), u0.y)));
  const lines = sin(u0.y.mul(60.0).sub(t.mul(4.0))).mul(0.25).add(0.75);
  const c = vec3(...tint).mul(s.r.mul(s.r)).mul(lines).mul(3.0);
  m.colorNode = vec4(c, 1);
  return m;
}

function customizeMiraiBillboard(baseTex) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1536;
  const g = c.getContext('2d');
  if (baseTex?.image) g.drawImage(baseTex.image, 0, 0, 1024, 1536);
  else { g.fillStyle = '#120824'; g.fillRect(0, 0, 1024, 1536); }
  // Overlay top & bottom bands to replace Japanese text with Hangzhou Jiangnan cyber typography
  const topGrad = g.createLinearGradient(0, 0, 0, 360);
  topGrad.addColorStop(0, 'rgba(10, 16, 36, 0.96)');
  topGrad.addColorStop(0.75, 'rgba(18, 12, 42, 0.85)');
  topGrad.addColorStop(1, 'rgba(18, 12, 42, 0)');
  g.fillStyle = topGrad; g.fillRect(0, 0, 1024, 360);

  const botGrad = g.createLinearGradient(0, 1120, 0, 1536);
  botGrad.addColorStop(0, 'rgba(14, 10, 32, 0)');
  botGrad.addColorStop(0.28, 'rgba(14, 10, 32, 0.9)');
  botGrad.addColorStop(1, 'rgba(8, 6, 22, 0.98)');
  g.fillStyle = botGrad; g.fillRect(0, 1120, 1024, 416);

  g.textAlign = 'center';
  g.fillStyle = '#5ef6ff';
  g.font = '700 42px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.fillText('◆ 杭州江南 · 二零七七 ◆', 512, 86);
  g.fillStyle = '#ffffff';
  g.shadowColor = '#ff48b8'; g.shadowBlur = 24;
  g.font = '900 132px "Kaiti SC", "STKaiti", "PingFang SC", serif';
  g.fillText('烟雨钱塘', 512, 226);
  g.shadowBlur = 0;

  g.fillStyle = '#ffe24a';
  g.font = '900 92px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.fillText('西子云端 · 智造未来', 512, 1340);
  g.fillStyle = '#ff72c8';
  g.font = '700 44px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.fillText('钱塘科技集团 · 灵隐量子算力中心', 512, 1425);
  g.strokeStyle = '#5ef6ff'; g.lineWidth = 4;
  g.strokeRect(48, 1460, 928, 42);
  g.fillStyle = '#5ef6ff';
  g.font = '700 26px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.fillText('西湖景区全息专线 · 廿四小时低空摆渡已开通', 512, 1490);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

function customizeAdsGrid(baseTex) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  if (baseTex?.image) g.drawImage(baseTex.image, 0, 0, 1024, 1024);
  const cells = [
    { x: 0, y: 0, top: '钱塘科技 · 西子智驾', main: '凌波飞车', sub: '西湖环线 · 零延迟智驾轿跑', acc: '#48f0ff' },
    { x: 512, y: 0, top: '江南霓裳 · 虚拟偶像', main: '苏小小 2077', sub: '武林全息戏台 · 每晚八点公演', acc: '#ff58c8' },
    { x: 0, y: 512, top: '明前狮峰 · 赛博茶道', main: '西湖龙井', sub: '灵隐高山云雾 · 冷萃纳米茶饮', acc: '#5effa8' },
    { x: 512, y: 512, top: '百年名点 · 河坊夜市', main: '知味小笼', sub: '片儿川 · 定胜糕 · 廿四小时热供', acc: '#ffd248' },
  ];
  for (const cl of cells) {
    const gr = g.createLinearGradient(cl.x, cl.y, cl.x, cl.y + 512);
    gr.addColorStop(0, 'rgba(10, 14, 28, 0.82)');
    gr.addColorStop(0.45, 'rgba(10, 14, 28, 0.25)');
    gr.addColorStop(0.75, 'rgba(10, 14, 28, 0.88)');
    gr.addColorStop(1, 'rgba(8, 10, 22, 0.96)');
    g.fillStyle = gr;
    g.fillRect(cl.x, cl.y, 512, 512);
    g.strokeStyle = cl.acc; g.lineWidth = 6;
    g.strokeRect(cl.x + 14, cl.y + 14, 484, 484);
    g.textAlign = 'center';
    g.fillStyle = cl.acc;
    g.font = '800 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    g.fillText(cl.top, cl.x + 256, cl.y + 62);
    g.fillStyle = '#ffffff';
    g.shadowColor = cl.acc; g.shadowBlur = 18;
    g.font = '900 84px "Kaiti SC", "STKaiti", "PingFang SC", serif';
    g.fillText(cl.main, cl.x + 256, cl.y + 408);
    g.shadowBlur = 0;
    g.fillStyle = cl.acc;
    g.font = '700 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    g.fillText(cl.sub, cl.x + 256, cl.y + 466);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export async function buildBillboards(ctx, sb, L, pool, facades) {
  const { scene, assets, layout, camera } = ctx;
  const [rawMirai, rawAds] = await Promise.all([
    assets.texture('textures/signage/billboard_mirai.png', { srgb: false }),
    assets.texture('textures/signage/ads_grid.png', { srgb: false }),
  ]);
  const miraiTex = customizeMiraiBillboard(rawMirai);
  const adsTex = customizeAdsGrid(rawAds);
  const updaters = [];

  // ---------- 烟雨钱塘 billboard: placed so it sits left-of-centre in the overlook view (ref panel 2)
  const ov = new THREE.Vector3(...layout.overlook.position);
  const look = new THREE.Vector3(...layout.overlook.lookAt);
  const fwd = look.clone().sub(ov).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const dist = 50, lateral = -14.5;
  const bbW = 13, bbH = 19.5;
  let center = ov.clone().addScaledVector(fwd, dist).addScaledVector(right, lateral);
  let normal = ov.clone().sub(center).setY(0).normalize();
  // prefer a real facade roughly facing the overlook near that spot
  let mounted = null;
  for (const f of facades) {
    if (f.virtual) break;
    const toCam = ov.clone().sub(f.center).setY(0); const d = toCam.length(); toCam.normalize();
    if (f.normal.dot(toCam) < 0.75 || d < 30 || d > 90 || f.width < bbW + 1 || f.height < 24) continue;
    const dir = f.center.clone().sub(ov).setY(0).normalize();
    const ang = Math.atan2(dir.clone().cross(fwd).y, dir.dot(fwd)); // + = left of forward
    if (ang < 0.15 || ang > 0.7) continue;
    if (!mounted || Math.abs(ang - 0.42) < mounted.s) mounted = { f, s: Math.abs(ang - 0.42) };
  }
  if (mounted) { center = mounted.f.center.clone().addScaledVector(mounted.f.normal, 0.6); normal = mounted.f.normal.clone(); }
  center.y = ov.y - 2;
  const bbF = makeFacade(center.clone(), normal, bbW + 2, bbH + 4);
  const bRight = bbF.right;
  {
    const geo = new THREE.PlaneGeometry(bbW, bbH);
    const mesh = new THREE.Mesh(geo, mkMiraiMaterial(miraiTex));
    mesh.position.copy(center).addScaledVector(normal, 0.42);
    mesh.lookAt(mesh.position.clone().add(normal));
    mesh.name = 'billboard_mirai';
    scene.add(mesh);
    // housing: deep cabinet + frame + LED edge
    const hcol = [0.03, 0.03, 0.035], hmr = [0.7, 0.45];
    sb.hbox(center, [bRight, UP, normal], [bbW / 2 + 0.35, bbH / 2 + 0.35, 0.4], hcol, hmr, new Set(['+z']));
    const fc = center.clone().addScaledVector(normal, 0.42);
    for (const s of [-1, 1]) {
      sb.hbox(fc.clone().addScaledVector(UP, s * (bbH / 2 + 0.17)), [bRight, UP, normal], [bbW / 2 + 0.35, 0.17, 0.05], hcol, hmr);
      sb.hbox(fc.clone().addScaledVector(bRight, s * (bbW / 2 + 0.17)), [bRight, UP, normal], [0.17, bbH / 2, 0.05], hcol, hmr);
      sb.strip(fc.clone().addScaledVector(UP, s * (bbH / 2 + 0.36)).addScaledVector(normal, 0.0), bRight, normal, bbW / 2 + 0.35, 0.04, UP.clone().multiplyScalar(s), NEON.pink, 5, 3, 0);
    }
    // support: steel legs down to ground + cross bracing behind
    const steel = [[0.1, 0.1, 0.11], [0.85, 0.5]];
    const back = center.clone().addScaledVector(normal, -0.6);
    for (const s of [-0.38, 0.38]) {
      const top = back.clone().addScaledVector(bRight, s * bbW); top.y = center.y + bbH / 2;
      const bot = top.clone(); bot.y = 0;
      sb.bar(bot, top, 0.32, ...steel);
    }
    for (let y = 2; y < center.y - bbH / 2; y += 4) {
      const a = back.clone().addScaledVector(bRight, -0.38 * bbW); a.y = y;
      const b = back.clone().addScaledVector(bRight, 0.38 * bbW); b.y = y + 4;
      sb.bar(a, b, 0.08, ...steel);
      sb.bar(a.clone().setY(y + 4), b.clone().setY(y), 0.08, ...steel);
    }
    // colour cast from the screen: several pink/violet lights in front
    for (const [sx, sy, c] of [[-0.3, -0.3, [1, 0.3, 0.7]], [0.3, -0.3, [0.7, 0.3, 1]], [0, 0.3, [1, 0.45, 0.8]], [0, -0.55, [0.9, 0.35, 0.9]]]) {
      pool.add({ pos: center.clone().addScaledVector(bRight, sx * bbW).addScaledVector(normal, 4).add(new THREE.Vector3(0, sy * bbH, 0)), color: c, intensity: 160, distance: 24, seed: 1, ftype: 0, importance: 4 });
    }
    // 钱塘科技 channel letters above the billboard
    const kz = L.chanH.find((d) => d.text === '钱塘科技') || L.chanH[0];
    if (kz) {
      const kW = 15, kH = kW / kz.aspect;
      const kc = center.clone().addScaledVector(normal, 0.3); kc.y = center.y + bbH / 2 + 1.4 + kH / 2;
      sb.F.quad(kc, bRight, UP, kW / 2, kH / 2, normal, kz.rect.uv, { tint: [0.35, 0.95, 1.0], sp: [4 + 6, 6, 77, 0], back: [0, 0, 0] });
      sb.bar(kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, -kW * 0.4).setY(center.y + bbH / 2), kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, -kW * 0.4).setY(kc.y + kH / 2), 0.06, ...steel);
      sb.bar(kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, kW * 0.4).setY(center.y + bbH / 2), kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, kW * 0.4).setY(kc.y + kH / 2), 0.06, ...steel);
      sb.bar(kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, -kW / 2), kc.clone().addScaledVector(normal, -0.3).addScaledVector(bRight, kW / 2), 0.05, ...steel);
      pool.add({ pos: kc.clone().addScaledVector(normal, 2), color: [0.35, 0.9, 1], intensity: 60, distance: 20, seed: 1, ftype: 0, importance: 3 });
    }
    if (ctx.physics?.RAPIER) {
      const { RAPIER, world } = ctx.physics;
      for (const s of [-0.38, 0.38]) { const p = back.clone().addScaledVector(bRight, s * bbW); world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, center.y / 2, 0.35).setTranslation(p.x, center.y / 2, p.z)); }
    }
  }

  // ---------- corner video screens facing down the avenue (cross-street facades facing +z near the avenue)
  const scrBatch = { pos: [], uv: [], sd: [], idx: [] };
  const addScreen = (c, r, up, n, w, h, seed, inten) => {
    const base = scrBatch.pos.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = c.clone().addScaledVector(r, su * w / 2).addScaledVector(up, sv * h / 2);
      scrBatch.pos.push(p.x, p.y, p.z); scrBatch.uv.push((su + 1) / 2, (sv + 1) / 2); scrBatch.sd.push(seed, inten);
    }
    scrBatch.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const corner = facades.filter((f) => (f.district === 'cross' || f.district === 'avenue') && f.normal.z > 0.8 && Math.abs(f.center.x) < 40 && f.height > 20);
  let sIdx = 0;
  for (const f of corner) {
    if (sIdx > 6) break;
    const near = Math.abs(f.center.x) - f.width / 2 < 14;
    if (!near) continue;
    const w = Math.min(f.width * 0.7, 9), h = w;
    const c = f.center.clone().addScaledVector(f.normal, 0.35); c.y = Math.min(f.center.y + f.height / 2 - h / 2 - 1.5, 12 + h / 2 + (sIdx % 3) * 3);
    sb.hbox(c.clone().addScaledVector(f.normal, -0.15), [f.right, UP, f.normal], [w / 2 + 0.25, h / 2 + 0.25, 0.2], [0.03, 0.03, 0.035], [0.6, 0.45]);
    addScreen(c.clone().addScaledVector(f.normal, 0.06), f.right, UP, f.normal, w, h, sIdx * 1.7, 2.4);
    pool.add({ pos: c.clone().addScaledVector(f.normal, 4), color: [0.8, 0.5, 1], intensity: 70, distance: 22, seed: 1, ftype: 0, importance: 2.5 });
    sIdx++;
  }
  console.log(`[signage] video screens: ${sIdx}`);
  if (scrBatch.idx.length && adsTex) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(scrBatch.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(scrBatch.uv, 2));
    g.setAttribute('sd', new THREE.Float32BufferAttribute(scrBatch.sd, 2));
    g.setIndex(scrBatch.idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mkScreenMaterial(adsTex)); mesh.frustumCulled = false; mesh.name = 'signage_screens';
    scene.add(mesh);
  }

  // ---------- floating holograms over the avenue
  const holos = [];
  if (adsTex) {
    // idol hologram over the first cross street, KAIDO MOTORS further down
    const mk = (cell, pos, w, h, tint, yaw) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mkHoloMaterial(adsTex, tint, cell));
      mesh.position.copy(pos); mesh.rotation.y = yaw; mesh.renderOrder = 10; mesh.name = 'holo';
      scene.add(mesh); holos.push(mesh);
      pool.add({ pos: pos.clone().add(new THREE.Vector3(0, -h / 2, 0)), color: tint, intensity: 30, distance: 18, seed: 1, ftype: 0, importance: 2 });
    };
    const cz = layout.crossStreets.zs;
    mk([1, 0], new THREE.Vector3(-3, 15, cz[0] - 4), 9, 9, [1, 0.4, 0.9], 0.15);
    mk([0, 1], new THREE.Vector3(4, 17, cz[1] + 3), 12, 12, [1, 0.5, 0.25], -0.1);
    mk([0, 0], new THREE.Vector3(-2, 14, cz[2]), 10, 10, [0.3, 1, 0.8], 0.0);
  }
  // rotating holo text ring above the first intersection
  let ring = null;
  if (L.misc.holoRing && sb.colorTex) {
    const cz = layout.crossStreets.zs[0];
    ring = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.4, 96, 1, true), mkRingMaterial(sb.colorTex, L.misc.holoRing.rect.uv, [0.3, 0.9, 1.0]));
    ring.position.set(0, 21, cz); ring.renderOrder = 11; ring.name = 'holo_ring';
    scene.add(ring);
  }

  // ---------- holographic koi swimming above the avenue (signature piece)
  const kois = [];
  {
    const prof = [];
    const Lk = 7;
    for (let i = 0; i <= 24; i++) {
      const s = i / 24; // 0 tail .. 1 head
      const r = 0.95 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.8) * (0.35 + 0.65 * s) + 0.03;
      prof.push(new THREE.Vector2(r, (s - 0.5) * Lk));
    }
    const body = new THREE.LatheGeometry(prof, 28);
    body.rotateX(Math.PI / 2); // length along +Z (head at +Z)
    body.scale(1, 0.75, 1);
    // tail fin + pectoral fins as flat shapes
    const fin = (pts) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); return new THREE.ShapeGeometry(sh, 6); };
    const tail = fin([[0, 0], [1.6, -1.8], [0.4, -1.3], [0, -1.6], [-0.4, -1.3], [-1.6, -1.8]]);
    tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -Lk / 2 + 0.2); // horizontal fan behind tail
    tail.rotateZ(Math.PI / 2);
    const finL = fin([[0, 0], [1.4, -0.6], [1.0, 0.4]]); finL.rotateX(-Math.PI / 2); finL.translate(0.5, -0.3, 1.0);
    const finR = finL.clone(); finR.scale(-1, 1, 1);
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const strip = (g) => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (!['position', 'normal', 'uv'].includes(k)) o.deleteAttribute(k); if (!o.attributes.normal) o.computeVertexNormals(); return o; };
    const koiGeo = mergeGeometries([strip(body), strip(tail), strip(finL), strip(finR)]);
    const mkKoiMat = (cA, cB, phase) => {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const t = uTime.add(phase);
      const p = positionLocal;
      const tailW = smoothstep(Lk * 0.45, -Lk * 0.5, p.z).pow(1.6);
      m.positionNode = vec3(p.x.add(sin(p.z.mul(0.9).sub(t.mul(3.2))).mul(0.55).mul(tailW)), p.y, p.z);
      const vdir = positionWorld.sub(cameraPosition).normalize();
      const fres = abs(dot(normalWorld, vdir)).oneMinus().pow(1.5);
      const patch = smoothstep(0.45, 0.6, hash(floor(p.z.mul(1.3)).add(floor(p.x.add(2).mul(1.6)).mul(13)).add(7)));
      const col = mix(vec3(...cA), vec3(...cB), patch);
      const scan = sin(p.z.mul(22.0).sub(t.mul(9.0))).mul(0.5).add(0.5).pow(3.0).mul(0.8).add(0.35);
      const flick = step(0.05, hash(floor(t.mul(11.0)).add(23))).mul(0.3).add(0.7);
      m.colorNode = vec4(col.mul(fres.mul(2.6).add(0.12)).mul(scan).mul(flick).mul(1.3), 1);
      return m;
    };
    const cz = layout.crossStreets.zs;
    const specs = [
      { c: new THREE.Vector3(0, 19, cz[0] + 22), r: 9, h: 2.2, sp: 0.22, cA: [1.0, 0.35, 0.08], cB: [0.9, 0.95, 1.0], ph: 0 },
      { c: new THREE.Vector3(1, 23, cz[0] - 30), r: 12, h: 3, sp: -0.16, cA: [0.2, 0.8, 1.0], cB: [1.0, 0.3, 0.8], ph: 3 },
    ];
    for (const s of specs) {
      const mesh = new THREE.Mesh(koiGeo, mkKoiMat(s.cA, s.cB, s.ph));
      mesh.renderOrder = 12; mesh.frustumCulled = false; mesh.name = 'holo_koi';
      scene.add(mesh); kois.push({ mesh, ...s });
      pool.add({ pos: s.c.clone(), color: s.cA, intensity: 25, distance: 18, seed: 1, ftype: 0, importance: 1.5 });
    }
  }

  const holoBaseY = holos.map((h) => h.position.y);
  return {
    ring,
    update(dt, t) {
      for (let i = 0; i < holos.length; i++) holos[i].position.y = holoBaseY[i] + Math.sin(t * 0.6 + i) * 0.25;
      if (ring) ring.rotation.y = t * 0.25;
      for (const k of kois) {
        const a = t * k.sp + k.ph;
        k.mesh.position.set(k.c.x + Math.cos(a) * k.r * 0.55, k.c.y + Math.sin(a * 2.1) * k.h * 0.5, k.c.z + Math.sin(a) * k.r);
        // heading = derivative of the path
        const dx = -Math.sin(a) * k.r * 0.55 * k.sp, dz = Math.cos(a) * k.r * k.sp, dy = Math.cos(a * 2.1) * k.h * 0.5 * 2.1 * k.sp;
        k.mesh.rotation.set(0, 0, 0);
        k.mesh.lookAt(k.mesh.position.x + dx, k.mesh.position.y + dy, k.mesh.position.z + dz);
      }
    },
  };
}
