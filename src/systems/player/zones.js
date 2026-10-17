// District / area detection from LAYOUT. Returns a stable zone descriptor for HUD pop-ups and the minimap.
export function createZones(L) {
  const av = L.avenue, cs = L.crossStreets, al = L.alley, pr = L.promenade, rv = L.river, ov = L.overlook;
  const zones = [
    {
      id: 'overlook', district: '湖滨·延安路', area: '钱塘天际观景台', jp: '天际观景台', tint: 'cyan',
      test: (x, y, z) => y > 14 && Math.hypot(x - ov.position[0], z - ov.position[2]) < 30,
    },
    {
      id: 'bridge', district: '拱宸桥西', area: '拱宸映月桥', jp: '大运河古桥', tint: 'cyan',
      test: (x, y, z) => L.bridges.some((b) => Math.abs(z - b.z) < 9) && x > rv.xCenter - rv.halfWidth - 6 && x < rv.xCenter + rv.halfWidth + 6,
    },
    {
      id: 'alley', district: '河坊古街', area: '御街灯笼巷', jp: '南宋御街坊', tint: 'red',
      test: (x, y, z) => x < al.xStart + 2 && x > al.xEnd - 6 && Math.abs(z - al.z) < al.width * 0.5 + 4,
    },
    {
      id: 'river', district: '西子湖畔', area: '柳浪闻莺步道', jp: '西湖十景', tint: 'pink',
      test: (x) => x > pr.xMin - 14 && x < rv.xCenter + rv.halfWidth + 20,
    },
    {
      id: 'cross', district: '武林商圈', area: '武林夜市街口', jp: '武林门夜市', tint: 'yellow',
      test: (x, y, z) => Math.abs(x - av.x) > av.roadHalfWidth + av.sidewalkWidth + 4 && cs.zs.some((cz) => Math.abs(z - cz) < cs.roadHalfWidth + cs.sidewalkWidth + 6),
    },
    {
      id: 'avenue', district: '湖滨·延安路', area: '钱塘霓虹大道', jp: '延安路核心区', tint: 'yellow',
      test: (x) => Math.abs(x - av.x) < av.roadHalfWidth + av.sidewalkWidth + 14,
    },
  ];
  const fallback = { id: 'district', district: '南宋御街', area: '江南里弄深巷', jp: '青石板里弄', tint: 'red' };
  return {
    list: zones,
    at(x, y, z) {
      for (const zn of zones) if (zn.test(x, y, z)) return zn;
      return fallback;
    },
  };
}
