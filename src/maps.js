/* Tin Soldiers: Nova - authored arenas. Three 1v1 boards plus three large / very-large 3v3 battlefields.
   Everything is authored for the first team and mirrored (point / x / z) so both teams get exactly equivalent geometry. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});

  const c = (k, x, z, r, cover, mid) => ({ k, s: 'c', x, z, r, cover: cover || 0, mid: !!mid });
  const r = (k, x0, z0, x1, z1, cover, mid) => ({ k, s: 'r', x0, z0, x1, z1, cover: cover || 0, mid: !!mid });
  function ring(k, cx, cz, R, n, rad, phase, cover) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2;
      out.push(c(k, +(cx + Math.cos(a) * R).toFixed(2), +(cz + Math.sin(a) * R).toFixed(2), rad, cover, true));
    }
    return out;
  }
  const site = (k, x, z) => ({ k, x, z });

  const MAPS = {
    /* ------------------------------------------------------------------ 1v1 boards (unchanged geometry) */
    cinder: {
      id: 'cinder', name: 'Cinder Ridge Outpost', format: '1v1', size: 'compact', w: 96, h: 96, mirror: 'point',
      blurb: 'Cratered highlands. Two ridge-walled bases, ash pits that slow movement, and a boulder-ringed central crater full of cover.',
      starts: [{ x: 14, z: 82 }],
      deposits: [{ x: 6, z: 76, a: 1500 }, { x: 6, z: 86, a: 1500 }, { x: 22, z: 90, a: 1500 }, { x: 24, z: 80, a: 1500 },
        { x: 28, z: 56, a: 2000 }, { x: 32, z: 60, a: 2000 }, { x: 40, z: 48, a: 2500 }],
      obstacles: [r('ridge', 0, 64, 20, 67), r('ridge', 36, 76, 39, 96),
        c('rock', 26, 72, 2.2, 1), c('rock', 30, 66, 1.6, 1), c('rock', 36, 64, 1.8, 1), c('rock', 24, 56, 1.8, 1), c('rock', 38, 52, 2.4, 1),
        c('rock', 44, 60, 1.6, 1), c('rock', 18, 52, 2, 1), c('rock', 34, 44, 2.2, 1), c('rock', 46, 72, 1.8, 1), c('rock', 12, 60, 1.5, 1)]
        .concat(ring('rock', 48, 48, 8.5, 8, 1.5, Math.PI / 8, 1)),
      slow: [{ s: 'c', x: 30, z: 40, r: 6, m: 0.6 }, { s: 'c', x: 20, z: 60, r: 4, m: 0.6 }],
      objectives: [{ x: 24, z: 52 }, { x: 48, z: 48, mid: true }],
      sites: [],
      theme: { name: 'cinder', ground: [0x5b3a2a, 0x7a4b34, 0x3d2a24], sky: 0x241612, fog: 0x2d1c16, sun: 0xffb37a, amb: 0x6d4a3c, amp: 0.7, prop: 'rock' },
    },
    karthaga: {
      id: 'karthaga', name: 'Wreck of the Karthaga', format: '1v1', size: 'compact', w: 88, h: 88, mirror: 'x',
      blurb: 'A crashed orbital vessel. A shattered hull spine splits the map; breaches, deck plates and wreckage make tight lanes and flank routes.',
      starts: [{ x: 12, z: 44 }],
      deposits: [{ x: 5, z: 38, a: 1500 }, { x: 5, z: 50, a: 1500 }, { x: 19, z: 36, a: 1500 }, { x: 19, z: 52, a: 1500 },
        { x: 24, z: 12, a: 2200 }, { x: 24, z: 76, a: 2200 }, { x: 36, z: 44, a: 2500 }],
      obstacles: [r('wreck', 42, 4, 46, 26, 0, true), r('wreck', 42, 32, 46, 40, 0, true), r('wreck', 42, 48, 46, 56, 0, true), r('wreck', 42, 62, 46, 84, 0, true),
        r('wreck', 24, 20, 27, 34, 2), r('wreck', 24, 54, 27, 68, 2),
        c('wreck', 33, 44, 1.8, 1), c('wreck', 34, 30, 1.6, 1), c('wreck', 34, 58, 1.6, 1), c('wreck', 30, 22, 1.4, 1), c('wreck', 30, 66, 1.4, 1),
        c('wreck', 16, 26, 1.5, 1), c('wreck', 16, 62, 1.5, 1), c('wreck', 38, 36, 1.3, 1), c('wreck', 38, 52, 1.3, 1)],
      slow: [{ s: 'c', x: 36, z: 30, r: 4, m: 0.6 }, { s: 'c', x: 36, z: 58, r: 4, m: 0.6 }],
      objectives: [{ x: 44, z: 44, mid: true }, { x: 30, z: 72 }],
      sites: [],
      theme: { name: 'karthaga', ground: [0x2f3439, 0x424a52, 0x22272b], sky: 0x0e1418, fog: 0x141b20, sun: 0xbfd8ff, amb: 0x384a5c, amp: 0.35, prop: 'wreck' },
    },
    prismatic: {
      id: 'prismatic', name: 'Prismatic Vale', format: '1v1', size: 'compact', w: 80, h: 80, mirror: 'z',
      blurb: 'Crystalline ruins. A slow shard-river cuts the vale with three fords; crystal spires and toppled colonnades offer cover.',
      starts: [{ x: 40, z: 12 }],
      deposits: [{ x: 33, z: 8, a: 1500 }, { x: 47, z: 8, a: 1500 }, { x: 31, z: 17, a: 1500 }, { x: 49, z: 17, a: 1500 },
        { x: 14, z: 22, a: 2200 }, { x: 66, z: 22, a: 2200 }, { x: 36, z: 38, a: 2600 }],
      obstacles: [c('crystal', 24, 30, 3, 1), c('crystal', 56, 30, 3, 1), c('crystal', 40, 28, 2.5, 1), c('crystal', 12, 10, 2.5), c('crystal', 68, 10, 2.5), c('crystal', 30, 34, 1.6, 1), c('crystal', 50, 34, 1.6, 1),
        r('crystal', 0, 36, 12, 44, 0, true), r('crystal', 22, 36, 30, 44, 0, true), r('crystal', 50, 36, 58, 44, 0, true), r('crystal', 68, 36, 80, 44, 0, true)]
        .concat([6, 12, 18, 24, 50, 56, 62, 68, 74].map((x) => c('ruin', x, 24, 0.9, 2)))
        .concat([26, 34, 46, 54].map((x) => c('ruin', x, 20, 0.9, 2))),
      slow: [{ s: 'r', x0: 0, z0: 36, x1: 80, z1: 44, m: 0.55, mid: true }],
      objectives: [{ x: 40, z: 40, mid: true }, { x: 17, z: 40, mid: true }, { x: 63, z: 40, mid: true }],
      sites: [],
      theme: { name: 'prismatic', ground: [0x2a2450, 0x3f3a78, 0x1c1838], sky: 0x120c26, fog: 0x1a1236, sun: 0xb8a4ff, amb: 0x4a3f7a, amp: 0.5, prop: 'crystal' },
    },

    /* ------------------------------------------------------------------ 3v3: Splitrock Lanes (Large 112x112, mirrored east-west)
       Shape: THREE PARALLEL LANES. Each base pocket has one wide exit; lane dividers leave an 8-wide centre choke and a lateral corridor by the pockets. */
    lanes: {
      id: 'lanes', name: 'Splitrock Lanes', format: '3v3', size: 'large', w: 112, h: 112, mirror: 'x',
      blurb: 'Three walled lanes. Each commander holds a base pocket; lanes pinch to an 8-tile choke at the middle, with lateral corridors by the pockets, foundries on the crossroads and nexus links up the lanes.',
      starts: [{ x: 13, z: 18 }, { x: 13, z: 56 }, { x: 13, z: 94 }],
      deposits: [].concat(...[18, 56, 94].map((z) => [{ x: 6, z: z - 7, a: 1500 }, { x: 6, z: z + 7, a: 1500 }, { x: 20, z: z - 9, a: 1500 }, { x: 21, z: z + 9, a: 1500 }, { x: 44, z, a: 2200 }])),
      obstacles: [
        r('ridge', 32, 0, 35, 12), r('ridge', 32, 24, 35, 50), r('ridge', 32, 62, 35, 88), r('ridge', 32, 100, 35, 112),
        r('ridge', 40, 36, 52, 40), r('ridge', 40, 72, 52, 76),
        c('rock', 44, 24, 2.0, 1), c('rock', 48, 12, 1.8, 1), c('rock', 46, 30, 1.6, 1), c('rock', 40, 8, 1.6, 1), c('rock', 40, 28, 1.4, 1),
        c('rock', 46, 48, 2.0, 1), c('rock', 46, 64, 2.0, 1), c('rock', 50, 56, 1.4, 1),
        c('rock', 44, 88, 2.0, 1), c('rock', 48, 100, 1.8, 1), c('rock', 46, 82, 1.6, 1), c('rock', 40, 104, 1.6, 1), c('rock', 40, 84, 1.4, 1),
        c('rock', 24, 6, 1.5, 1), c('rock', 26, 44, 1.6, 1), c('rock', 26, 68, 1.6, 1), c('rock', 24, 106, 1.5, 1),
        c('rock', 56, 20, 1.5, 1, true), c('rock', 56, 92, 1.5, 1, true), c('rock', 56, 46, 1.5, 1, true), c('rock', 56, 66, 1.5, 1, true)],
      slow: [{ s: 'c', x: 44, z: 56, r: 5, m: 0.6 }, { s: 'c', x: 48, z: 20, r: 4, m: 0.6 }, { s: 'c', x: 48, z: 92, r: 4, m: 0.6 }],
      objectives: [{ x: 56, z: 18 }, { x: 56, z: 56 }, { x: 56, z: 94 }],
      sites: [site('radar', 56, 8), site('radar', 56, 104), site('foundry', 38, 38), site('foundry', 38, 74), site('nexus', 56, 30), site('nexus', 56, 82), site('nexus', 26, 56)],
      theme: { name: 'cinder', ground: [0x4b3b34, 0x6f5040, 0x2e2622], sky: 0x1d1512, fog: 0x2a1d18, sun: 0xffc38a, amb: 0x6a5044, amp: 0.8, prop: 'rock' },
    },

    /* ------------------------------------------------------------------ 3v3: Shardfall Basin (Large 112x112, point-mirrored)
       Shape: RADIAL. A pillar ring with ten gates guards a central crown; bases arc round the west/east rims, foundries sit in the four corners. */
    basin: {
      id: 'basin', name: 'Shardfall Basin', format: '3v3', size: 'large', w: 112, h: 112, mirror: 'point',
      blurb: 'A crystal basin. A ring of shard pillars with ten gates guards the central Recon Array; bases arc around the rims, foundries hold the four corners, transit nexuses hide at the north and south rim.',
      starts: [{ x: 14, z: 20 }, { x: 22, z: 56 }, { x: 14, z: 92 }],
      deposits: [
        { x: 6, z: 14, a: 1500 }, { x: 6, z: 26, a: 1500 }, { x: 20, z: 11, a: 1500 }, { x: 21, z: 29, a: 1500 },
        { x: 14, z: 50, a: 1500 }, { x: 14, z: 62, a: 1500 }, { x: 28, z: 47, a: 1500 }, { x: 29, z: 65, a: 1500 },
        { x: 6, z: 86, a: 1500 }, { x: 6, z: 98, a: 1500 }, { x: 20, z: 83, a: 1500 }, { x: 21, z: 101, a: 1500 },
        { x: 30, z: 38, a: 2200 }, { x: 30, z: 74, a: 2200 }, { x: 50, z: 62, a: 2600 }],
      obstacles: [
        c('crystal', 34, 8, 2.6, 1), c('crystal', 44, 12, 2.2, 1), c('crystal', 34, 104, 2.6, 1), c('crystal', 44, 100, 2.2, 1),
        c('crystal', 40, 26, 2.4, 1), c('crystal', 40, 86, 2.4, 1), c('crystal', 26, 40, 1.8, 1), c('crystal', 26, 72, 1.8, 1),
        r('crystal', 0, 40, 8, 44), r('crystal', 0, 68, 8, 72),
        c('ruin', 30, 20, 0.9, 2), c('ruin', 30, 26, 0.9, 2), c('ruin', 30, 86, 0.9, 2), c('ruin', 30, 92, 0.9, 2), c('ruin', 34, 52, 0.9, 2), c('ruin', 34, 60, 0.9, 2),
        c('ruin', 46, 30, 0.9, 2), c('ruin', 46, 82, 0.9, 2), c('ruin', 50, 42, 0.9, 2), c('ruin', 50, 70, 0.9, 2)]
        .concat(ring('crystal', 56, 56, 17, 10, 2.3, Math.PI / 10, 1)),
      slow: [{ s: 'c', x: 56, z: 56, r: 11, m: 0.7, mid: true }],
      objectives: [{ x: 56, z: 34 }, { x: 44, z: 56 }, { x: 68, z: 56 }, { x: 56, z: 78 }],
      sites: [site('radar', 56, 56), site('foundry', 34, 34), site('foundry', 34, 78), site('nexus', 56, 16), site('nexus', 34, 56)],
      theme: { name: 'prismatic', ground: [0x2c2652, 0x453f80, 0x1b1738], sky: 0x140d2a, fog: 0x1b1238, sun: 0xc4b0ff, amb: 0x4e4386, amp: 0.55, prop: 'crystal' },
    },

    /* ------------------------------------------------------------------ 3v3: The Long Wound (Very Large 144x144, point-mirrored)
       Shape: DIAGONAL CHASM. Teams start in opposite corners; a wreck-choked chasm cuts the anti-diagonal with three bridges and two long corner flanks. */
    wound: {
      id: 'wound', name: 'The Long Wound', format: '3v3', size: 'vlarge', w: 144, h: 144, mirror: 'point',
      blurb: 'A crashed dreadnought split the world. A chasm of wreckage runs corner to corner with three bridges and two long corner passes. Recon Arrays sit on the far corners, a foundry holds the middle bridge, nexuses link each side to its bridges.',
      starts: [{ x: 16, z: 16 }, { x: 16, z: 50 }, { x: 50, z: 16 }],
      deposits: [
        { x: 8, z: 10, a: 1500 }, { x: 8, z: 22, a: 1500 }, { x: 22, z: 7, a: 1500 }, { x: 23, z: 25, a: 1500 },
        { x: 8, z: 44, a: 1500 }, { x: 8, z: 56, a: 1500 }, { x: 22, z: 41, a: 1500 }, { x: 23, z: 59, a: 1500 },
        { x: 42, z: 10, a: 1500 }, { x: 42, z: 22, a: 1500 }, { x: 56, z: 7, a: 1500 }, { x: 57, z: 25, a: 1500 },
        { x: 34, z: 34, a: 2200 }, { x: 26, z: 72, a: 2200 }, { x: 72, z: 26, a: 2200 }, { x: 64, z: 60, a: 3000 }],
      obstacles: [].concat(
        // the chasm: a continuous wreck chain on the anti-diagonal, opened at three bridges (x = 32, 72, 112) and ended before the corners (long flank passes)
        Array.from({ length: 25 }, (_, i) => 12 + i * 5).filter((x) => Math.abs(x - 32) > 1 && Math.abs(x - 72) > 1 && Math.abs(x - 112) > 1).map((x) => c('wreck', x, 144 - x, Math.abs(x - 72) === 5 ? 2.4 : 3.2, 1, true)),
        [r('wreck', 34, 24, 38, 46, 2), r('wreck', 24, 60, 46, 64, 2), r('wreck', 56, 36, 80, 40, 2), r('wreck', 36, 56, 40, 80, 2), r('wreck', 60, 12, 64, 30, 2), r('wreck', 12, 84, 30, 88, 2),
          c('wreck', 44, 30, 1.8, 1), c('wreck', 30, 44, 1.8, 1), c('wreck', 50, 50, 2.2, 1), c('wreck', 60, 44, 1.6, 1), c('wreck', 44, 60, 1.6, 1), c('wreck', 22, 88, 1.8, 1), c('wreck', 66, 76, 1.8, 1), c('wreck', 84, 58, 1.8, 1),
          c('wreck', 10, 34, 1.6, 1), c('wreck', 34, 10, 1.6, 1)]),
      slow: [{ s: 'c', x: 72, z: 72, r: 6, m: 0.7, mid: true }, { s: 'c', x: 40, z: 40, r: 5, m: 0.65 }],
      objectives: [{ x: 56, z: 56 }, { x: 30, z: 72 }, { x: 72, z: 30 }],
      sites: [site('radar', 136, 8), site('foundry', 72, 72), site('foundry', 44, 72), site('nexus', 44, 44), site('nexus', 26, 100)],
      theme: { name: 'karthaga', ground: [0x30363b, 0x46505a, 0x22292e], sky: 0x0e151b, fog: 0x151d24, sun: 0xc6dcff, amb: 0x3a4d60, amp: 0.45, prop: 'wreck' },
    },
  };
  N.MAP_IDS = ['cinder', 'karthaga', 'prismatic'];
  N.MAP_IDS_3V3 = ['lanes', 'basin', 'wound'];
  N.ALL_MAP_IDS = N.MAP_IDS.concat(N.MAP_IDS_3V3);
  N.MAPS = MAPS;
  N.SIZE_LABEL = { compact: 'Compact', large: 'Large', vlarge: 'Very large' };

  function mirrorPt(m, W, H, x, z) {
    if (m === 'point') return [W - x, H - z];
    if (m === 'x') return [W - x, z];
    return [x, H - z];
  }
  function mirrorObs(m, W, H, o) {
    if (o.s === 'c') { const p = mirrorPt(m, W, H, o.x, o.z); return Object.assign({}, o, { x: p[0], z: p[1] }); }
    const a = mirrorPt(m, W, H, o.x0, o.z0), b = mirrorPt(m, W, H, o.x1, o.z1);
    return Object.assign({}, o, { x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]) });
  }

  // Deterministic map compile: terrain grid, slow grid, cover grid, mirrored lists. starts = [team0 slots..., team1 slots (mirrors, same order)].
  N.buildMap = function (id) {
    const src = MAPS[id];
    const W = src.w, H = src.h, m = src.mirror, n = src.starts.length;
    const obstacles = [];
    src.obstacles.forEach((o) => { obstacles.push(o); if (!o.mid) obstacles.push(mirrorObs(m, W, H, o)); });
    const starts = src.starts.map((s) => ({ x: s.x, z: s.z })).concat(src.starts.map((s) => { const p = mirrorPt(m, W, H, s.x, s.z); return { x: p[0], z: p[1] }; }));
    const teams = starts.map((_, i) => (i < n ? 0 : 1));
    const both = (list, mk) => { const out = []; list.forEach((d) => { out.push(mk(d, d.x, d.z)); const p = mirrorPt(m, W, H, d.x, d.z); if (!(p[0] === d.x && p[1] === d.z) && !d.mid) out.push(mk(d, p[0], p[1])); }); return out; };
    const deposits = both(src.deposits, (d, x, z) => ({ x, z, amount: d.a }));
    const objectives = both(src.objectives, (o, x, z) => ({ x, z, r: 5 }));
    const sites = both(src.sites || [], (s, x, z) => ({ k: s.k, x, z, r: N.SITES[s.k].capR }));
    const slow = src.slow.slice();
    src.slow.forEach((s) => { if (s.mid) return; if (s.s === 'c') { const p = mirrorPt(m, W, H, s.x, s.z); slow.push(Object.assign({}, s, { x: p[0], z: p[1] })); } });

    const terrain = new Uint8Array(W * H), coverSrc = new Uint8Array(W * H), slowG = new Float32Array(W * H).fill(1);
    const inShape = (o, cx, cz) => (o.s === 'c' ? (cx - o.x) * (cx - o.x) + (cz - o.z) * (cz - o.z) <= o.r * o.r : cx >= o.x0 && cx < o.x1 && cz >= o.z0 && cz < o.z1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const cx = i + 0.5, cz = j + 0.5;
      if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) { terrain[j * W + i] = 1; continue; }
      for (const o of obstacles) if (inShape(o, cx, cz)) { terrain[j * W + i] = 1; if (o.cover) coverSrc[j * W + i] = Math.max(coverSrc[j * W + i], o.cover); }
      for (const s of slow) if (inShape(s, cx, cz)) slowG[j * W + i] = Math.min(slowG[j * W + i], s.m);
    }
    // cover: free tiles adjacent to cover-providing blockers. coverDir points from the tile TOWARD the blocker.
    const coverDir = new Float32Array(W * H), coverVal = new Uint8Array(W * H);
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      if (terrain[j * W + i]) continue;
      let sx = 0, sz = 0, best = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const v = coverSrc[(j + dj) * W + i + di];
        if (v) { sx += di; sz += dj; best = Math.max(best, v); }
      }
      if (best && (sx || sz)) { coverDir[j * W + i] = Math.atan2(sz, sx); coverVal[j * W + i] = best; }
    }
    return { id, name: src.name, blurb: src.blurb, format: src.format, size: src.size, mirror: m, players: starts.length, teams, w: W, h: H, terrain, slow: slowG, coverDir, coverVal, starts, deposits, objectives, sites, obstacles, slowShapes: slow, theme: src.theme };
  };

  // Purely visual terrain relief (sim is planar). Flattened near bases, objectives and sites.
  N.groundHeight = function (map, x, z) {
    const amp = map.theme.amp;
    let h = Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) * 0.6 + Math.sin(x * 0.23 + z * 0.19) * 0.25 + Math.cos(x * 0.05 - z * 0.07) * 0.9;
    let flat = 1;
    for (const s of map.starts) { const d = Math.hypot(x - s.x, z - s.z); flat = Math.min(flat, Math.max(0, Math.min(1, (d - 9) / 8))); }
    for (const o of map.objectives) { const d = Math.hypot(x - o.x, z - o.z); flat = Math.min(flat, Math.max(0.25, Math.min(1, (d - 3) / 6))); }
    for (const s of map.sites) { const d = Math.hypot(x - s.x, z - s.z); flat = Math.min(flat, Math.max(0, Math.min(1, (d - 3) / 5))); }
    const edge = Math.min(x, z, map.w - x, map.h - z);
    return h * amp * flat + (edge < 2 ? (2 - edge) * 0.4 : 0);
  };
})();
