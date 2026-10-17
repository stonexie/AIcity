// Sign design library: renders Hangzhou Jiangnan (杭州江南) sign artwork into the two atlases and returns design descriptors.
// Each design: { rect (atlas rect with uv), aspect (w/h), mode, natural: [wm, hm] }
import { NeonAtlas, ColorAtlas, FONTS, textCentered, textVertical, fitText, roundRect, loadFonts } from './atlas.js';
import { mulberry32 } from './util.js';

// 杭州江南竖向霓虹灯牌词库
export const JP_V = [
  '片儿川', '听雨轩', '太和酒家', '叫花鸡', '运河夜肆', '钱塘江', '回春堂', '当铺', '西子宾馆', '龙井茶室',
  '武林游艺', '知味小笼', '江南酒肆', '雀神麻将', '灵隐卜算', '东坡肉', '全息茶楼', '湖滨茶社', '赛博算力', '河坊夜市',
  '桂花糖藕', '曲院风荷', '醉西湖', '定胜糕', '猫耳朵', '保俶古玩', '推拿正骨', '南宋书坊', '杭帮名菜', '湧金汤泉',
  '今日新茶', '张小泉', '王星记', '西湖醋鱼',
];
export const LAT_V = ['西湖龙井', '片儿川', '知味观', '楼外楼', '定胜糕', '杭罗丝绸'];

// 杭州江南横向霓虹灯管词库
export const H_TXT = [
  '西湖龙井', '太和酒家', '西子国宾馆', '听雨轩评弹', '江南夜酒', '廿四小时营业', '知味小笼包', '老底子片儿川',
  '武林电玩城', '大运河夜市', '绍兴女儿红', '风荷曲院', '奎元馆面庄', '赛博茶寮', '明前狮峰茶', '南宋御街坊',
  '武林门网咖', '西泠印社', '楼外楼醋鱼', '知味观名点', '柳浪闻莺', '望仙桥客栈', '回春堂国药', '全天营业',
  '钱塘智造', '烟雨江南夜', '断桥残雪', '梦回临安',
];
export const SCRIPT_TXT = ['烟雨江南', '西子湖畔', '钱塘夜色', '龙井问茶', '寻梦临安', '武林繁华', '运河灯火', '醉美杭州'];

const PXM = 190; // atlas pixels per metre (nominal)

