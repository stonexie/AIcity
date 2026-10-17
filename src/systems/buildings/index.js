// Buildings system: procedural district plan, architectural volumes, ground-floor shopfronts,
// backstreet alley stairs/clutter, rooftop overlook deck, power/telecom cables, and instanced props.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { buildPlan } from './plan.js';
import { ChunkedBuckets } from './geom.js';
import { buildLotArchitecture, sideFrame } from './architecture.js';
import { ShopBuilder, ATLAS_SIZE, SLOTS, ATLAS_SOURCES } from './shops.js';
import { buildAlley } from './alley.js';
import { buildOverlook } from './overlook.js';
import { buildCables } from './cables.js';
import { buildProps } from './props.js';
import {
  createNoiseTexture,
  createFacadeMaterial,
  createDetailMaterial,
  createGlassMaterial,
} from './materials.js';

const UP = new THREE.Vector3(0, 1, 0);

async function buildWallAtlases(ctx) {
  const cellW = 512, cellH = 512;
  const W = cellW * 4, H = cellH * 2;
  const albCanvas = document.createElement('canvas');
  albCanvas.width = W; albCanvas.height = H;
  const albCtx = albCanvas.getContext('2d');

  const nrmCanvas = document.createElement('canvas');
  nrmCanvas.width = W; nrmCanvas.height = H;
  const nrmCtx = nrmCanvas.getContext('2d');

  // Default flat normal
  nrmCtx.fillStyle = 'rgb(128,128,255)';
  nrmCtx.fillRect(0, 0, W, H);

  // Layer mapping:
  // 0: tile, 1: concrete, 2: corrugated, 3: render, 4: metal, 5: brick, 6: whitetile, 7: roof
  const sources = [
    { base: 'textures/ground/sidewalk_tiles', tint: '#5d656c' },
    { base: 'textures/landmarks/concrete', tint: '#7a7c7e' },
    { base: 'textures/landmarks/wood_slats', tint: '#585e64' },
    { base: 'textures/ground/concrete', tint: '#84807a' },
    { base: 'textures/ground/granite', tint: '#485058' },
    { base: 'textures/ground/alley_pavers', tint: '#6e473b' },
    { base: 'textures/ground/sidewalk_tiles', tint: '#b5b8bc' },
    { base: 'textures/ground/asphalt_a', tint: '#46484a' },
  ];

  await Promise.all(sources.map(async (s, layer) => {
    const col = layer % 4;
    const row = Math.floor(layer / 4);
    const x = col * cellW;
    const y = row * cellH;

    albCtx.fillStyle = s.tint;
    albCtx.fillRect(x, y, cellW, cellH);

    const [cTex, nTex] = await Promise.all([
      ctx.assets.texture(`${s.base}_c.png`, { srgb: true }).catch(() => null)
        .then((t) => t || ctx.assets.texture(`${s.base}.png`, { srgb: true }).catch(() => null)),
      ctx.assets.texture(`${s.base}_n.png`, { srgb: false }).catch(() => null),
    ]);

    if (cTex?.image) {
      albCtx.save();
      albCtx.globalAlpha = 0.75;
      albCtx.drawImage(cTex.image, x, y, cellW, cellH);
      albCtx.restore();
    }
    if (nTex?.image) {
      nrmCtx.drawImage(nTex.image, x, y, cellW, cellH);
    }
  }));

  const albedo = new THREE.CanvasTexture(albCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.ClampToEdgeWrapping;
  albedo.generateMipmaps = true;
  albedo.minFilter = THREE.LinearMipmapLinearFilter;
  albedo.needsUpdate = true;

  const normal = new THREE.CanvasTexture(nrmCanvas);
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = normal.wrapT = THREE.ClampToEdgeWrapping;
  normal.generateMipmaps = true;
  normal.minFilter = THREE.LinearMipmapLinearFilter;
  normal.needsUpdate = true;

  return { albedo, normal };
}

async function buildShopAtlas(ctx) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const g = canvas.getContext('2d');
  g.fillStyle = '#181412';
  g.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  await Promise.all(Object.entries(SLOTS).map(async ([slot, [x, y, w, h]]) => {
    const srcName = ATLAS_SOURCES[slot];
    const path = slot === 'posters'
      ? 'textures/signage/posters_atlas.png'
      : `textures/buildings/${srcName}.png`;
    const tex = await ctx.assets.texture(path, { srgb: true }).catch(() => null);
    if (tex?.image) {
      g.drawImage(tex.image, x, y, w, h);
    }
  }));

  // Overlay Hangzhou Jiangnan noren curtains (slot 'noren' at [1024, 512, 512, 512], 4 horizontal bands)
  {
    const [nx, ny, nw, nh] = SLOTS.noren;
    const bands = [
      { bg: '#8c181c', border: '#f0d078', fg: '#fff8ea', flaps: ['片', '儿', '川', '面'], sub: '老杭州手工面' },
      { bg: '#182848', border: '#98d8f8', fg: '#ffffff', flaps: ['太', '和', '酒', '肆'], sub: '绍兴陈年花雕' },
      { bg: '#183828', border: '#d8b050', fg: '#f6ebd2', flaps: ['西', '湖', '龙', '井'], sub: '明前狮峰新茶' },
      { bg: '#2c1c16', border: '#e88840', fg: '#ffe8c8', flaps: ['知', '味', '小', '笼'], sub: '百年江南名点' },
    ];
    const bh = nh / 4;
    bands.forEach((b, row) => {
      const y0 = ny + row * bh;
      g.fillStyle = b.bg;
      g.fillRect(nx, y0, nw, bh);
      g.strokeStyle = b.border; g.lineWidth = 3;
      g.strokeRect(nx + 6, y0 + 6, nw - 12, bh - 12);
      const fw = nw / 4;
      for (let i = 0; i < 4; i++) {
        const fx = nx + i * fw;
        if (i > 0) { g.fillStyle = '#0e0a08'; g.fillRect(fx - 2, y0 + 28, 4, bh - 28); }
        g.strokeStyle = b.border; g.lineWidth = 2;
        g.beginPath(); g.arc(fx + fw / 2, y0 + bh * 0.56, 36, 0, Math.PI * 2); g.stroke();
        g.fillStyle = b.fg;
        g.font = '900 52px "Kaiti SC", "STKaiti", "PingFang SC", serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(b.flaps[i], fx + fw / 2, y0 + bh * 0.56);
      }
    });
  }

  // Overlay Hangzhou Jiangnan posters in the building posters slot ([0, 1024, 1024, 1024], 4x2 grid)
  {
    const [px, py, pw, ph] = SLOTS.posters;
    const cw = pw / 4, ch = ph / 2;
    const pList = [
      { t: '西湖夜游', s: '三潭印月 · 画舫笙歌', bg: '#102438', fg: '#f8e6b8', acc: '#38d8ff' },
      { t: '明前龙井', s: '狮峰头采 · 甘醇如玉', bg: '#163626', fg: '#f4ebd0', acc: '#88e868' },
      { t: '江南评弹', s: '琵琶三弦 · 听雨茶座', bg: '#321424', fg: '#ffe8f0', acc: '#ff60a8' },
      { t: '河坊夜市', s: '定胜糕 · 桂花糖藕', bg: '#78181c', fg: '#fff6d8', acc: '#ffd040' },
      { t: '越剧新声', s: '梁祝化蝶 · 全息戏台', bg: '#241842', fg: '#f0e8ff', acc: '#b070ff' },
      { t: '知味早茶', s: '鲜肉小笼 · 猫耳朵', bg: '#382214', fg: '#ffe8c0', acc: '#ff8830' },
      { t: '钱塘观潮', s: '六和听涛 · 气吞山河', bg: '#0e1e36', fg: '#ffffff', acc: '#00e8ff' },
      { t: '杭罗丝绸', s: '非遗云锦 · 江南织造', bg: '#1f1916', fg: '#ffd898', acc: '#ff5040' },
    ];
    pList.forEach((p, idx) => {
      const col = idx % 4, row = Math.floor(idx / 4);
      const x0 = px + col * cw, y0 = py + row * ch;
      g.fillStyle = p.bg; g.fillRect(x0 + 8, y0 + 8, cw - 16, ch - 16);
      g.strokeStyle = p.acc; g.lineWidth = 6; g.strokeRect(x0 + 16, y0 + 16, cw - 32, ch - 32);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = p.acc; g.font = '800 28px "PingFang SC", "Microsoft YaHei", sans-serif';
      g.fillText('杭州 · 江南风物', x0 + cw / 2, y0 + 70);
      g.fillStyle = p.fg; g.font = '900 68px "Kaiti SC", "STKaiti", "PingFang SC", serif';
      g.fillText(p.t, x0 + cw / 2, y0 + ch * 0.48);
      g.fillStyle = p.acc; g.font = '700 30px "PingFang SC", "Microsoft YaHei", sans-serif';
      g.fillText(p.s, x0 + cw / 2, y0 + ch * 0.78);
    });
  }

  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.needsUpdate = true;
  return atlas;
}

