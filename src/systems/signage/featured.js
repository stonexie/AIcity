// Hand-placed hero signage matching the reference panels (Pian'erchuan noodle shop, Pingtan teahouse blade, overlook QIANTANG, Hefang alley set).
import * as THREE from 'three/webgpu';
import { NEON } from './util.js';
import { alleyGroundY } from './facades.js';

const UP = new THREE.Vector3(0, 1, 0);

export function nearestFacade(facades, p, normal, minDot = 0.7, filter = null) {
  let best = null, bd = Infinity;
  for (const f of facades) {
    if (f.normal.dot(normal) < minDot) continue;
    if (filter && !filter(f)) continue;
    const d = f.center.clone().setY(0).distanceTo(new THREE.Vector3(p.x, 0, p.z));
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

export function makeFacade(center, normal, width, height, district = 'avenue') {
  const n = normal.clone().normalize();
  return { center, normal: n, right: new THREE.Vector3().crossVectors(UP, n).normalize(), width, height, floors: Math.floor(height / 3.4), floorHeight: 3.4, district, shopfront: true };
}

// offset along facade right so that the mount point is at world z (or x)
function alongTo(f, p) { return p.clone().sub(f.center).dot(f.right); }

export async function buildFeatured(ctx, sb, facades, L) {
  const lay = ctx.layout;
  const reserved = new Set();
  const lanternRows = [];
  const lanternStrings = [];
  const tallLanterns = [];
  const byText = (arr, t) => arr.find((d) => d.text === t) || arr[0];

  // ---------- 1. Pian'erchuan Noodle Shop: west avenue facade near the street camera (ref panel 1, left)
  const ramenF = nearestFacade(facades, new THREE.Vector3(-10, 0, 19), new THREE.Vector3(1, 0, 0), 0.8, (f) => f.district === 'avenue');
  if (ramenF) {
    reserved.add(ramenF);
    const base = ramenF.center.y - ramenF.height / 2;
    const zc = 19;
    const a = alongTo(ramenF, new THREE.Vector3(-10, 0, zc));
    const aa = THREE.MathUtils.clamp(a, -ramenF.width / 2 + 2, ramenF.width / 2 - 2);
    // big 片儿川 light box (codex art cell 0) above the entrance
    const aN = THREE.MathUtils.clamp(alongTo(ramenF, new THREE.Vector3(-10, 0, 16.5)), -ramenF.width / 2 + 0.3, ramenF.width / 2 - 0.3);
    if (L.boxSq[0]) sb.blade(ramenF, aN, (ramenF.fasciaY ?? base + 3.2) + 0.5, L.boxSq[0], { depth: 2.3, thick: 0.4, gap: 0.15, maxH: 2.4, inten: 2.3, housing: [[0.55, 0.55, 0.57], [0.7, 0.35]], edge: true, lightColor: [1, 0.55, 0.45], lightMul: 1.4, importance: 3 });
    // red/white vertical box blade at the shop corner
    sb.blade(ramenF, aa - 2.6, base + 3.9, byText(L.boxV, '片儿川'), { depth: 1.1, maxH: 5.5, housing: [[0.45, 0.03, 0.03], [0.2, 0.4]], edge: true, importance: 3 });
    // second neon blade higher up
    sb.blade(ramenF, aa + 3.4, base + 7.5, byText(L.neonV, '太和酒家'), { depth: 1.0, maxH: 6, tint: NEON.amber, ftype: 0, importance: 2 });
    // noren-level fascia
    sb.flat(ramenF, aa, base + 3.25, byText(L.boxH, '奎元片儿川'), { width: 5.2, maxH: 0.9, depth: 0.25, inten: 2.0, importance: 2 });
    // lantern row under the awning line
    const p0 = ramenF.center.clone().addScaledVector(ramenF.right, aa - 2.2).addScaledVector(ramenF.normal, 0.7); p0.y = base + 2.95;
    const p1 = ramenF.center.clone().addScaledVector(ramenF.right, aa + 2.6).addScaledVector(ramenF.normal, 0.7); p1.y = base + 2.95;
    lanternRows.push({ p0, p1, count: 6, texts: ['片', '儿', '川', '面', '片', '儿'], scale: 1.0 });
  }

  // ---------- 2. Pingtan Teahouse: big magenta neon blade on the east side (ref panel 1, right)
  const karF = nearestFacade(facades, new THREE.Vector3(10, 0, 4), new THREE.Vector3(-1, 0, 0), 0.8, (f) => f.district === 'avenue');
  if (karF) {
    reserved.add(karF);
    const base = karF.center.y - karF.height / 2;
    const a = THREE.MathUtils.clamp(alongTo(karF, new THREE.Vector3(10, 0, 6)), -karF.width / 2 + 1, karF.width / 2 - 1);
    sb.blade(karF, a, base + 4.5, byText(L.neonV, '听雨轩'), { depth: 1.5, maxH: 8, tint: NEON.magenta, ftype: 0, inten: 7.5, edge: true, importance: 3, lightMul: 1.5 });
    sb.blade(karF, a - 4.2, base + 4.2, byText(L.boxV, '武林游艺'), { depth: 1.0, maxH: 5, importance: 2 });
    sb.flat(karF, a - 1.5, base + 3.5, byText(L.boxH, '听雨轩评弹'), { width: 5, maxH: 1, importance: 2 });
    if (L.misc.sign24) sb.flat(karF, a + 2.5, base + 2.4, L.misc.sign24, { width: 0.8, depth: 0.15, inten: 2.2 });
  }

  // ---------- 3. Overlook: blue 钱塘江 / 烟雨江南 vertical sign close on the right (ref panel 2)
  {
    const [ox, oy, oz] = lay.overlook.position;
    const f = makeFacade(new THREE.Vector3(ox + 8.2, oy, oz - 5.5), new THREE.Vector3(-1, 0, 0.25), 2, 20);
    const ds = L.misc.neonOverlook || byText(L.neonV, '钱塘江');
    sb.blade(f, 0, oy - 2.4, ds, { depth: 1.35, maxH: 7.8, tint: NEON.blue, inten: 8, ftype: 0, edge: true, gap: 0.3, importance: 4 });
    // supporting mast for the free-standing overlook sign
    sb.bar(new THREE.Vector3(f.center.x, oy - 12, f.center.z), new THREE.Vector3(f.center.x, oy + 5, f.center.z), 0.12, [0.1, 0.1, 0.11], [0.8, 0.5]);
  }

  // ---------- 4. Hefang Alley set dressing (ref panel 4)
  sb.lightScale = 0.6;
  const al = lay.alley;
  const alleyF = facades.filter((f) => f.district === 'alley');
  // 太和酒家 light box + 叫花鸡 tall lantern near the bottom of the stairs, north side
  const nomF = nearestFacade(alleyF, new THREE.Vector3(-36, 0, al.z - al.width / 2), new THREE.Vector3(0, 0, 1), 0.8);
  if (nomF && L.misc.nomiya) {
    reserved.add(nomF);
    const base = nomF.center.y - nomF.height / 2;
    const a = alongTo(nomF, new THREE.Vector3(-36, 0, 0));
    sb.flat(nomF, a, base + 3.1, L.misc.nomiya, { width: 2.2, depth: 0.3, inten: 2.2, housing: [[0.08, 0.05, 0.03], [0.1, 0.6]], lightColor: [1, 0.75, 0.5], importance: 3 });
    sb.blade(nomF, a + 2.1, base + 3.4, byText(L.neonV, '叫花鸡'), { depth: 0.7, maxH: 3.2, tint: NEON.red, importance: 2 });
    const tp = nomF.center.clone().addScaledVector(nomF.right, a - 1.7).addScaledVector(nomF.normal, 0.5); tp.y = base + 2.6;
    tallLanterns.push({ pos: tp, text: '叫花鸡' });
  }
  // 烟雨入江南 灯火照钱塘 wall text on the south side facing the camera direction up the stairs
  const ggF = nearestFacade(alleyF, new THREE.Vector3(-46, 0, al.z + al.width / 2), new THREE.Vector3(0, 0, -1), 0.8);
  if (ggF && L.misc.goodgames) {
    reserved.add(ggF);
    const base = ggF.center.y - ggF.height / 2;
    const a = alongTo(ggF, new THREE.Vector3(-46, 0, 0));
    const yy = alleyGroundY(lay, -46) + 3.4;
    sb.flat(ggF, a, Math.max(base + 2.8, yy), L.misc.goodgames, { width: 3.2, depth: 0.003, off: 0.01, noHousing: true, inten: 0.35, tint: [1, 1, 1], light: false, back: [0.03, 0.03, 0.03] });
    sb.light(ggF.center.clone().addScaledVector(ggF.right, a).addScaledVector(ggF.normal, 1.2).setY(Math.max(base + 4.5, yy + 1.2)), [1, 0.9, 0.8], 6, 7, 1, 0);
    sb.blade(ggF, a - 2.6, Math.max(base + 3.2, yy - 0.5), byText(L.boxV, '运河夜肆'), { depth: 0.7, maxH: 3.5, importance: 2 });
  }
  // lantern strings across the alley + lanterns at alley shop entrances
  for (let x = al.xStart - 4; x > al.xEnd + 4; x -= 7.5) {
    const gy = alleyGroundY(lay, x);
    const sag = 0.5;
    const a = new THREE.Vector3(x, gy + 4.3, al.z - al.width / 2 + 0.1);
    const b = new THREE.Vector3(x - 1.5, gy + 4.5, al.z + al.width / 2 - 0.1);
    lanternStrings.push({ a, b, sag, count: 4 });
  }
  for (const f of alleyF) {
    if (sb.rnd() < 0.5) {
      const base = f.center.y - f.height / 2;
      const a = sb.rnd.range(-f.width / 3, f.width / 3);
      const p0 = f.center.clone().addScaledVector(f.right, a - 0.6).addScaledVector(f.normal, 0.45); p0.y = base + 2.5;
      const p1 = f.center.clone().addScaledVector(f.right, a + 0.6).addScaledVector(f.normal, 0.45); p1.y = base + 2.5;
      lanternRows.push({ p0, p1, count: 2, texts: sb.rnd() < 0.5 ? ['太', '和'] : ['西湖', '茶'], scale: 0.9 });
    }
  }
  sb.lightScale = 1;
  // Jiangnan Tavern on the avenue east side (red lantern row + 太和酒家 neon)
  const izF = nearestFacade(facades, new THREE.Vector3(10, 0, -30), new THREE.Vector3(-1, 0, 0), 0.8, (f) => f.district === 'avenue' && !reserved.has(f));
  if (izF) {
    reserved.add(izF);
    const base = izF.center.y - izF.height / 2;
    sb.flat(izF, 0, base + 3.6, byText(L.neonH, '太和酒家'), { width: 4.2, maxH: 1, depth: 0.12, tint: NEON.amber, importance: 2 });
    sb.blade(izF, -izF.width / 2 + 1.2, base + 4.5, byText(L.neonV, '太和酒家'), { depth: 1.2, maxH: 6, tint: NEON.red, importance: 2 });
    sb.blade(izF, izF.width / 2 - 1.2, base + 5.0, byText(L.neonV, '西子宾馆'), { depth: 1.2, maxH: 7, tint: NEON.violet, importance: 2 });
    const p0 = izF.center.clone().addScaledVector(izF.right, -2.4).addScaledVector(izF.normal, 0.6); p0.y = base + 2.9;
    const p1 = izF.center.clone().addScaledVector(izF.right, 2.4).addScaledVector(izF.normal, 0.6); p1.y = base + 2.9;
    lanternRows.push({ p0, p1, count: 5, texts: ['太', '和', '酒', '茶', '杭'], scale: 1.0 });
  }

  return { reserved, lanternRows, lanternStrings, tallLanterns };
}
