/* Tin Soldiers: Nova - computer opponent. Uses the same commands, costs, supply, fog and rules as the human player. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const AI = (N.AI = {});
  const Cmd = N.Cmd;

  AI.attach = function (W, pid, diff) {
    const p = W.players[pid];
    p.ai = { cfg: N.DIFFICULTY[diff], diff, mode: 'stage', waveStart: 0, scoutId: 0, scoutIdx: 0, intel: { air: 0, heavy: 0, light: 0, medium: 0, structure: 0 }, threatT: -99, saving: 0, capIds: [], sweepIdx: 0, lastOrder: -99, atk: null, log: [] };
    p.human = false; p.diff = diff; p.gatherMult = N.DIFFICULTY[diff].gather;
  };

  // Think phase belongs to the seat's position within its team, so mirror counterparts (seat i and i + half) think on the same tick. It used to be the raw seat id, which made the second team
  // act 0.4-0.5 s after the first every cycle (physical slots 0-2 won about 75% of games regardless of faction).
  AI.due = function (W, p) {
    const half = Math.max(1, W.players.length >> 1);
    return (W.tick + (p.id % half) * 3) % p.ai.cfg.think === 0;
  };
  AI.step = function (W, p) {
    if (!AI.due(W, p)) return;
    think(W, p, p.ai);
  };

  const RESEARCH_ORDER = ['dmg1', 'armor1', 'special', 'dmg2', 'armor2'];

  function collect(W, p) {
    const L = { workers: [], army: [], support: [], blds: [], sites: [], cnt: {}, bcnt: {}, bsite: {}, armySupply: 0, hq: null };
    for (const e of W.ents) {
      if (!e.alive || e.owner !== p.id) continue;
      if (e.kind === 'unit') {
        L.cnt[e.role] = (L.cnt[e.role] || 0) + 1;
        if (e.role === 'worker') L.workers.push(e);
        else if (e.def.weapons.length) { L.army.push(e); L.armySupply += e.def.supply; }
        else { L.support.push(e); L.armySupply += e.def.supply; }
      } else if (e.kind === 'building') {
        if (e.built) { L.blds.push(e); L.bcnt[e.role] = (L.bcnt[e.role] || 0) + 1; if (e.role === 'hq' && !L.hq) L.hq = e; }
        else { L.sites.push(e); L.bsite[e.role] = (L.bsite[e.role] || 0) + 1; }
      }
    }
    return L;
  }

  function observeEnemy(W, p, ai) {
    const c = { air: 0, heavy: 0, light: 0, medium: 0, structure: 0 };
    for (const e of W.ents) {
      if (!e.alive || e.team === p.team || e.owner < 0 || e.kind !== 'unit') continue;
      if (!N.visibleTo(W, p.id, e)) continue;
      c[e.air ? 'air' : e.atype] = (c[e.air ? 'air' : e.atype] || 0) + 1;
    }
    for (const k in c) ai.intel[k] = Math.max(ai.intel[k] * 0.97, c[k]);
    return c;
  }

  function total(L, role) { return (L.bcnt[role] || 0) + (L.bsite[role] || 0); }

  function findSpot(W, p, role, ax, az) {
    const d = N.buildingDef(p.faction, role), s = d.size;
    let best = null, bs = 1e9;
    // Scan in the canonical (slot A) frame; the second start slot is scanned through the map's real mirror axis, so placement is exact-mirror whichever seat holds it
    const src = N.MAPS[W.map.id], slotB = !!p.mirrorSide, mx = slotB && src.mirror !== 'z', mz = slotB && src.mirror !== 'x';
    const ax2 = mx ? W.w - ax : ax, az2 = mz ? W.h - az : az;
    for (let r = 0; r <= 26 && !best; r += 1) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ux = Math.round(ax2 + dx - s / 2), uz = Math.round(az2 + dz - s / 2);
        const tx = mx ? W.w - ux - s : ux, tz = mz ? W.h - uz - s : uz;
        if (N.checkPlace(W, p.id, role, tx, tz)) continue;
        const cx = tx + s / 2, cz = tz + s / 2;
        let pen = 0;
        if (role !== 'dropoff' && role !== 'hq') for (const e of W.ents) if (e.kind === 'deposit' && e.alive && Math.hypot(e.x - cx, e.z - cz) < 5) { pen = 1e3; break; }
        // keep the immediate HQ apron clear so units can leave
        const hq = W.ents.find((e) => e.alive && e.owner === p.id && e.kind === 'building' && e.role === 'hq');
        if (hq && role !== 'hq' && Math.hypot(hq.x - cx, hq.z - cz) < hq.size / 2 + s / 2 + 2.5) pen += 40;
        const sc = Math.hypot(dx, dz) + pen;
        if (sc < bs) { bs = sc; best = { tx, tz }; }
      }
    }
    return best;
  }

  function pickBuilder(W, p, L, x, z) {
    let best = null, bd = 1e9;
    for (const w of L.workers) {
      const o = w.order;
      if (o.t === 'build' || o.t === 'repair') continue;
      if (w.carry > 0) continue;
      const d = Math.hypot(w.x - x, w.z - z) + (o.t === 'idle' ? -5 : 0);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  function tryBuild(W, p, ai, L, role, ax, az) {
    const d = N.buildingDef(p.faction, role);
    if (p.res < d.cost) { ai.saving = Math.max(ai.saving, d.cost); return false; }
    const spot = findSpot(W, p, role, ax, az);
    if (!spot) return false;
    // rank against the footprint centre: the min-coordinate corner is a different point of the shape on the mirrored team
    const w = pickBuilder(W, p, L, spot.tx + d.size / 2, spot.tz + d.size / 2);
    if (!w) return false;
    const r = Cmd.build(W, p.id, [w.id], role, spot.tx, spot.tz);
    if (r.ok) ai.log.push({ t: W.time, b: role });
    return r.ok;
  }


  function economy(W, p, ai, L, cfg) {
    const F = N.FACTIONS[p.faction], hq = L.hq;
    // idle workers mine
    for (const w of L.workers) {
      if (w.order.t !== 'idle') continue;
      const dep = N.nearestDeposit(W, w.x, w.z, 45);
      if (dep) Cmd.harvest(W, p.id, [w.id], dep.id);
    }
    // more workers
    const wantW = cfg.workers;
    let queuedW = 0;
    for (const b of L.blds) for (const q of b.queue) if (q.key === 'worker') queuedW++;
    for (const b of L.blds) {
      if (!b.def.prod.includes('worker')) continue;
      if ((L.workers.length + queuedW < wantW) && b.queue.length < 2 && p.res >= F.units.worker.cost) { if (Cmd.queue(W, p.id, b.id, 'worker').ok) queuedW++; }
    }
    if (!hq && !L.blds.length) return;
    const home = hq || L.blds[0];
    const cen = { x: W.w / 2, z: W.h / 2 };
    const dirx = cen.x - home.x, dirz = cen.z - home.z, dl = Math.hypot(dirx, dirz) || 1;
    const front = { x: home.x + (dirx / dl) * 9, z: home.z + (dirz / dl) * 9 };
    const pend = L.sites.length;
    const time = W.time;

    ai.saving = 0;
    let built = false;
    // unfinished sites without builders are resumed
    for (const s of L.sites) {
      if (s.builders === 0 && W.time - (s.born || 0) > 8) { const w = pickBuilder(W, p, L, s.x, s.z); if (w) Cmd.resume(W, p.id, [w.id], s.id); }
    }
    const supplyRoom = p.supplyCap - p.supplyUsed;
    let supplyPending = L.bsite.supply || 0;
    // priority list
    if (!hq && p.res >= N.buildingDef(p.faction, 'hq').cost && !L.bsite.hq) { built = tryBuild(W, p, ai, L, 'hq', home.x, home.z); }
    if (!built && p.supplyCap < N.MAX_SUPPLY && supplyRoom < 5 + L.blds.filter((b) => b.def.prod.length).length * 2 && !supplyPending && (L.bcnt.supply || 0) < 10) built = tryBuild(W, p, ai, L, 'supply', home.x - dirx / dl * 6, home.z - dirz / dl * 6);
    if (!built && !total(L, 'barracks')) built = tryBuild(W, p, ai, L, 'barracks', front.x, front.z);
    if (!built && L.bcnt.barracks && !total(L, 'lab') && (time > 120 || L.workers.length >= 9)) built = tryBuild(W, p, ai, L, 'lab', home.x - dirx / dl * 4, home.z - dirz / dl * 4);
    if (!built && L.bcnt.barracks && !total(L, 'factory') && L.workers.length >= 7) built = tryBuild(W, p, ai, L, 'factory', front.x, front.z);
    // expansion drop-off
    if (!built && !L.bsite.dropoff && L.workers.length >= 9 && total(L, 'dropoff') < 4) {
      let best = null, bd = 1e9, remaining = 0;
      const drops = L.blds.filter((b) => b.def.dropoff);
      for (const e of W.ents) {
        if (!e.alive || e.kind !== 'deposit' || e.amount <= 0) continue;
        const covered = drops.some((d) => Math.hypot(d.x - e.x, d.z - e.z) < 14);
        if (covered) { remaining += e.amount; continue; }
        const dh = Math.hypot(e.x - home.x, e.z - home.z);
        if (dh < 46 && dh < bd) { bd = dh; best = e; }
      }
      if (best && (remaining < 3500 || time > 300)) built = tryBuild(W, p, ai, L, 'dropoff', best.x, best.z);
    }
    if (!built && L.bcnt.barracks && (ai.intel.air > 0 || time > 480) && total(L, 'aaturret') < (ai.intel.air > 2 ? 3 : 1)) built = tryBuild(W, p, ai, L, 'aaturret', front.x, front.z);
    if (!built && L.bcnt.factory && !total(L, 'airfield') && time > 240 && L.workers.length >= 9) built = tryBuild(W, p, ai, L, 'airfield', home.x - dirx / dl * 5, home.z - dirz / dl * 5);
    if (!built && time > 240 && total(L, 'barracks') < 2 && p.res > 250) built = tryBuild(W, p, ai, L, 'barracks', front.x, front.z);
    if (!built && time > 420 && L.bcnt.factory && total(L, 'factory') < 2 && p.res > 350) built = tryBuild(W, p, ai, L, 'factory', front.x, front.z);
    if (!built && time > 300 && L.bcnt.barracks && total(L, 'turret') < (cfg.think < 20 ? 3 : 2) && p.res > 300) built = tryBuild(W, p, ai, L, 'turret', front.x, front.z);
    void pend;
  }

  function research(W, p, ai, L) {
    const lab = L.blds.find((b) => b.def.research && b.queue.length === 0);
    if (!lab || L.armySupply < 6) return;
    const F = N.FACTIONS[p.faction];
    for (const k of RESEARCH_ORDER) {
      if (p.upg[k]) continue;
      const up = F.upgrades[k];
      if (up.req.some((r) => !p.upg[r])) continue;
      if (p.res < up.cost + 60) return;
      if (Cmd.queue(W, p.id, lab.id, 'up:' + k).ok) return;
    }
  }

  function production(W, p, ai, L, cfg) {
    const F = N.FACTIONS[p.faction];
    const w = { trooper: 3, raider: L.cnt.raider ? 0 : 0.4, lancer: 1, skyhunter: 0.6, walker: 1.7, artillery: 0.6, flyer: 0.9, support: 0.4, heavy: 0.8 };
    const it = ai.intel;
    if (it.air > 0) w.skyhunter += Math.min(5, it.air * 0.8);
    if (it.heavy >= 2) { w.lancer += it.heavy * 0.5; w.flyer += 0.4; w.trooper *= 0.6; }
    if (it.light > it.heavy + it.air) { w.walker += 0.7; w.artillery += 0.3; w.lancer *= 0.5; }
    if (W.time > 240 && !(L.cnt.skyhunter > 0)) w.skyhunter += 2.5;
    if (W.time > 300 && !(L.cnt.lancer > 0)) w.lancer += 2;
    if ((L.cnt.support || 0) >= 3) w.support = 0;
    if ((L.cnt.artillery || 0) >= 3) w.artillery = 0;
    const reserve = ai.saving && L.armySupply >= 6 ? ai.saving : 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      // build the candidate list of roles that have a free producer and met requirements
      const cands = [];
      for (const role of N.ROLES) {
        if (role === 'worker' || !w[role]) continue;
        const d = F.units[role];
        if (d.req.some((r) => !L.bcnt[r])) continue;
        const prod = L.blds.filter((b) => b.def.prod.includes(role) && b.queue.length < 2).sort((a, b) => a.queue.length - b.queue.length || a.id - b.id)[0];
        if (!prod) continue;
        if (p.res - d.cost < reserve) continue;
        cands.push({ role, prod, wt: w[role] });
      }
      if (!cands.length) return;
      let tot = 0; cands.forEach((c) => (tot += c.wt));
      let r = W.rng() * tot, pickC = cands[0];
      for (const c of cands) { r -= c.wt; if (r <= 0) { pickC = c; break; } }
      const res = Cmd.queue(W, p.id, pickC.prod.id, pickC.role);
      if (!res.ok) { if (res.reason === 'afford') return; w[pickC.role] = 0; }
    }
    void cfg;
  }

  function centroid(list) {
    let x = 0, z = 0; list.forEach((u) => { x += u.x; z += u.z; });
    return { x: x / list.length, z: z / list.length };
  }

  /* ---- team coordination (shared, deterministic, uses only information the team legitimately has) ---- */
  // Every strategic site / capture point is assigned to the allied AI whose base is closest, so allies split the map instead of walking one lane.
  function claims(W, p) {
    const tm = W.teams[p.team], key = 'c' + (W.tick - (W.tick % 100));
    if (tm._claimKey === key && tm._claims) return tm._claims;
    const pts = W.sites.map((s) => ({ key: s.id, x: s.x, z: s.z, site: s })).concat(W.objs.map((o, i) => ({ key: 'o' + i, x: o.x, z: o.z, obj: o })));
    const ais = tm.members.map((id) => W.players[id]).filter((q) => q.alive && q.ai);
    const out = {}, load = {};
    ais.forEach((q) => { load[q.id] = 0; });
    // The greedy split depends on the order the points are visited in. That order must be the same for both teams in their OWN frame (mirror-invariant), otherwise the team whose side comes first in the map
    // data gets a better split (nearer sites, less walking) than its counterpart: visit points nearest to the team's own start centroid first, ties broken in the team's own (un-mirrored) coordinates.
    const src = N.MAPS[W.map.id], flipT = !!p.mirrorSide, fx = flipT && src.mirror !== 'z', fz = flipT && src.mirror !== 'x';
    const cx = ais.reduce((s, q) => s + q.start.x, 0) / Math.max(1, ais.length), cz = ais.reduce((s, q) => s + q.start.z, 0) / Math.max(1, ais.length);
    pts.forEach((pt) => { pt.ord = [Math.round(Math.hypot(pt.x - cx, pt.z - cz) * 1e4), Math.round((fx ? W.w - pt.x : pt.x) * 1e4), Math.round((fz ? W.h - pt.z : pt.z) * 1e4)]; });
    pts.sort((a, b) => a.ord[0] - b.ord[0] || a.ord[1] - b.ord[1] || a.ord[2] - b.ord[2] || (a.key < b.key ? -1 : 1));
    pts.forEach((pt) => {
      let best = null, bd = 1e9;
      for (const q of ais) { const d = Math.hypot(q.start.x - pt.x, q.start.z - pt.z) + load[q.id] * 14; if (d < bd) { bd = d; best = q; } }
      if (best && bd < 120) { out[pt.key] = best.id; load[best.id]++; }
    });
    tm._claimKey = key; tm._claims = { by: out, pts };
    return tm._claims;
  }
  const holdsPt = (pt, team) => (pt.site ? pt.site.owner === team : pt.obj.owner === team);
  function enemyHomeOf(W, p) {
    const n = W.players.length, cp = W.players[(p.id + n / 2) % n];
    if (cp.alive && cp.team !== p.team) return cp.start;
    let best = null, bd = 1e9;
    for (const q of W.players) if (q.alive && q.team !== p.team) { const d = Math.hypot(q.start.x - p.start.x, q.start.z - p.start.z); if (d < bd) { bd = d; best = q.start; } }
    return best || cp.start;
  }

  function military(W, p, ai, L, cfg) {
    const time = W.time, home = L.hq || L.blds[0];
    if (!home) return;
    const idleOK = (u) => u.order.t === 'idle' || u.order.t === 'move';
    const enemyHome = enemyHomeOf(W, p);
    // scouting
    let scout = W.byId.get(ai.scoutId);
    if (!scout || !scout.alive) {
      ai.scoutId = 0;
      const r = L.army.find((u) => u.role === 'raider');
      if (r) ai.scoutId = r.id;
      else if (time > 45 && time < 150 && !ai.workerScouted && L.workers.length > 6) { const w = L.workers.find((x) => x.carry === 0); if (w) { ai.scoutId = w.id; ai.workerScouted = true; } }
      scout = W.byId.get(ai.scoutId);
    }
    if (scout && scout.alive && (scout.order.t === 'idle' || (scout.order.t === 'move' && !scout.path))) {
      const pts = [enemyHome].concat(W.map.objectives.map((o) => ({ x: o.x, z: o.z })), W.sites.map((s) => ({ x: s.x, z: s.z })), W.map.deposits.map((d) => ({ x: d.x, z: d.z })));
      const pt = pts[ai.scoutIdx++ % pts.length];
      Cmd.move(W, p.id, [scout.id], pt.x, pt.z, false);
    }
    const holders = new Set(ai.capIds || []);
    const fighters = L.army.concat(L.support).filter((u) => u.id !== ai.scoutId && u.id !== 0);
    const combatAll = fighters.filter((u) => u.def.weapons.length);
    const combat = combatAll.filter((u) => !holders.has(u.id));
    const cs = fighters.reduce((s, u) => s + u.def.supply, 0);

    // threats near my structures (allies' units are never threats)
    const threats = [];
    for (const e of W.ents) {
      if (!e.alive || e.team === p.team || e.owner < 0 || e.kind !== 'unit') continue;
      if (!N.visibleTo(W, p.id, e)) continue;
      for (const b of L.blds) if (Math.hypot(b.x - e.x, b.z - e.z) < 20) { threats.push(e); break; }
    }
    if (threats.length) ai.threatT = time;
    const under = threats.length > 0 || time - ai.threatT < 4;
    if (threats.length) { W.aiHelp = W.aiHelp || {}; const c0 = centroid(threats); W.aiHelp[p.team] = { x: c0.x, z: c0.z, t: time, pid: p.id, n: threats.length }; }

    // capture / hold detail: my share of the team's strategic sites and capture points that the team does not hold yet (or that are under enemy pressure)
    const cl = claims(W, p);
    const mine = cl.pts.filter((pt) => cl.by[pt.key] === p.id && (!holdsPt(pt, p.team) || (pt.site && seenAt(W, p, pt.x, pt.z) && pt.site.count[1 - p.team] > 0)));
    mine.sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z));
    const capMax = W.mode === 'objective' ? Math.max(2, Math.floor(combatAll.length * 0.4)) : (cs >= 8 ? Math.min(4, 1 + Math.floor(cs / 14)) : 0);
    const capIds = [];
    if (!under && capMax > 0 && mine.length) {
      const pool = combatAll.filter((u) => u.role !== 'artillery' && u.role !== 'heavy' && !u.air && u.role !== 'support' && (idleOK(u) || u.order.t === 'attackmove' || holders.has(u.id)));
      const per = Math.max(1, Math.min(3, Math.floor(pool.length / Math.max(1, Math.min(2, mine.length)))));
      let k = 0;
      for (let i = 0; i < Math.min(2, mine.length) && k < capMax; i++) {
        const pt = mine[i], grp = pool.filter((u) => !capIds.includes(u.id)).sort((a, b) => Math.hypot(a.x - pt.x, a.z - pt.z) - Math.hypot(b.x - pt.x, b.z - pt.z)).slice(0, per);
        grp.forEach((u) => capIds.push(u.id)); k += grp.length;
        const go = grp.filter((u) => Math.hypot(u.x - pt.x, u.z - pt.z) > (pt.site ? pt.site.r : pt.obj.r) * 0.6).map((u) => u.id);
        if (go.length && time - (ai.capOrder || -99) > 4) { Cmd.move(W, p.id, go, pt.x, pt.z, true); ai.capOrder = time; }
      }
    }
    ai.capIds = capIds;
    const capSet = new Set(capIds);

    if (under && threats.length) {
      const c = centroid(threats);
      const ids = combatAll.filter((u) => !(u.order.t === 'attackmove' && Math.hypot(u.order.x - c.x, u.order.z - c.z) < 8) && u.order.t !== 'attack').map((u) => u.id);
      if (ids.length) Cmd.move(W, p.id, ids, c.x, c.z, true);
      ai.mode = ai.mode === 'attack' && cs > 20 ? 'attack' : 'defend';
      return abilities(W, p, ai, combatAll, threats, mine);
    }
    if (ai.mode === 'defend') ai.mode = 'stage';

    // an ally is being raided: half of an idle army answers (coordinated defence, not every AI marching on its own lane)
    const help = W.aiHelp && W.aiHelp[p.team];
    if (help && help.pid !== p.id && time - help.t < 8 && cs >= 10 && Math.hypot(help.x - home.x, help.z - home.z) < 110) {
      const ids = combat.filter((u) => !capSet.has(u.id) && u.role !== 'artillery' && (idleOK(u) || u.order.t === 'attackmove')).slice(0, Math.ceil(combat.length * 0.5)).filter((u) => !u.order.help || time - u.order.help > 6).map((u) => u.id);
      if (ids.length && time - (ai.helpOrder || -99) > 6) { Cmd.move(W, p.id, ids, help.x, help.z, true); ai.helpOrder = time; }
    }

    // attack timing
    const frac = Math.min(1, time / 1200);
    let threshold = cfg.wave + (cfg.waveMin - cfg.wave) * frac;
    if (time > 1500) threshold = 1;
    let stagePt = { x: home.x + (enemyHome.x - home.x) * 0.22, z: home.z + (enemyHome.z - home.z) * 0.22 };
    // logistics: stage at a held Transit Nexus when the team holds a second one closer to the front
    const nx = nexusPlan(W, p, home, enemyHome);
    if (nx) stagePt = { x: nx.from.x, z: nx.from.z };
    const sp = N.freeNear(W, stagePt.x, stagePt.z, 10);

    if (ai.mode === 'stage' && cs >= threshold && combat.length >= 3) { ai.mode = 'attack'; ai.waveStart = cs; ai.lastOrder = -99; }
    if (ai.mode === 'attack' && cs < ai.waveStart * 0.35 && time < 1500) { ai.mode = 'stage'; ai.waveStart = 0; }

    if (nx && ai.mode === 'stage' && time - (ai.transitT || -99) > 45) {
      const at = combat.filter((u) => !capSet.has(u.id) && u.order.t === 'idle' && Math.hypot(u.x - nx.from.x, u.z - nx.from.z) <= N.SITES.nexus.radius);
      const sup = at.reduce((s, u) => s + u.def.supply, 0);
      if (at.length >= 4 && p.res >= sup * N.SITES.nexus.costPerSupply + 150) { const r = Cmd.transit(W, p.id, at.map((u) => u.id), nx.from.id, nx.to.id); if (r.ok) ai.transitT = time; }
    }

    if (ai.mode === 'attack') {
      // lane discipline: aim at what I know of the enemy near my counterpart's base; fall back to the nearest remembered structure, then sweep
      const c = combat.length ? centroid(combat) : home;
      let tgt = null, bd = 1e9;
      for (const m of p.mem.values()) { const d = Math.hypot(m.x - enemyHome.x, m.z - enemyHome.z) * 0.6 + Math.hypot(m.x - c.x, m.z - c.z) * 0.4; if (d < bd) { bd = d; tgt = { x: m.x, z: m.z }; } }
      if (!tgt) {
        const cand = [enemyHome].concat(W.map.deposits.map((d) => ({ x: d.x, z: d.z })), W.map.objectives.map((o) => ({ x: o.x, z: o.z })));
        for (let i = 0; i < cand.length; i++) {
          const pt = cand[(ai.sweepIdx + i) % cand.length];
          if (!p.expl[Math.floor(pt.z) * W.w + Math.floor(pt.x)] || Math.hypot(pt.x - c.x, pt.z - c.z) > 7) { tgt = pt; ai.sweepIdx = (ai.sweepIdx + i) % cand.length; break; }
        }
        if (!tgt) { tgt = cand[ai.sweepIdx++ % cand.length]; }
        if (Math.hypot(tgt.x - c.x, tgt.z - c.z) < 6) ai.sweepIdx++;
      }
      const ids = combat.concat(L.support).filter((u) => !capSet.has(u.id) && u.id !== ai.scoutId && u.order.t !== 'transit' && (idleOK(u) || (time - ai.lastOrder > 8 && u.order.t === 'attackmove' && Math.hypot(u.order.x - tgt.x, u.order.z - tgt.z) > 4))).map((u) => u.id);
      if (ids.length && time - ai.lastOrder > 2) { Cmd.move(W, p.id, ids, tgt.x, tgt.z, true); ai.lastOrder = time; }
    } else {
      const rest = fighters.filter((u) => !capSet.has(u.id) && u.order.t === 'idle' && Math.hypot(u.x - sp.x, u.z - sp.z) > 7).map((u) => u.id);
      if (rest.length) Cmd.move(W, p.id, rest, sp.x, sp.z, true);
    }
    abilities(W, p, ai, combatAll, threats, mine);
  }

  // A held nexus near home and a second held nexus that is meaningfully closer to the enemy counterpart.
  function nexusPlan(W, p, home, enemyHome) {
    const held = W.sites.filter((s) => s.k === 'nexus' && s.owner === p.team);
    if (held.length < 2) return null;
    let from = null, fd = 1e9;
    for (const s of held) { const d = Math.hypot(s.x - home.x, s.z - home.z); if (d < fd && d < 38) { fd = d; from = s; } }
    if (!from) return null;
    let to = null, td = Math.hypot(from.x - enemyHome.x, from.z - enemyHome.z) - 22;
    for (const s of held) { if (s === from) continue; const d = Math.hypot(s.x - enemyHome.x, s.z - enemyHome.z); if (d < td) { td = d; to = s; } }
    return to ? { from, to } : null;
  }

  function abilities(W, p, ai, combat, threats, mine) {
    if (ai.diff === 'easy' || !N.hasBuilt(W, p.id, 'lab') || combat.length < 4) return;
    const F = N.FACTIONS[p.faction];
    if (p.abilCd <= 0) {
      if (p.faction === 'vanguard') {
        let best = null, bn = 0;
        for (const e of W.ents) {
          if (!e.alive || e.team === p.team || e.owner < 0 || e.air || e.kind === 'deposit' || !N.visibleTo(W, p.id, e)) continue;
          let n = 0; for (const o of W.ents) if (o.alive && o.team === e.team && o.owner >= 0 && !o.air && o.kind !== 'deposit' && Math.hypot(o.x - e.x, o.z - e.z) < 3.5) n += o.kind === 'building' ? 1 : 1.5;
          if (n > bn) { bn = n; best = e; }
        }
        if (best && bn >= 5) Cmd.ability(W, p.id, best.x, best.z); // the lance never damages allies (sim resolveImpacts skips own team), so nearby friendly units are no reason to hold fire
      } else if (p.faction === 'brood') {
        const hurt = combat.filter((u) => u.hp < u.hpMax * 0.6);
        if (hurt.length >= 4) { const c = centroid(hurt); Cmd.ability(W, p.id, c.x, c.z); }
      } else {
        const eng = combat.filter((u) => W.time - u.lastHit < 2);
        if (eng.length >= 5) { const c = centroid(eng); Cmd.ability(W, p.id, c.x, c.z); }
      }
    }
    // signature powers: same cost/cooldown/fog/supply rules as the human (Cmd.power validates everything)
    if (p.powCd > 0 || W.time - (ai.powT || -99) < 12) return;
    const pw = F.power, eng = combat.filter((u) => W.time - u.lastHit < 2.5);
    if (pw.id === 'droppod') {
      const room = p.supplyCap - p.supplyUsed;
      if (room >= 6 && p.res >= pw.cost + 120) {
        const pt = (mine || []).find((m) => seenAt(W, p, m.x, m.z));
        if (pt) { const r = Cmd.power(W, p.id, pt.x, pt.z); ai.powT = W.time; if (r.ok) ai.log.push({ t: W.time, power: pw.id }); }
      }
    } else if (pw.id === 'frenzy') {
      if (eng.length >= 5 && p.res >= pw.cost + 50) { const c = centroid(eng); const r = Cmd.power(W, p.id, c.x, c.z); ai.powT = W.time; if (r.ok) ai.log.push({ t: W.time, power: pw.id }); }
    } else if (pw.id === 'stasis') {
      if (eng.length >= 3 && p.res >= pw.cost + 50) {
        let best = null, bn = 2;
        for (const e of W.ents) {
          if (!e.alive || e.kind !== 'unit' || e.air || e.team === p.team || e.owner < 0 || !N.visibleTo(W, p.id, e)) continue;
          let n = 0; for (const o of W.ents) if (o.alive && o.kind === 'unit' && !o.air && o.team === e.team && o.owner >= 0 && Math.hypot(o.x - e.x, o.z - e.z) <= pw.radius - 0.5 && N.visibleTo(W, p.id, o)) n++;
          if (n > bn) { bn = n; best = e; }
        }
        if (best) { const r = Cmd.power(W, p.id, best.x, best.z); ai.powT = W.time; if (r.ok) ai.log.push({ t: W.time, power: pw.id }); }
      }
    }
  }
  const seenAt = (W, p, x, z) => p.vis[Math.floor(z) * W.w + Math.floor(x)] === 1;
  function think(W, p, ai) {
    const cfg = ai.cfg;
    const L = collect(W, p);
    observeEnemy(W, p, ai);
    economy(W, p, ai, L, cfg);
    research(W, p, ai, L);
    production(W, p, ai, L, cfg);
    military(W, p, ai, L, cfg);
  }
})();