export default {
  async init(ctx) {
    const t0 = performance.now();
    const { scene } = ctx;
    const wetness = uniform(1.0);
    this.wetness = wetness;

    const { lots, heightCap } = buildPlan(ctx.layout);
    const B = new ChunkedBuckets(96);
    const out = { colliders: [], lights: [] };
    const shopBuilder = new ShopBuilder(B, out);
    const facades = [];
    const shops = [];

    for (const lot of lots) {
      buildLotArchitecture(lot, B, out);
      const v0 = lot.volumes?.[0];
      if (!v0) continue;
      for (const front of lot.fronts) {
        const fr = sideFrame(v0, front.side, 0);
        const baseY = front.baseY > 0 ? front.baseY : 0;
        if (front.shop && lot.detail === 'hi' && front.baseY >= 0 && fr.width >= 3.5) {
          front.shopType = shopBuilder.build(lot, front);
          shops.push({
            type: front.shopType,
            position: new THREE.Vector3(
              fr.origin[0] + fr.right[0] * (fr.width * 0.5),
              baseY + 1.5,
              fr.origin[2] + fr.right[2] * (fr.width * 0.5)
            ),
          });
        }
        const n = new THREE.Vector3(...fr.normal).normalize();
        const right = new THREE.Vector3(...fr.right).normalize();
        const h = lot.h - baseY;
        const center = new THREE.Vector3(
          fr.origin[0] + fr.right[0] * (fr.width * 0.5),
          baseY + h * 0.5,
          fr.origin[2] + fr.right[2] * (fr.width * 0.5)
        );
        facades.push({
          lotId: lot.id,
          center,
          normal: n,
          right,
          width: fr.width,
          height: h,
          floors: lot.floors,
          floorHeight: lot.floorH,
          groundH: lot.groundH,
          baseY,
          district: front.district,
          shopfront: !!front.shop && front.baseY >= 0,
          shopType: front.shopType || null,
          overlook: !!lot.overlook,
        });
      }
    }

    buildAlley(ctx, lots, B, out);
    buildOverlook(ctx, lots, B, out);
    buildCables(ctx, lots, B, out);

    const propMeshes = await buildProps(ctx, lots, B, out, { wetness });

    const noise = createNoiseTexture(512);
    const [{ albedo, normal }, shopAtlas, interiorTex] = await Promise.all([
      buildWallAtlases(ctx),
      buildShopAtlas(ctx),
      ctx.assets.texture('textures/buildings/interior_atlas.png', { srgb: true, flipY: true }),
    ]);
    const fallbackTex = new THREE.DataTexture(new Uint8Array([180, 140, 100, 255]), 1, 1);
    fallbackTex.needsUpdate = true;

    const mats = {
      facade: createFacadeMaterial({ albedo, normal, interior: interiorTex || fallbackTex, wetness, noise }),
      detail: createDetailMaterial({ atlas: shopAtlas, wetness, noise }),
      glass: createGlassMaterial(),
    };

    const group = new THREE.Group();
    group.name = 'buildings';
    for (const bucket of B.map.values()) {
      const geo = bucket.build();
      if (!geo) continue;
      const mat = mats[bucket.matKey];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `bld_${bucket.matKey}_${bucket.chunk[0]}_${bucket.chunk[1]}`;
      mesh.castShadow = bucket.matKey === 'facade';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    for (const m of propMeshes) group.add(m);
    scene.add(group);

    // Colliders
    const { RAPIER, world } = ctx.physics || {};
    if (world) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      for (const c of out.colliders) {
        if (c.hx <= 0 || c.hy <= 0 || c.hz <= 0) continue;
        const desc = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z);
        if (c.rot) desc.setRotation(c.rot);
        world.createCollider(desc, body);
      }
    }

    ctx.api.buildings = {
      lots,
      facades,
      shops,
      lights: out.lights,
      heightCap,
      group,
      materials: mats,
    };
    console.log(`[buildings] ${lots.length} lots, ${facades.length} facades, ${B.map.size} chunks, ${(performance.now() - t0).toFixed(0)}ms`);
  },

  update(dt, t, ctx) {
    if (this.wetness) {
      this.wetness.value = ctx.weather?.wetness ?? 1.0;
    }
  },
};