export async function buildLibrary(images) {
  await loadFonts();
  const NA = new NeonAtlas(4096);
  const CA = new ColorAtlas(4096);
  const rnd = mulberry32(4242);
  const L = { neonV: [], neonH: [], neonIcon: [], chanH: [], boxV: [], boxH: [], boxSq: [], posters: [], screens: [], tenant: [], misc: {} };
  const put = (arr, rect, mode, extra = {}) => { if (rect) { const d = { rect, mode, aspect: rect.w / rect.h, natural: [rect.w / PXM, rect.h / PXM], ...extra }; arr.push(d); return d; } return null; };

  // ---------------- neon vertical blades (tube text, optional border)
  const vlist = [...JP_V, ...LAT_V];
  vlist.forEach((txt) => {
    const chars = [...txt].length;
    const W = 160, size = chars > 4 ? 92 : 108, step = size * 1.08;
    const H = Math.round(chars * step + 84);
    const outline = rnd() < 0.4;
    const font = rnd.pick([FONTS.goth, FONTS.meiryo, FONTS.mincho, FONTS.goth]);
    const items = [{ type: 'text', text: txt, x: W / 2, y: H / 2, size, font, weight: outline ? 800 : 500, vertical: true, style: outline ? 'stroke' : 'fill', lw: 5 }];
    if (rnd() < 0.75) items.push({ type: 'rect', x: 14, y: 14, w: W - 28, h: H - 28, r: 20, lw: 5 });
    if (rnd() < 0.3) items.push({ type: 'rect', x: 26, y: 26, w: W - 52, h: H - 52, r: 10, lw: 4 });
    put(L.neonV, NA.add({ w: W, h: H, items }), 0, { text: txt });
  });

  // overlook hero: 钱塘江 + 烟雨江南
  {
    const W = 230, size = 148, H = 7 * size * 1.04 + 120;
    const items = [
      { type: 'text', text: '钱塘江', x: W / 2, y: 60 + 1.5 * size * 1.04, size, font: FONTS.mincho, weight: 700, vertical: true, style: 'fill', lw: 6 },
      { type: 'text', text: '烟雨江南', x: W / 2, y: 60 + 5 * size * 1.04, size: size * 0.9, font: FONTS.goth, weight: 700, vertical: true, style: 'fill', lw: 6 },
      { type: 'rect', x: 16, y: 16, w: W - 32, h: H - 32, r: 30, lw: 7 },
    ];
    L.misc.neonOverlook = put([], NA.add({ w: W, h: Math.round(H), items }), 0, { text: '钱塘江烟雨江南' });
  }

  // ---------------- neon horizontal (tube) + calligraphy script
  H_TXT.forEach((txt) => {
    const size = 96;
    const font = rnd.pick([FONTS.goth, FONTS.mincho, FONTS.meiryo]);
    const g = document.createElement('canvas').getContext('2d');
    g.font = `700 ${size}px ${font}`;
    const tw = g.measureText(txt).width * 1.08;
    const W = Math.min(1100, Math.round(tw + 90)), H = 172;
    const outline = rnd() < 0.5;
    const items = [{ type: 'text', text: txt, x: W / 2, y: H / 2, size, font, weight: outline ? 700 : 500, style: outline ? 'stroke' : 'fill', lw: 5, maxW: W - 76, track: 0.05 }];
    if (rnd() < 0.6) items.push({ type: 'rect', x: 12, y: 12, w: W - 24, h: H - 24, r: 30, lw: 5 });
    put(L.neonH, NA.add({ w: W, h: H, items }), 0, { text: txt });
  });
  SCRIPT_TXT.forEach((txt) => {
    const W = 520, H = 220;
    const items = [{ type: 'text', text: txt, x: W / 2, y: H / 2 + 8, size: 112, font: FONTS.script, weight: 700, style: 'fill', lw: 6, maxW: W - 60 }];
    if (rnd() < 0.5) items.push({ type: 'path', pts: [[60, H - 46], [W - 60, H - 46]], lw: 7 });
    put(L.neonH, NA.add({ w: W, h: H, items }), 0, { text: txt, script: true });
  });

  // ---------------- neon icons (teapot, lotus, arrow, lantern, fan)
  {
    const W = 400, H = 400;
    const cocktail = [{ type: 'path', pts: [[90, 90], [310, 90], [200, 220], [90, 90]], lw: 9, closed: true }, { type: 'path', pts: [[200, 220], [200, 320]], lw: 9 }, { type: 'path', pts: [[140, 325], [260, 325]], lw: 9 }, { type: 'circle', x: 270, y: 80, r: 26, lw: 8 }, { type: 'path', pts: [[200, 160], [300, 50]], lw: 6 }];
    put(L.neonIcon, NA.add({ w: W, h: H, items: cocktail }), 0, { text: 'cocktail' });
    const heart = []; const hp = [];
    for (let i = 0; i <= 64; i++) { const t = i / 64 * Math.PI * 2; const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); hp.push([200 + x * 9.5, 190 - y * 9.5]); }
    heart.push({ type: 'path', pts: hp, lw: 10, closed: true });
    heart.push({ type: 'path', pts: hp.map(([x, y]) => [200 + (x - 200) * 0.72, 190 + (y - 190) * 0.72]), lw: 7, closed: true });
    put(L.neonIcon, NA.add({ w: W, h: H, items: heart }), 0, { text: 'heart' });
    const arrow = [];
    for (let k = 0; k < 4; k++) arrow.push({ type: 'path', pts: [[60 + k * 80, 110], [120 + k * 80, 200], [60 + k * 80, 290]], lw: 12 });
    put(L.neonIcon, NA.add({ w: W, h: H, items: arrow }), 0, { text: 'arrow', chase: true });
    const note = [{ type: 'path', pts: [[150, 300], [150, 90], [290, 60], [290, 270]], lw: 10 }, { type: 'circle', x: 120, y: 300, r: 32, lw: 10 }, { type: 'circle', x: 260, y: 272, r: 32, lw: 10 }];
    put(L.neonIcon, NA.add({ w: W, h: H, items: note }), 0, { text: 'note' });
    const eye = []; const ep = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI * 2; ep.push([200 + Math.cos(t) * 160, 200 + Math.sin(t) * 80 * Math.abs(Math.sin(t)) ** 0.3 * Math.sign(Math.sin(t))]); }
    eye.push({ type: 'path', pts: ep, lw: 9, closed: true }, { type: 'circle', x: 200, y: 200, r: 44, lw: 9 }, { type: 'circle', x: 200, y: 200, r: 12, lw: 9 });
    put(L.neonIcon, NA.add({ w: W, h: H, items: eye }), 0, { text: 'eye' });
  }

  // ---------------- LED channel letters (filled bold) – used for rooftop / big horizontal signs
  [
    '钱塘科技', '西子云端', '雷峰重工', '武林广场', '烟雨江南', '西湖龙井',
    '江南造物', '南宋御街', '拱宸智谷', '钱塘银行', '灵隐算力', '霓虹钱塘',
  ].forEach((txt) => {
    const size = 148;
    const font = FONTS.goth;
    const g = document.createElement('canvas').getContext('2d');
    g.font = `700 ${size}px ${font}`;
    const W = Math.min(1600, Math.round(g.measureText(txt).width * 1.15 + 70)), H = 210;
    put(L.chanH, NA.add({ w: W, h: H, items: [{ type: 'text', text: txt, x: W / 2, y: H / 2, size, font, weight: 700, style: 'fill', lw: 4, maxW: W - 60, track: 0.08 }] }), 4, { text: txt });
  });

  // ---------------- Square Jiangnan Lightboxes (replaces Japanese lightbox_atlas cells with authentic Chinese seals & plaques)
  const sqDesigns = [
    { title: '片儿川', sub: '老杭州手工面', seal: '奎', bg: '#f6f0e2', fg: '#b81c22', accent: '#1e1b18' },
    { title: '西湖龙井', sub: '明前狮峰新茶', seal: '茶', bg: '#163828', fg: '#f4e6c2', accent: '#d8a848' },
    { title: '知味小笼', sub: '百年江南名点', seal: '鲜', bg: '#c81e24', fg: '#fff8ea', accent: '#f4c852' },
    { title: '杭罗丝绸', sub: '非遗云锦织造', seal: '绸', bg: '#182442', fg: '#f8e8c8', accent: '#52c8e8' },
    { title: '太和酒肆', sub: '绍兴女儿红', seal: '酒', bg: '#221816', fg: '#ffcf58', accent: '#d82828' },
    { title: '回春国医', sub: '江南草本堂', seal: '医', bg: '#f2ece0', fg: '#152822', accent: '#b82222' },
    { title: '听雨茶社', sub: '江南评弹雅集', seal: '曲', bg: '#281632', fg: '#ffd8f0', accent: '#ff58b8' },
    { title: '武林游艺', sub: '全息赛博茶馆', seal: '戏', bg: '#101824', fg: '#48f0ff', accent: '#ff3868' },
  ];
  sqDesigns.forEach((d, idx) => {
    put(L.boxSq, CA.add(360, 360, (g) => {
      g.fillStyle = d.bg; g.fillRect(0, 0, 360, 360);
      g.strokeStyle = d.accent; g.lineWidth = 10; g.strokeRect(14, 14, 332, 332);
      g.strokeStyle = d.fg; g.lineWidth = 3; g.strokeRect(26, 26, 308, 308);
      // Red Jiangnan seal in top-right
      g.fillStyle = '#c81e24'; roundRect(g, 268, 38, 54, 54, 8); g.fill();
      textCentered(g, d.seal, 295, 66, FONTS.mincho, 900, 44, 38, '#fff8ea');
      // Main plaque title
      textCentered(g, d.title, 172, 168, FONTS.mincho, 900, 290, 96, d.fg);
      // Decorative divider
      g.fillStyle = d.accent; g.fillRect(46, 232, 268, 4);
      textCentered(g, d.sub, 180, 286, FONTS.goth, 700, 280, 38, d.fg);
    }), 1, { text: 'lb' + idx });
  });

  // ---------------- canvas light boxes – vertical blades (Jiangnan shop plaques)
  const schemes = [
    { bg: '#f4f1ea', fg: '#c8161d', band: '#c8161d' },
    { bg: '#fff6d0', fg: '#141210', band: '#d62020' },
    { bg: '#ffd400', fg: '#151515', band: '#151515' },
    { bg: '#f5f2eb', fg: '#18388a', band: '#18388a' },
    { bg: '#c81422', fg: '#fff8eb', band: '#ffd858' },
    { bg: '#161412', fg: '#ffd038', band: '#ffd038' },
    { bg: '#162868', fg: '#ffffff', band: '#40d0ff' },
    { bg: '#183c2c', fg: '#f6ebd2', band: '#d8a848' },
    { bg: '#206848', fg: '#ffffff', band: '#ffe070' },
    { bg: '#ffffff', fg: '#111111', band: '#e85a00' },
    { bg: '#4e1688', fg: '#ffffff', band: '#ff60d0' },
    { bg: '#d85810', fg: '#ffffff', band: '#ffffff' },
  ];
  vlist.slice(0, 30).forEach((txt, i) => {
    const s = schemes[i % schemes.length];
    const chars = [...txt].length;
    const W = 150, H = Math.max(320, Math.round(chars * 120 + 90));
    put(L.boxV, CA.add(W, H, (g) => {
      g.fillStyle = s.bg; g.fillRect(0, 0, W, H);
      g.fillStyle = s.band; g.fillRect(0, 0, W, 28); g.fillRect(0, H - 28, W, 28);
      g.strokeStyle = s.band; g.lineWidth = 4; g.strokeRect(10, 36, W - 20, H - 72);
      textVertical(g, txt, W / 2, 54, H - 54, FONTS.mincho, 900, 110, s.fg);
      g.fillStyle = s.bg; g.font = `700 14px ${FONTS.goth}`; g.textAlign = 'center'; g.fillText('杭州老字号', W / 2, 19);
    }), 1, { text: txt });
  });

  // ---------------- canvas light boxes – horizontal fascia (shop name + sub line)
  const fasc = [
    ['奎元片儿川', 'PIAN ER CHUAN · 老杭州面馆'],
    ['太和酒家', 'JIANGNAN TAVERN · 江南小酒馆'],
    ['听雨轩评弹', 'PINGTAN TEAHOUSE · 廿四小时'],
    ['回春堂国药', 'HERBAL APOTHECARY · 百年药铺'],
    ['知味观小笼', 'ZHIWEIGUAN · 江南名点'],
    ['楼外楼雅座', 'LOUWAILOU · 西湖醋鱼'],
    ['西子便利店', 'XIZI MART · 24小时营业'],
    ['武林电玩城', 'WULIN ARCADE · 全息游艺'],
    ['运河大茶楼', 'GRAND CANAL TEA · 明前龙井'],
    ['钱塘丝绸庄', 'QIANTANG SILK · 绫罗绸缎'],
    ['湖滨桂花厅', 'OSMANTHUS CAFE · 桂花糖藕'],
    ['保俶古玩轩', 'ANTIQUE & JADE · 奇珍异宝'],
    ['西子湖国宾馆', 'WEST LAKE HOTEL · 临湖雅居'],
    ['雷峰赛博工坊', 'LEIFENG CYBER · 义体定制'],
    ['南宋定胜糕', 'SONG PASTRY · 手工现蒸'],
    ['河坊葱包桧', 'HEFANG SNACKS · 传统小食'],
    ['拱宸桥网咖', 'CANAL NETCAFE · 极速算力'],
    ['曲院风荷酒廊', 'LOTUS LOUNGE · 微醺夜饮'],
  ];
  fasc.forEach(([a, b], i) => {
    const s = schemes[(i * 5 + 3) % schemes.length];
    const W = 720, H = 160;
    put(L.boxH, CA.add(W, H, (g) => {
      g.fillStyle = s.bg; g.fillRect(0, 0, W, H);
      g.fillStyle = s.band; g.fillRect(0, H - 20, W, 20);
      textCentered(g, a, W / 2 - 50, 64, FONTS.mincho, 900, W - 160, 92, s.fg);
      textCentered(g, b, W / 2 - 50, 124, FONTS.goth, 700, W - 240, 25, s.fg);
      g.fillStyle = s.band; g.beginPath(); g.arc(W - 72, 72, 52, 0, Math.PI * 2); g.fill();
      textCentered(g, [...a][0], W - 72, 72, FONTS.mincho, 900, 72, 64, s.bg);
    }), 1, { text: a });
  });

  // ---------------- small tenant-directory boxes (stacked building signs)
  const tenants = [
    '听雨茶室', '望湖棋牌', '雀神麻将', '曲院茶座', '江南推拿',
    '灵隐卜算', '仁和齿科', '钱塘当铺', '风荷雅集', '西泠印学',
    '古法正骨', '越剧票房', '夜航船吧', '回春针灸', '廿三号酒馆',
    '湖滨雀庄', '叫花童鸡', '投壶飞镖', '桂花酒酿', '西子美甲',
  ];
  tenants.forEach((t, i) => {
    const s = schemes[(i * 7 + 1) % schemes.length];
    put(L.tenant, CA.add(300, 150, (g) => {
      g.fillStyle = s.bg; g.fillRect(0, 0, 300, 150);
      g.strokeStyle = s.band; g.lineWidth = 6; g.strokeRect(8, 8, 284, 134);
      textCentered(g, t, 150, 78, FONTS.goth, 800, 260, 76, s.fg);
    }), 1, { text: t });
  });

  // ---------------- painted Hangzhou Jiangnan street posters (replaces Japanese posters_atlas)
  const posterSpecs = [
    { top: '西湖夜游', mid: '三潭印月 · 画舫凌波', bot: '每晚七时 湖滨码头启航', bg: '#102438', fg: '#f8e6b8', acc: '#38d8ff' },
    { top: '明前龙井', mid: '狮峰头采 · 甘醇如玉', bot: '钱塘茶庄 诚邀品鉴', bg: '#163626', fg: '#f4ebd0', acc: '#88e868' },
    { top: '江南评弹', mid: '琵琶三弦 · 吴侬软语', bot: '河坊古街 听雨轩夜演', bg: '#321424', fg: '#ffe8f0', acc: '#ff60a8' },
    { top: '南宋夜市', mid: '百工百戏 · 灯火通明', bot: '御街坊市 通宵达旦', bg: '#88181c', fg: '#fff6d8', acc: '#ffd040' },
    { top: '越剧新声', mid: '梁祝化蝶 · 全息重现', bot: '武林大剧院 赛博戏台', bg: '#241842', fg: '#f0e8ff', acc: '#b070ff' },
    { top: '知味早茶', mid: '虾肉小笼 · 桂花糖藕', bot: '百年老字号 现包现蒸', bg: '#f4ecd8', fg: '#8e1818', acc: '#d04020' },
    { top: '钱塘观潮', mid: '一线怒潮 · 气吞山河', bot: '六和塔下 智驾专线直达', bg: '#0e1e36', fg: '#ffffff', acc: '#00e8ff' },
    { top: '杭罗云锦', mid: '霓裳羽衣 · 纳米丝绸', bot: '拱宸桥西 江南织造局', bg: '#1f1916', fg: '#ffd898', acc: '#ff5040' },
  ];
  posterSpecs.forEach((p) => {
    put(L.posters, CA.add(256, 256, (g) => {
      g.fillStyle = p.bg; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = p.acc; g.lineWidth = 6; g.strokeRect(10, 10, 236, 236);
      g.fillStyle = p.acc; g.fillRect(22, 22, 212, 34);
      textCentered(g, '杭州 · 二零七七', 128, 40, FONTS.goth, 800, 190, 22, p.bg);
      textCentered(g, p.top, 128, 114, FONTS.mincho, 900, 210, 68, p.fg);
      textCentered(g, p.mid, 128, 174, FONTS.goth, 700, 214, 28, p.acc);
      textCentered(g, p.bot, 128, 218, FONTS.goth, 600, 214, 20, p.fg);
    }), 3);
  });

  // ---------------- video ads (screens) with Chinese Jiangnan cyber graphics
  const screenSpecs = [
    { title: '西湖龙井', sub: '赛博茶道 · 灵隐高山云雾', tag: 'QIANTANG TEA 2077', bg0: '#0a2e22', bg1: '#185a3e', acc: '#5effb8' },
    { title: '钱塘智驾', sub: '低空凌波 · 西子全息轿跑', tag: 'XIZI MOTORS', bg0: '#0c1a38', bg1: '#241848', acc: '#48e8ff' },
    { title: '江南霓裳', sub: '非遗杭罗 · 光学纳米丝绸', tag: 'SILK STUDIO', bg0: '#381028', bg1: '#180c2c', acc: '#ff62c8' },
    { title: '知味名点', sub: '百年杭帮 · 廿四小时热供', tag: 'ZHIWEI CUISINE', bg0: '#3e1410', bg1: '#1e100c', acc: '#ffd248' },
  ];
  screenSpecs.forEach((sc) => {
    put(L.screens, CA.add(300, 300, (g) => {
      const gr = g.createLinearGradient(0, 0, 300, 300);
      gr.addColorStop(0, sc.bg0); gr.addColorStop(1, sc.bg1);
      g.fillStyle = gr; g.fillRect(0, 0, 300, 300);
      g.strokeStyle = sc.acc; g.lineWidth = 6; g.strokeRect(12, 12, 276, 276);
      textCentered(g, sc.tag, 150, 52, FONTS.bahn, 700, 240, 24, sc.acc);
      textCentered(g, sc.title, 150, 146, FONTS.mincho, 900, 250, 88, '#ffffff');
      textCentered(g, sc.sub, 150, 232, FONTS.goth, 700, 250, 32, sc.acc);
    }), 5);
  });

  // ---------------- misc: P parking, road signs, Jiangnan wall poetic text, tavern box, 24H sign
  L.misc.parking = put([], CA.add(256, 256, (g) => {
    g.fillStyle = '#1050d0'; roundRect(g, 0, 0, 256, 256, 28); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 12, 12, 232, 232, 20); g.stroke();
    textCentered(g, 'P', 128, 108, FONTS.arial, 900, 180, 150, '#ffffff');
    textCentered(g, '停车', 128, 206, FONTS.goth, 800, 180, 48, '#ffffff');
  }), 1);
  L.misc.parkingSub = put([], CA.add(256, 512, (g) => {
    g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 256, 512);
    textVertical(g, '停车场', 128, 30, 330, FONTS.goth, 900, 150, '#1050d0');
    g.fillStyle = '#1aa040'; g.fillRect(28, 360, 200, 120);
    textCentered(g, '空位', 128, 420, FONTS.goth, 900, 160, 82, '#ffffff');
  }), 1);
  L.misc.goodgames = put([], CA.add(1024, 384, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 384);
    textCentered(g, '烟雨入江南', 512, 120, FONTS.mincho, 900, 960, 140, '#f4f2ee');
    textCentered(g, '灯火照钱塘', 512, 280, FONTS.mincho, 900, 960, 140, '#f4f2ee');
  }), 3);
  L.misc.nomiya = put([], CA.add(700, 300, (g) => {
    g.fillStyle = '#f4eee0'; g.fillRect(0, 0, 700, 300);
    g.strokeStyle = '#a01010'; g.lineWidth = 10; g.strokeRect(10, 10, 680, 280);
    textCentered(g, '太和酒家', 350, 120, FONTS.mincho, 900, 600, 156, '#151010');
    textCentered(g, '绍兴黄酒 · 江南夜肆', 350, 245, FONTS.goth, 800, 520, 52, '#a01010');
  }), 1);
  L.misc.sign24 = put([], CA.add(256, 256, (g) => {
    g.fillStyle = '#101010'; g.fillRect(0, 0, 256, 256);
    textCentered(g, '24', 128, 110, FONTS.arial, 900, 220, 150, '#ffe040');
    textCentered(g, '全天营业', 128, 210, FONTS.goth, 800, 200, 48, '#ffffff');
  }), 1);
  L.misc.stop = put([], CA.add(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256); g.fillStyle = '#101010'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(10, 20); g.lineTo(246, 20); g.lineTo(128, 236); g.closePath(); g.fill();
    g.fillStyle = '#d01818'; g.beginPath(); g.moveTo(30, 32); g.lineTo(226, 32); g.lineTo(128, 214); g.closePath(); g.fill();
    textCentered(g, '慢行', 128, 84, FONTS.goth, 900, 140, 56, '#ffffff');
  }), 3);
  L.misc.speed = put([], CA.add(256, 256, (g) => {
    g.fillStyle = '#101010'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.fillStyle = '#d01818'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.fill();
    textCentered(g, '40', 128, 132, FONTS.bahn, 700, 140, 110, '#1040a0');
  }), 3);
  L.misc.crossing = put([], CA.add(256, 256, (g) => {
    g.fillStyle = '#1050c0'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(128, 26); g.lineTo(232, 214); g.lineTo(24, 214); g.closePath(); g.fill();
    g.fillStyle = '#101010'; g.beginPath(); g.arc(128, 96, 14, 0, 7); g.fill(); g.fillRect(118, 112, 20, 50);
    g.fillRect(100, 180, 56, 10);
  }), 3);
  L.misc.direction = put([], CA.add(768, 384, (g) => {
    g.fillStyle = '#1048b8'; g.fillRect(0, 0, 768, 384);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(12, 12, 744, 360);
    g.fillStyle = '#fff'; g.fillRect(372, 60, 24, 300); g.beginPath(); g.moveTo(384, 30); g.lineTo(430, 90); g.lineTo(338, 90); g.closePath(); g.fill();
    g.fillRect(80, 220, 300, 24); g.beginPath(); g.moveTo(50, 232); g.lineTo(110, 190); g.lineTo(110, 274); g.closePath(); g.fill();
    textCentered(g, '西湖景区', 200, 140, FONTS.goth, 800, 250, 78, '#fff'); textCentered(g, 'West Lake', 200, 300, FONTS.bahn, 600, 220, 40, '#fff');
    textCentered(g, '拱宸桥', 590, 140, FONTS.goth, 800, 260, 82, '#fff'); textCentered(g, 'Gongchen Bridge', 590, 220, FONTS.bahn, 600, 260, 36, '#fff');
    textCentered(g, '武林广场', 590, 300, FONTS.goth, 800, 260, 70, '#fff');
  }), 3);

  // pedestrian signal icons (red standing man, green walking man) 2 cells
  const pedIcon = (walk) => (g) => {
    g.fillStyle = '#050505'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = walk ? '#30ffd0' : '#ff2a18';
    g.beginPath(); g.arc(64, 26, 12, 0, 7); g.fill();
    g.lineCap = 'round'; g.strokeStyle = g.fillStyle; g.lineWidth = 14;
    g.beginPath();
    if (walk) { g.moveTo(64, 44); g.lineTo(58, 80); g.lineTo(40, 112); g.moveTo(58, 80); g.lineTo(80, 110); g.moveTo(62, 52); g.lineTo(40, 72); g.moveTo(62, 52); g.lineTo(86, 70); }
    else { g.moveTo(64, 44); g.lineTo(64, 82); g.moveTo(56, 82); g.lineTo(54, 118); g.moveTo(72, 82); g.lineTo(74, 118); g.moveTo(60, 50); g.lineTo(46, 84); g.moveTo(68, 50); g.lineTo(82, 84); }
    g.stroke();
  };
  L.misc.pedR = put([], CA.add(128, 128, pedIcon(false)), 1);
  L.misc.pedG = put([], CA.add(128, 128, pedIcon(true)), 1);

  // lantern calligraphy cells (ink mask drawn black on white) – used by lantern material
  L.lanternCells = {};
  const lanternTexts = ['片', '儿', '川', '面', '太', '和', '酒', '茶', '西湖', '龙井', '叫花鸡', '杭', '知味', '河坊街', '鲜'];
  for (const t of new Set(lanternTexts)) {
    const n = [...t].length;
    const H = n >= 3 ? 512 : 256;
    L.lanternCells[t] = CA.add(256, H, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, H);
      if (n === 1) textCentered(g, t, 128, 128, FONTS.mincho, 900, 200, 200, '#000');
      else textVertical(g, t, 128, 14, H - 14, FONTS.mincho, 900, n >= 3 ? 180 : 120, '#000');
    });
  }

  // QIANTANG TECH holo text ring
  L.misc.holoRing = put([], CA.add(2048, 160, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 160);
    const txt = '  欢迎来到 霓虹钱塘  ◆  烟雨江南 · 二零七七  ◆  西子湖畔  ◆  钱塘科技  ◆ ';
    textCentered(g, txt, 1024, 80, FONTS.goth, 800, 2000, 104, '#ffffff');
  }), 3);

  console.log(`[signage] atlas usage neon ${NA.packer.y + NA.packer.rowH}/${NA.S}px, colour ${CA.packer.y + CA.packer.rowH}/${CA.S}px`);
  return { L, neonTex: NA.texture(), colorTex: CA.texture(), NA, CA };
}
