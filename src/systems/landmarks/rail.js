import * as THREE from 'three/webgpu';
import { Batch, profileGeometry, cuboid, groundY } from './util.js';
import { surface, metal, emissiveMat } from './materials.js';

// Elevated railway viaduct + animated commuter trains crossing the district along X.
export function buildRail(ctx, tex, root) {
  const R = ctx.layout.elevatedRail;
  const H = R.height;
  const Z = R.z, x0 = R.xStart, x1 = R.xEnd;
  const hw = R.width / 2;
  const river = ctx.layout.river;
  const b = new Batch();

  const deckProf = [
    [-hw, 0], [-hw, -0.3], [-hw + 0.7, -0.6], [-2.8, -1.8],
    [2.8, -1.8], [hw - 0.7, -0.6], [hw, -0.3], [hw, 0],
  ];
  for (let x = x0; x < x1; x += 32) {
    const xe = Math.min(x1, x + 32);
    const xm = (x + xe) / 2;
    b.add('concrete', profileGeometry(deckProf, x + 0.03, xe - 0.03), 0, H, Z);
    for (const s of [-1, 1]) {
      b.box('concrete', xe - x - 0.06, 1.1, 0.25, xm, H + 0.55, Z + s * (hw - 0.14));
      b.box('steel', xe - x, 0.08, 0.3, xm, H + 1.14, Z + s * (hw - 0.14));
      // rails
      const tz = Z + s * 2.1;
      b.box('darkMetal', xe - x, 0.12, 0.08, xm, H + 0.12, tz - 0.55);
      b.box('darkMetal', xe - x, 0.12, 0.08, xm, H + 0.12, tz + 0.55);
    }
    // catenary portals every 32m
    for (const s of [-1, 1]) {
      b.box('steel', 0.22, 5.6, 0.22, x + 0.2, H + 2.8, Z + s * (hw - 0.2));
    }
    b.box('steel', 0.2, 0.22, R.width, x + 0.2, H + 5.5, Z);
    b.box('darkMetal', xe - x, 0.03, 0.03, xm, H + 4.9, Z - 2.1);
    b.box('darkMetal', xe - x, 0.03, 0.03, xm, H + 4.9, Z + 2.1);
  }

  // Piers
  const pierXs = [];
  for (let x = x0 + 16; x < x1; x += 32) {
    if (Math.abs(x) < 15) continue;
    if (x > river.xCenter - river.halfWidth - 14 && x < river.xCenter + river.halfWidth + 14) continue;
    pierXs.push(x);
  }
  pierXs.push(-12, 12, river.xCenter - river.halfWidth - 10, river.xCenter + river.halfWidth + 10);
  for (const px of pierXs) {
    const gy = groundY(ctx, px, Z);
    const top = H - 1.8;
    const h = top - gy;
    for (const s of [-2.2, 2.2]) {
      b.box('concrete', 1.2, h, 1.2, px, gy + h / 2, Z + s);
      cuboid(ctx, px, gy + h / 2, Z + s, 0.6, h / 2, 0.6);
    }
    b.box('concrete', 1.5, 1.0, R.width - 1.2, px, top - 0.4, Z);
  }

  const mats = {
    concrete: surface({ map: tex.concrete, nmap: tex.concrete_n, rmap: tex.concrete_r }, { uvScale: 1 / 4.0, tint: [0.82, 0.82, 0.8] }),
    steel: metal({ color: [0.24, 0.26, 0.28], rough: 0.45, metal: 0.8 }),
    darkMetal: metal({ color: [0.08, 0.08, 0.09], rough: 0.4, metal: 0.85 }),
  };
  const viaduct = b.build(mats, { worldUV: { concrete: 1 }, chunk: 80 });
  viaduct.name = 'elevated_rail';
  root.add(viaduct);

  // Commuter trains (2 trains running opposite directions)
  const carLength = 19.5;
  const cars = 5;
  const bodyMat = metal({ color: [0.68, 0.72, 0.76], rough: 0.28, metal: 0.85 });
  const stripeMat = emissiveMat([0.1, 0.85, 1.0], 2.5);
  const winMat = emissiveMat([1.0, 0.92, 0.75], 5.5);

  const makeTrainMesh = () => {
    const g = new THREE.Group();
    for (let c = 0; c < cars; c++) {
      const cx = -c * (carLength + 0.6);
      const body = new THREE.Mesh(new THREE.BoxGeometry(carLength, 3.1, 2.85), bodyMat);
      body.position.set(cx, 1.75, 0);
      g.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(carLength + 0.04, 0.22, 2.9), stripeMat);
      stripe.position.set(cx, 1.35, 0);
      g.add(stripe);
      const win = new THREE.Mesh(new THREE.BoxGeometry(carLength - 1.6, 0.85, 2.92), winMat);
      win.position.set(cx, 2.05, 0);
      g.add(win);
    }
    return g;
  };

  const trains = [
    { head: -80, dir: 1, z: Z - 2.1, speed: 24, cars, carLength, visible: true, mesh: makeTrainMesh() },
    { head: 140, dir: -1, z: Z + 2.1, speed: 22, cars, carLength, visible: true, mesh: makeTrainMesh() },
  ];
  for (const tr of trains) {
    tr.mesh.position.set(tr.head, H + 0.18, tr.z);
    if (tr.dir < 0) tr.mesh.rotation.y = Math.PI;
    root.add(tr.mesh);
  }

  return {
    api: {
      z: Z,
      height: H,
      railTop: H + 0.18,
      width: R.width,
      xStart: x0,
      xEnd: x1,
      trains,
    },
    update(dt) {
      const span = (x1 - x0) + 320;
      for (const tr of trains) {
        tr.head += tr.dir * tr.speed * dt;
        if (tr.dir > 0 && tr.head > x1 + 180) tr.head -= span;
        if (tr.dir < 0 && tr.head < x0 - 180) tr.head += span;
        tr.mesh.position.x = tr.head;
      }
    },
  };
}
