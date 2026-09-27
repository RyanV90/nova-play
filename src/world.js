/* Tin Soldiers: Nova - deterministic world: grid, entities, spatial hash, A* pathing, fog of war. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});

  N.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const CELL = 4;

  N.createWorld = function (opts) {
    const map = N.buildMap(opts.map);
    const slots = map.starts.length, half = slots / 2;
    // Seat -> start slot. opts.flip (QA/probe/side-swap) gives each seat the mirrored slot of the other team.
    const slotOf = (i) => (opts.flip ? (i + half) % slots : i);
    // Player specs: opts.players = [{faction, team?, diff?}] (one per slot) or the legacy pair opts.factions/opts.difficulty.
    const specs = opts.players || opts.factions.map((f, i) => ({ faction: f, diff: opts.difficulty && opts.difficulty[i] }));
    if (specs.length !== slots) throw new Error('map ' + opts.map + ' needs ' + slots + ' players, got ' + specs.length);
    const W = {
      map, w: map.w, h: map.h, seed: opts.seed | 0, rng: N.mulberry32(opts.seed | 0), tick: 0, time: 0,
      mode: opts.mode === 'objective' ? 'objective' : 'elim', ents: [], byId: new Map(), nextId: 1,
      occ: new Int32Array(map.w * map.h), navVer: 1, players: [], teams: [], events: [], wantEvents: !!opts.wantEvents,
      impacts: [], zones: [], transits: [], over: null, objs: [], sites: [], siteLog: [], reveal: !!opts.reveal, cw: Math.ceil(map.w / CELL), ch: Math.ceil(map.h / CELL),
      _stamp: 0, spawnLog: [], elimLog: [],
    };
    W.cells = []; for (let i = 0; i < W.cw * W.ch; i++) W.cells.push([]);
    W._g = new Float32Array(map.w * map.h); W._par = new Int32Array(map.w * map.h); W._st = new Int32Array(map.w * map.h); W._cl = new Int32Array(map.w * map.h);
    map.objectives.forEach((o) => W.objs.push({ x: o.x, z: o.z, r: o.r, owner: -1, prog: 0 }));
    map.sites.forEach((s, i) => W.sites.push({ id: 's' + i, k: s.k, x: s.x, z: s.z, r: s.r, owner: -1, prog: 0, contested: false, cdUntil: 0, def: N.SITES[s.k], count: [0, 0] }));
    // teams own the shared information (vision / exploration / remembered structures); commanders own everything else
    for (let t = 0; t < 2; t++) W.teams.push({ id: t, members: [], vis: new Uint8Array(map.w * map.h), expl: new Uint8Array(map.w * map.h), mem: new Map(), score: 0, held: 0, alive: true });
    for (let p = 0; p < slots; p++) {
      const spec = specs[p], diff = spec.diff || null, slot = slotOf(p), team = spec.team != null ? spec.team : (p < half ? 0 : 1);
      const tm = W.teams[team];
      tm.members.push(p);
      W.players.push({
        id: p, slot, team, mirrorSide: slot >= half, faction: spec.faction, human: !diff, diff, res: opts.startRes != null ? opts.startRes : N.START_RES,
        supplyUsed: 0, supplyCap: 0, upg: {}, abilCd: 0, powCd: 0, vis: tm.vis, expl: tm.expl, mem: tm.mem, alive: true, surrendered: false, held: 0, gatherMult: diff ? N.DIFFICULTY[diff].gather : 1,
        stats: { spent: 0, income: 0, refunded: 0, unitsMade: 0, built: 0, killed: 0, lost: 0, killedValue: 0, lostValue: 0, gathered: 0, powers: 0 }, ai: null, start: map.starts[slot],
      });
    }
    W.map.starts = W.players.map((p) => p.start); // starts[i] is now the seat's own slot (seat i == player i)
    // deposits
    map.deposits.forEach((d) => {
      const e = { id: W.nextId++, kind: 'deposit', role: 'deposit', owner: -1, team: -1, x: d.x, z: d.z, tx: Math.round(d.x - 1), tz: Math.round(d.z - 1), size: 2, amount: d.amount, amount0: d.amount, miners: 0, alive: true, hp: 1, hpMax: 1, radius: 1, def: null };
      W.ents.push(e); W.byId.set(e.id, e); setOcc(W, e, e.id);
    });
    // start bases
    W.players.forEach((p) => {
      const s = p.start, sz = 4;
      const hq = N.spawnBuilding(W, p.id, 'hq', Math.round(s.x - sz / 2), Math.round(s.z - sz / 2), true);
      // the worker ring is laid out in the seat's OWN frame: mirrored slots get the mirrored ring (it used to be one absolute frame, so the far team started with a rotated worker layout)
      const msrc = N.MAPS[W.map.id], wmx = p.mirrorSide && msrc && msrc.mirror !== 'z' ? -1 : 1, wmz = p.mirrorSide && msrc && msrc.mirror !== 'x' ? -1 : 1;
      for (let i = 0; i < N.START_WORKERS; i++) {
        const a = (i / N.START_WORKERS) * Math.PI * 2;
        const pos = N.freeNear(W, hq.x + Math.cos(a) * 4 * wmx, hq.z + Math.sin(a) * 4 * wmz);
        N.spawnUnit(W, p.id, 'worker', pos.x, pos.z);
      }
    });
    N.updateVision(W);
    return W;
  };

  function setOcc(W, e, val) {
    for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) W.occ[(e.tz + j) * W.w + e.tx + i] = val;
    W.navVer++;
  }
  N.setOcc = setOcc;

  N.tileIdx = (W, x, z) => (Math.floor(z) * W.w + Math.floor(x));
  N.blockedAt = function (W, tx, tz) {
    if (tx < 0 || tz < 0 || tx >= W.w || tz >= W.h) return true;
    const i = tz * W.w + tx;
    return W.map.terrain[i] === 1 || W.occ[i] !== 0;
  };
  N.blockedPt = (W, x, z) => N.blockedAt(W, Math.floor(x), Math.floor(z));

  N.freeNear = function (W, x, z, maxR) {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (!N.blockedAt(W, tx, tz)) return { x, z };
    const t = N.nearestFreeTile(W, tx, tz, maxR || 12);
    return t ? { x: t.x + 0.5, z: t.z + 0.5 } : { x, z };
  };
  N.nearestFreeTile = function (W, tx, tz, maxR) {
    let best = null, bd = 1e9;
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (N.blockedAt(W, tx + dx, tz + dz)) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = { x: tx + dx, z: tz + dz }; }
      }
      if (best) return best;
    }
    return null;
  };

  /* ------------------------------------------------------------ entities */
  N.spawnUnit = function (W, owner, role, x, z) {
    const p = W.players[owner], d = N.unitDef(p.faction, role);
    const shieldMax = d.shield;
    const e = {
      id: W.nextId++, kind: 'unit', role, owner, team: p.team, fid: p.faction, def: d, x, z, hp: d.hp, hpMax: d.hp, alive: true, air: d.air, atype: d.atype, radius: d.radius,
      armor: d.armor, inf: d.inf, face: Math.atan2(W.h / 2 - z, W.w / 2 - x), shield: shieldMax, stasisT: 0, frenzyT: 0, spentT: 0, lastHit: -99, lastAttacker: 0, cd: d.weapons.map(() => 0),
      order: { t: 'idle' }, path: null, pi: 0, goal: null, navVer: 0, target: 0, carry: 0, hs: 'toDep', mineT: 0, stuckT: 0, moving: false, home: { x, z }, want: null, overT: 0, overAmt: 0, born: W.time, kills: 0,
    };
    W.ents.push(e); W.byId.set(e.id, e);
    return e;
  };
  N.spawnBuilding = function (W, owner, role, tx, tz, built) {
    const p = W.players[owner], d = N.buildingDef(p.faction, role);
    const e = {
      id: W.nextId++, kind: 'building', role, owner, team: p.team, fid: p.faction, def: d, tx, tz, size: d.size, x: tx + d.size / 2, z: tz + d.size / 2, hp: built ? d.hp : d.hp * 0.1, hpMax: d.hp,
      alive: true, built: !!built, progress: built ? 1 : 0, queue: [], rally: null, atype: 'structure', armor: d.armor, radius: d.size / 2, air: false, cd: d.weapons.map(() => 0),
      target: 0, builders: 0, lastHit: -99, lastAttacker: 0, face: 0, born: W.time,
    };
    W.ents.push(e); W.byId.set(e.id, e); setOcc(W, e, e.id);
    return e;
  };

  /* ------------------------------------------------------------ spatial hash */
  N.rebuildHash = function (W) {
    for (let i = 0; i < W.cells.length; i++) W.cells[i].length = 0;
    for (const e of W.ents) {
      if (!e.alive) continue;
      const cx = Math.min(W.cw - 1, Math.max(0, Math.floor(e.x / CELL))), cz = Math.min(W.ch - 1, Math.max(0, Math.floor(e.z / CELL)));
      W.cells[cz * W.cw + cx].push(e);
    }
  };
  N.query = function (W, x, z, r, fn) {
    const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(W.cw - 1, Math.floor((x + r) / CELL));
    const r0 = Math.max(0, Math.floor((z - r) / CELL)), r1 = Math.min(W.ch - 1, Math.floor((z + r) / CELL));
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      const cell = W.cells[j * W.cw + i];
      for (let k = 0; k < cell.length; k++) { const e = cell[k]; if (e.alive) fn(e); }
    }
  };

  // distance from a point to the edge of an entity
  N.edgeDist = function (x, z, t) {
    if (t.kind === 'building' || t.kind === 'deposit') {
      const dx = Math.max(t.tx - x, 0, x - (t.tx + t.size)), dz = Math.max(t.tz - z, 0, z - (t.tz + t.size));
      return Math.hypot(dx, dz);
    }
    return Math.max(0, Math.hypot(t.x - x, t.z - z) - t.radius);
  };

  /* ------------------------------------------------------------ A* */
  function lineClear(W, x0, z0, x1, z1, hw) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    const n = Math.ceil(len / 0.35), px = -dz / len * hw, pz = dx / len * hw;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + dx * t, z = z0 + dz * t;
      if (N.blockedPt(W, x, z) || N.blockedPt(W, x + px, z + pz) || N.blockedPt(W, x - px, z - pz)) return false;
    }
    return true;
  }
  N.lineClear = lineClear;

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];

  // Free tiles to stand on when the destination point itself is blocked (a building / deposit centre), best first.
  // Every key is a mirror invariant: distance from the true (unfloored) goal point, then from the source, then from the map
  // centre, so a mirrored unit sent to a mirrored goal gets the mirrored approach tile whatever the footprint parity.
  // reach = also drop tiles the source cannot walk to (flood with A*'s moves); findPath only pays for that after the best
  // ranked tile has failed, so the common case costs one ordinary search.
  N.approachTiles = function (W, sx, sz, gx, gz, maxR, reach) {
    const w = W.w, h = W.h, ftx = Math.floor(gx), ftz = Math.floor(gz), EPS = 1e-6;
    // A goal blocked by a structure may only be approached from beside its footprint (within working reach, 2 tiles), never
    // from a tile that merely happens to be free somewhere nearby; terrain-blocked goals keep the nearest-tile rule.
    let x0 = ftx - maxR, x1 = ftx + maxR, z0 = ftz - maxR, z1 = ftz + maxR;
    const occ = ftx >= 0 && ftz >= 0 && ftx < w && ftz < h ? W.occ[ftz * w + ftx] : 0;
    if (occ) {
      let fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9;
      for (let tz = Math.max(0, ftz - 8); tz <= Math.min(h - 1, ftz + 8); tz++) for (let tx = Math.max(0, ftx - 8); tx <= Math.min(w - 1, ftx + 8); tx++) {
        if (W.occ[tz * w + tx] !== occ) continue;
        if (tx < fx0) fx0 = tx; if (tx > fx1) fx1 = tx; if (tz < fz0) fz0 = tz; if (tz > fz1) fz1 = tz;
      }
      x0 = Math.max(x0, fx0 - 2); x1 = Math.min(x1, fx1 + 2); z0 = Math.max(z0, fz0 - 2); z1 = Math.min(z1, fz1 + 2);
    }
    let fs = null, fstamp = 0;
    if (reach) {
      fs = W._fs || (W._fs = new Int32Array(w * h));
      const q = W._fq || (W._fq = new Int32Array(w * h));
      fstamp = W._fstamp = (W._fstamp || 0) + 1;
      let stx = Math.floor(sx), stz = Math.floor(sz);
      if (N.blockedAt(W, stx, stz)) { const t = N.nearestFreeTile(W, stx, stz, 8); if (!t) return []; stx = t.x; stz = t.z; }
      let qh = 0, qt = 0; q[qt++] = stz * w + stx; fs[stz * w + stx] = fstamp;
      while (qh < qt) {
        const cur = q[qh++], cx = cur % w, cz = (cur / w) | 0;
        for (let d = 0; d < 8; d++) {
          const dd = DIRS[d], nx = cx + dd[0], nz = cz + dd[1];
          if (N.blockedAt(W, nx, nz)) continue;
          if (dd[0] && dd[1] && (N.blockedAt(W, cx + dd[0], cz) || N.blockedAt(W, cx, cz + dd[1]))) continue;
          const ni = nz * w + nx;
          if (fs[ni] === fstamp) continue;
          fs[ni] = fstamp; q[qt++] = ni;
        }
      }
    }
    const list = [], mcx = w / 2, mcz = h / 2;
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (N.blockedAt(W, tx, tz) || (fs && fs[tz * w + tx] !== fstamp)) continue;
      const cx = tx + 0.5, cz = tz + 0.5;
      list.push({ x: tx, z: tz, dg: Math.hypot(cx - gx, cz - gz), ds: Math.hypot(cx - sx, cz - sz), dm: Math.hypot(cx - mcx, cz - mcz), cr: (gx - sx) * (cz - gz) - (gz - sz) * (cx - gx) });
    }
    list.sort((a, b) => {
      if (Math.abs(a.dg - b.dg) > EPS) return a.dg - b.dg;
      if (Math.abs(a.ds - b.ds) > EPS) return a.ds - b.ds;
      if (Math.abs(a.dm - b.dm) > EPS) return a.dm - b.dm;
      if (Math.abs(a.cr - b.cr) > EPS) return b.cr - a.cr;
      return a.z - b.z || a.x - b.x;
    });
    return list;
  };

  N.findPath = function (W, sx, sz, gx, gz, hover, hw) {
    if (!N.blockedAt(W, Math.floor(gx), Math.floor(gz))) return searchPath(W, sx, sz, gx, gz, hover, hw);
    // blocked destination: walk to the best free tile beside it. If that one cannot be reached (search fails), rank only the
    // tiles the source can actually walk to and try the best of those; an unreachable footprint yields no path, never an enclosed tile.
    let cands = N.approachTiles(W, sx, sz, gx, gz, 14, false);
    if (!cands.length) return null;
    const first = searchPath(W, sx, sz, cands[0].x + 0.5, cands[0].z + 0.5, hover, hw);
    if (first) return first;
    cands = N.approachTiles(W, sx, sz, gx, gz, 14, true);
    for (let i = 0; i < cands.length && i < 3; i++) {
      const p = searchPath(W, sx, sz, cands[i].x + 0.5, cands[i].z + 0.5, hover, hw);
      if (p) return p;
    }
    return null;
  };
  function searchPath(W, sx, sz, gx, gz, hover, hw) {
    const w = W.w, g = W._g, par = W._par, st = W._st, cl = W._cl, slow = W.map.slow, stamp = ++W._stamp;
    let stx = Math.floor(sx), stz = Math.floor(sz), gtx = Math.floor(gx), gtz = Math.floor(gz);
    if (N.blockedAt(W, gtx, gtz)) { const t = N.nearestFreeTile(W, gtx, gtz, 14); if (!t) return null; gtx = t.x; gtz = t.z; gx = gtx + 0.5; gz = gtz + 0.5; }
    if (N.blockedAt(W, stx, stz)) { const t = N.nearestFreeTile(W, stx, stz, 8); if (!t) return null; stx = t.x; stz = t.z; }
    const si = stz * w + stx, gi = gtz * w + gtx;
    if (si === gi) return [{ x: gx, z: gz }];
    hw = hw == null ? 0.3 : hw;
    if (lineClear(W, sx, sz, gx, gz, hw)) return [{ x: gx, z: gz }];
    const hf = [], hi = [];
    const push = (f, i) => {
      let k = hf.length; hf.push(f); hi.push(i);
      while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hf[k] = hf[p]; hi[k] = hi[p]; k = p; }
      hf[k] = f; hi[k] = i;
    };
    const pop = () => {
      const ri = hi[0], lf = hf.pop(), li = hi.pop(), n = hf.length;
      if (n > 0) {
        let k = 0;
        for (;;) {
          let c = 2 * k + 1; if (c >= n) break;
          if (c + 1 < n && hf[c + 1] < hf[c]) c++;
          if (hf[c] >= lf) break;
          hf[k] = hf[c]; hi[k] = hi[c]; k = c;
        }
        hf[k] = lf; hi[k] = li;
      }
      return ri;
    };
    g[si] = 0; st[si] = stamp; par[si] = -1; push(0, si);
    let found = false, iter = 0;
    while (hf.length && iter++ < 30000) {
      const cur = pop();
      if (cl[cur] === stamp) continue;
      cl[cur] = stamp;
      if (cur === gi) { found = true; break; }
      const cx = cur % w, cz = (cur / w) | 0;
      for (let d = 0; d < 8; d++) {
        const dd = DIRS[d], nx = cx + dd[0], nz = cz + dd[1];
        if (N.blockedAt(W, nx, nz)) continue;
        if (dd[0] && dd[1] && (N.blockedAt(W, cx + dd[0], cz) || N.blockedAt(W, cx, cz + dd[1]))) continue;
        const ni = nz * w + nx;
        if (cl[ni] === stamp) continue;
        const sm = hover ? 1 : slow[ni];
        const ng = g[cur] + dd[2] / sm;
        if (st[ni] !== stamp || ng < g[ni]) {
          st[ni] = stamp; g[ni] = ng; par[ni] = cur;
          const ax = Math.abs(nx - gtx), az = Math.abs(nz - gtz);
          push(ng + ax + az - 0.5858 * Math.min(ax, az), ni);
        }
      }
    }
    if (!found) return null;
    const tiles = [];
    for (let c = gi; c !== -1; c = par[c]) tiles.push({ x: (c % w) + 0.5, z: ((c / w) | 0) + 0.5 });
    tiles.reverse();
    tiles[0] = { x: sx, z: sz };
    tiles[tiles.length - 1] = { x: gx, z: gz };
    // string-pull smoothing
    const out = [];
    let a = 0;
    while (a < tiles.length - 1) {
      let b = tiles.length - 1;
      while (b > a + 1 && !lineClear(W, tiles[a].x, tiles[a].z, tiles[b].x, tiles[b].z, hw)) b--;
      out.push(tiles[b]); a = b;
    }
    return out;
  }

  /* ------------------------------------------------------------ fog of war */
  const circ = {};
  function circleOffsets(r) {
    if (circ[r]) return circ[r];
    const out = [];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) out.push(i, j);
    return (circ[r] = out);
  }
  N.updateVision = function (W) {
    const w = W.w, h = W.h;
    for (const tm of W.teams) tm.vis.fill(0);
    const stamp = (tm, cx, cz, sight) => {
      const off = circleOffsets(sight), vis = tm.vis, expl = tm.expl;
      for (let k = 0; k < off.length; k += 2) {
        const x = cx + off[k], z = cz + off[k + 1];
        if (x < 0 || z < 0 || x >= w || z >= h) continue;
        vis[z * w + x] = 1; expl[z * w + x] = 1;
      }
    };
    for (const e of W.ents) {
      if (!e.alive || e.owner < 0) continue;
      stamp(W.teams[e.team], Math.floor(e.x), Math.floor(e.z), Math.round(e.def.sight + (e.air ? 1 : 0)));
    }
    // Recon Arrays: bounded, real shared team vision while held (recomputed from current ownership every pass)
    for (const s of W.sites) if (s.owner >= 0 && s.k === 'radar') stamp(W.teams[s.owner], Math.floor(s.x), Math.floor(s.z), s.def.vision);
    for (const tm of W.teams) {
      if (W.reveal) { tm.vis.fill(1); tm.expl.fill(1); }
      for (const e of W.ents) {
        if (!e.alive || e.kind !== 'building' || e.team === tm.id) continue;
        if (tm.vis[Math.floor(e.z) * w + Math.floor(e.x)]) tm.mem.set(e.id, { id: e.id, owner: e.owner, team: e.team, role: e.role, fid: e.fid, tx: e.tx, tz: e.tz, size: e.size, x: e.x, z: e.z, built: e.built });
      }
      for (const [id, m] of tm.mem) {
        const e = W.byId.get(id);
        if ((!e || !e.alive) && tm.vis[Math.floor(m.z) * w + Math.floor(m.x)]) tm.mem.delete(id);
      }
    }
  };
  N.visibleTo = function (W, pid, e) {
    if (e.owner === pid) return true;
    return W.players[pid].vis[Math.floor(e.z) * W.w + Math.floor(e.x)] === 1;
  };
  // Team relationships are separate from ownership: owner = commander, team = alliance.
  N.teamOf = (W, owner) => (owner >= 0 && W.players[owner] ? W.players[owner].team : -1);
  N.isEnemy = (W, a, b) => a >= 0 && b >= 0 && W.players[a].team !== W.players[b].team;
  N.isAlly = (W, a, b) => a >= 0 && b >= 0 && a !== b && W.players[a].team === W.players[b].team;
  N.emit = function (W, ev) { if (W.wantEvents) W.events.push(ev); };
})();

