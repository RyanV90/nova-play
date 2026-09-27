/* Tin Soldiers: Nova - deterministic simulation: commands, economy, production, combat, movement, objectives, outcomes. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const DT = N.TICK;
  const Cmd = (N.Cmd = {});
  const fail = (reason) => ({ ok: false, reason });
  const ok = (x) => Object.assign({ ok: true }, x || {});
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  N.angDiff = angDiff;

  /* ------------------------------------------------------------ stats helpers */
  const upg = (p, a) => (p.upg[a + '1'] ? 1 : 0) + (p.upg[a + '2'] ? 1 : 0);
  N.dmgMult = (p) => 1 + 0.12 * upg(p, 'dmg');
  N.armorOf = (W, e) => e.armor + upg(W.players[e.owner], 'armor');
  N.rangeOf = (W, e, w) => w.range + (e.fid === 'vanguard' && W.players[e.owner].upg.special ? 1.5 : 0);
  N.shieldMax = (W, e) => (e.def.shield ? e.def.shield + (e.fid === 'lattice' && W.players[e.owner].upg.special ? 20 : 0) : 0);
  const spend = (W, p, amt) => { W.players[p].res -= amt; W.players[p].stats.spent += amt; };
  const refund = (W, p, amt) => { W.players[p].res += amt; W.players[p].stats.refunded += amt; };

  N.hasBuilt = function (W, p, role) {
    for (const e of W.ents) if (e.alive && e.owner === p && e.kind === 'building' && e.role === role && e.built) return true;
    return false;
  };
  N.countOf = function (W, p, role, kind, builtOnly) {
    let n = 0;
    for (const e of W.ents) if (e.alive && e.owner === p && e.role === role && (!kind || e.kind === kind) && (!builtOnly || e.built !== false)) n++;
    return n;
  };
  N.standing = function (W, p) {
    let s = 0;
    for (const e of W.ents) if (e.alive && e.owner === p && e.def && (e.kind === 'unit' || e.built)) s += e.def.cost;
    return s;
  };
  const pick = (W, p, ids, kind) => {
    const out = [];
    for (const id of ids) { const e = W.byId.get(id); if (e && e.alive && e.owner === p && (!kind || e.kind === kind)) out.push(e); }
    return out;
  };

  /* ------------------------------------------------------------ orders & movement */
  function setOrder(W, u, order) {
    u.order = order; u.target = 0; u.path = null; u.goal = null; u.moving = false; u.mineT = 0; u.stuckT = 0;
    if (order.t === 'idle') u.home = { x: u.x, z: u.z };
  }
  function pathTo(W, u, x, z) {
    u.goal = { x, z }; u.pathT = W.time; u.navVer = W.navVer; u.pi = 0;
    if (u.air) { u.path = [{ x, z }]; return true; }
    const path = N.findPath(W, u.x, u.z, x, z, u.def.hover, u.radius > 0.7 ? 0.5 : 0.3);
    if (!path) { u.path = null; return false; }
    u.path = path; return true;
  }
  // Pheromone Frenzy: faster while frenzied, slower/lower rate of fire while exhausted afterwards
  const speedMul = (W, u) => (u.frenzyT > W.time ? N.FACTIONS.brood.power.speedMul : u.spentT > W.time ? N.FACTIONS.brood.power.spentSpeed : 1);
  const rateMul = (W, u) => (u.frenzyT > W.time ? N.FACTIONS.brood.power.rateMul : u.spentT > W.time ? N.FACTIONS.brood.power.spentRate : 1);
  function stepMove(W, u) {
    if (!u.path || u.pi >= u.path.length) { u.moving = false; return false; }
    const wp = u.path[u.pi];
    if (!u.air && u.navVer !== W.navVer && (W.tick + u.id) % 6 === 0 && u.goal) { pathTo(W, u, u.goal.x, u.goal.z); return true; }
    const dx = wp.x - u.x, dz = wp.z - u.z, dist = Math.hypot(dx, dz);
    const sm = u.air || u.def.hover ? 1 : W.map.slow[Math.floor(u.z) * W.w + Math.floor(u.x)];
    const step = u.def.speed * sm * DT * speedMul(W, u);
    let nx, nz;
    if (dist <= step + 0.02) { nx = wp.x; nz = wp.z; u.pi++; } else { nx = u.x + (dx / dist) * step; nz = u.z + (dz / dist) * step; }
    if (!u.air && N.blockedPt(W, nx, nz)) {
      if (!N.blockedPt(W, nx, u.z)) nz = u.z; else if (!N.blockedPt(W, u.x, nz)) nx = u.x; else { u.stuckT += DT; nx = u.x; nz = u.z; }
    }
    const moved = Math.hypot(nx - u.x, nz - u.z);
    if (moved < step * 0.25) u.stuckT += DT; else u.stuckT = Math.max(0, u.stuckT - DT);
    u.x = nx; u.z = nz; u.moving = true; u.want = Math.atan2(dz, dx);
    if (u.stuckT > 1.0 && u.goal) { pathTo(W, u, u.goal.x, u.goal.z); u.stuckT = 0.4; u.repaths = (u.repaths || 0) + 1; if (u.repaths > 6) { u.repaths = 0; setOrder(W, u, { t: 'idle' }); } }
    return !!u.path && u.pi < u.path.length;
  }
  function formation(units, x, z) {
    const n = units.length;
    if (n === 1) return [{ x, z }];
    let cx = 0, cz = 0; units.forEach((u) => { cx += u.x; cz += u.z; }); cx /= n; cz /= n;
    let fa = Math.atan2(z - cz, x - cx); if (!isFinite(fa)) fa = 0;
    const sp = 1.15 + (units.some((u) => u.radius > 0.8) ? 0.8 : 0), cols = Math.ceil(Math.sqrt(n * 1.3));
    const fx = Math.cos(fa), fz = Math.sin(fa), lx = -fz, lz = fx, slots = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
      const lat = (col - (inRow - 1) / 2) * sp, back = -row * sp;
      slots.push({ x: x + lx * lat + fx * back, z: z + lz * lat + fz * back, f: back, l: lat });
    }
    const us = units.slice().sort((a, b) => ((a.x - cx) * lx + (a.z - cz) * lz) - ((b.x - cx) * lx + (b.z - cz) * lz) || a.id - b.id);
    slots.sort((a, b) => a.l - b.l || b.f - a.f);
    const map = new Map(); us.forEach((u, i) => map.set(u.id, slots[i]));
    return units.map((u) => map.get(u.id));
  }

  Cmd.move = function (W, p, ids, x, z, am) {
    const us = pick(W, p, ids, 'unit');
    if (!us.length) return fail('nounits');
    x = Math.max(1.5, Math.min(W.w - 1.5, x)); z = Math.max(1.5, Math.min(W.h - 1.5, z));
    const slots = formation(us, x, z);
    us.forEach((u, i) => {
      setOrder(W, u, { t: am && u.def.weapons.length ? 'attackmove' : 'move', x: slots[i].x, z: slots[i].z });
      if (!pathTo(W, u, slots[i].x, slots[i].z)) setOrder(W, u, { t: 'idle' });
    });
    return ok({ n: us.length });
  };
  Cmd.stop = function (W, p, ids) { pick(W, p, ids, 'unit').forEach((u) => setOrder(W, u, { t: 'idle' })); return ok(); };
  Cmd.hold = function (W, p, ids) { pick(W, p, ids, 'unit').forEach((u) => { setOrder(W, u, { t: 'hold' }); }); return ok(); };
  N.canAttack = function (e, t) { return e.def.weapons.some((w) => N.weaponHits(w, t.air)); };
  Cmd.attack = function (W, p, ids, tid) {
    const t = W.byId.get(tid);
    if (!t || !t.alive || t.kind === 'deposit' || t.owner < 0 || t.team === W.players[p].team) return fail('badtarget'); // never orderable against yourself or an ally
    const us = pick(W, p, ids, 'unit').filter((u) => N.canAttack(u, t));
    if (!us.length) return fail('cannottarget');
    // last-observed position: what the player can actually see now, or a remembered (fixed) structure; never a hidden unit's live position
    const known = N.visibleTo(W, p, t) ? t : (t.kind === 'building' ? W.players[p].mem.get(t.id) : null);
    us.forEach((u) => {
      setOrder(W, u, { t: 'attack', id: tid }); u.target = tid;
      if (known) { u.order.lastX = known.x; u.order.lastZ = known.z; }
    });
    return ok({ n: us.length });
  };
  Cmd.harvest = function (W, p, ids, did) {
    const d = W.byId.get(did);
    if (!d || !d.alive || d.kind !== 'deposit') return fail('baddeposit');
    const us = pick(W, p, ids, 'unit').filter((u) => u.role === 'worker');
    if (!us.length) return fail('noworkers');
    us.forEach((u) => { setOrder(W, u, { t: 'harvest', dep: did }); u.hs = u.carry > 0 ? 'toBase' : 'toDep'; });
    return ok({ n: us.length });
  };
  Cmd.repair = function (W, p, ids, tid) {
    const t = W.byId.get(tid);
    if (!t || !t.alive || t.owner !== p || t.hp >= t.hpMax) return fail('badtarget');
    if (t.kind === 'unit' && (t.inf || t.role === 'worker')) return fail('cannotrepair');
    if (t.kind === 'building' && !t.built) return fail('unfinished');
    const us = pick(W, p, ids, 'unit').filter((u) => u.role === 'worker' && u.id !== tid);
    if (!us.length) return fail('noworkers');
    us.forEach((u) => setOrder(W, u, { t: 'repair', id: tid }));
    return ok({ n: us.length });
  };

  /* ------------------------------------------------------------ building placement & construction */
  N.checkPlace = function (W, p, role, tx, tz) {
    const pl = W.players[p], d = pl && N.buildingDef(pl.faction, role);
    if (!d) return 'invalid';
    const s = d.size;
    if (tx < 1 || tz < 1 || tx + s > W.w - 1 || tz + s > W.h - 1) return 'bounds';
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const k = (tz + j) * W.w + tx + i; if (W.map.terrain[k] || W.occ[k]) return 'blocked'; }
    for (const r of d.req) if (!N.hasBuilt(W, p, r)) return 'req:' + r;
    const G = N.BUILD_GAP;
    for (let j = -G; j < s + G; j++) for (let i = -G; i < s + G; i++) {
      const x = tx + i, z = tz + j; if (x < 0 || z < 0 || x >= W.w || z >= W.h) continue;
      const id = W.occ[z * W.w + x]; if (id) { const e = W.byId.get(id); if (e && e.kind === 'building') return 'gap'; }
    }
    if (!pl.expl[tz * W.w + tx] || !pl.expl[(tz + s - 1) * W.w + tx + s - 1]) return 'unexplored';
    for (const st of W.sites) if (Math.hypot(st.x - (tx + s / 2), st.z - (tz + s / 2)) < st.r * 0.8 + s / 2) return 'site'; // strategic sites keep a clear footprint
    const cx = tx + s / 2, cz = tz + s / 2;
    let near = false;
    for (const e of W.ents) if (e.alive && e.owner === p && e.kind === 'building' && e.built && Math.hypot(e.x - cx, e.z - cz) <= N.BUILD_RANGE) { near = true; break; }
    if (!near && (role === 'dropoff' || role === 'hq')) {
      for (const e of W.ents) if (e.alive && e.kind === 'deposit' && Math.hypot(e.x - cx, e.z - cz) <= 9) { near = true; break; }
    }
    if (!near) return role === 'dropoff' || role === 'hq' ? 'far_deposit' : 'far';
    let blocked = false;
    N.query(W, cx, cz, s + 2, (e) => { if (e.kind === 'unit' && !e.air && e.team !== pl.team && e.x > tx - 0.6 && e.x < tx + s + 0.6 && e.z > tz - 0.6 && e.z < tz + s + 0.6) blocked = true; });
    if (blocked) return 'enemyunit';
    return null;
  };
  Cmd.build = function (W, p, ids, role, tx, tz) {
    const pl = W.players[p], d = N.buildingDef(pl.faction, role);
    if (!d) return fail('invalid');
    const ws = pick(W, p, ids, 'unit').filter((u) => u.role === 'worker');
    if (!ws.length) return fail('noworkers');
    const why = N.checkPlace(W, p, role, tx, tz);
    if (why) return fail(why);
    if (pl.res < d.cost) return fail('afford');
    spend(W, p, d.cost);
    const site = N.spawnBuilding(W, p, role, tx, tz, false);
    pl.stats.built++;
    ws.forEach((u) => setOrder(W, u, { t: 'build', site: site.id }));
    return ok({ site: site.id });
  };
  Cmd.resume = function (W, p, ids, sid) {
    const s = W.byId.get(sid);
    if (!s || !s.alive || s.owner !== p || s.kind !== 'building' || s.built) return fail('badtarget');
    const ws = pick(W, p, ids, 'unit').filter((u) => u.role === 'worker');
    if (!ws.length) return fail('noworkers');
    ws.forEach((u) => setOrder(W, u, { t: 'build', site: sid }));
    return ok();
  };
  Cmd.cancelSite = function (W, p, sid) {
    const s = W.byId.get(sid);
    if (!s || !s.alive || s.owner !== p || s.kind !== 'building' || s.built) return fail('badtarget');
    refund(W, p, Math.floor(s.def.cost * 0.75));
    s.alive = false; N.setOcc(W, s, 0); N.emit(W, { t: 'removed', id: s.id });
    return ok();
  };

  /* ------------------------------------------------------------ production */
  Cmd.queue = function (W, p, bid, key) {
    const b = W.byId.get(bid), pl = W.players[p];
    if (!b || !b.alive || b.owner !== p || b.kind !== 'building' || !b.built) return fail('badbuilding');
    if (b.queue.length >= 5) return fail('queuefull');
    const F = N.FACTIONS[pl.faction];
    if (typeof key === 'string' && key.indexOf('up:') === 0) {
      const uk = key.slice(3);
      if (!N.isEnumKey(F.upgrades, uk)) return fail('invalid');
      const up = F.upgrades[uk];
      if (!b.def.research) return fail('notresearch');
      if (pl.upg[uk]) return fail('have');
      for (const r of up.req) if (!pl.upg[r]) return fail('req:' + r);
      for (const e of W.ents) if (e.alive && e.owner === p && e.kind === 'building') for (const q of e.queue) if (q.key === key) return fail('queued');
      if (pl.res < up.cost) return fail('afford');
      spend(W, p, up.cost);
      b.queue.push({ key, kind: 'up', cost: up.cost, time: up.time, supply: 0, progress: 0, started: false });
      return ok();
    }
    if (!N.isEnumKey(F.units, key) || b.def.prod.indexOf(key) < 0) return fail('notproduced');
    const d = F.units[key];
    for (const r of d.req) if (!N.hasBuilt(W, p, r)) return fail('req:' + r);
    if (pl.res < d.cost) return fail('afford');
    spend(W, p, d.cost);
    b.queue.push({ key, kind: 'unit', cost: d.cost, time: d.time * F.mods.prodTime, supply: d.supply, progress: 0, started: false });
    return ok();
  };
  Cmd.cancel = function (W, p, bid, index) {
    const b = W.byId.get(bid);
    if (!b || !b.alive || b.owner !== p || b.kind !== 'building' || index < 0 || index >= b.queue.length) return fail('badqueue');
    const it = b.queue[index];
    refund(W, p, it.started ? Math.floor(it.cost * 0.75) : it.cost);
    b.queue.splice(index, 1);
    return ok();
  };
  Cmd.rally = function (W, p, bid, x, z) {
    const b = W.byId.get(bid);
    if (!b || !b.alive || b.owner !== p || b.kind !== 'building') return fail('badbuilding');
    let dep = 0;
    for (const e of W.ents) if (e.alive && e.kind === 'deposit' && x >= e.tx - 0.5 && x <= e.tx + e.size + 0.5 && z >= e.tz - 0.5 && z <= e.tz + e.size + 0.5) dep = e.id;
    b.rally = { x, z, dep };
    return ok();
  };
  Cmd.surrender = function (W, p) { W.players[p].surrendered = true; return ok(); };

  function spawnPos(W, b, d, toward) {
    if (d.air) return { x: b.x, z: b.z + b.size / 2 };
    const tx = toward ? toward.x : W.w / 2, tz = toward ? toward.z : W.h / 2;
    let best = null, bd = 1e9;
    const s = b.size;
    for (let j = -1; j <= s; j++) for (let i = -1; i <= s; i++) {
      if (i >= 0 && i < s && j >= 0 && j < s) continue;
      const x = b.tx + i, z = b.tz + j;
      if (N.blockedAt(W, x, z)) continue;
      const dd = Math.hypot(x + 0.5 - tx, z + 0.5 - tz);
      if (dd < bd) { bd = dd; best = { x: x + 0.5, z: z + 0.5 }; }
    }
    return best || N.freeNear(W, b.x, b.z + s, 12);
  }

  /* ------------------------------------------------------------ combat */
  function hurt(W, t, amount, srcOwner, srcId, info) {
    if (!t.alive || amount <= 0) return;
    if (t.stasisT > W.time) return; // Stasis Bloom: frozen units are immune for the duration (and cannot act)
    let dmg = amount, hitShield = false;
    if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; hitShield = a > 0; }
    t.hp -= dmg; t.lastHit = W.time; if (srcId) t.lastAttacker = srcId;
    if (W.wantEvents && info) N.emit(W, { t: 'hit', x: t.x, z: t.z, id: t.id, kind: info.kind, shield: hitShield, cover: !!info.cover, flank: !!info.flank, air: !!t.air, big: t.kind === 'building' });
    if (t.hp <= 0) kill(W, t, srcOwner, srcId);
  }
  function kill(W, t, srcOwner, srcId) {
    if (!t.alive) return;
    t.alive = false; t.hp = 0;
    if (t.kind === 'building') N.setOcc(W, t, 0);
    if (t.owner >= 0) {
      const pl = W.players[t.owner]; pl.stats.lost++; pl.stats.lostValue += t.def.cost;
      if (srcOwner >= 0 && N.isEnemy(W, srcOwner, t.owner)) { const so = W.players[srcOwner]; so.stats.killed++; so.stats.killedValue += t.def.cost; }
    }
    const k = W.byId.get(srcId); if (k && k.kind === 'unit') k.kills++;
    N.emit(W, { t: 'death', id: t.id, x: t.x, z: t.z, role: t.role, fid: t.fid, air: !!t.air, kind: t.kind, size: t.size || 0, owner: t.owner, radius: t.radius, face: t.face });
  }
  N.hurt = hurt;

  function calcDamage(W, srcOwner, w, t, fx, fz, direct) {
    const sp = W.players[srcOwner];
    let dmg = w.dmg * N.dmgMult(sp);
    const kv = N.KIND_VS[w.kind]; if (kv && kv[t.atype]) dmg *= kv[t.atype];
    if (w.vs && w.vs[t.atype]) dmg *= w.vs[t.atype];
    const eff = Math.max(0, N.armorOf(W, t) - w.pen);
    let fin = Math.max(dmg * N.ARMOR_MIN, dmg - eff);
    const info = { kind: w.kind, cover: false, flank: false };
    if (direct && t.kind === 'unit' && !t.air && fx != null) {
      const a = Math.atan2(fz - t.z, fx - t.x);
      let covered = false;
      if (t.inf) {
        const ci = Math.floor(t.z) * W.w + Math.floor(t.x), cv = W.map.coverVal[ci];
        if (cv) { const df = Math.abs(angDiff(a, W.map.coverDir[ci])) * 57.2958; if (df <= N.COVER_ARC) { fin *= 1 - (cv === 2 ? N.COVER.heavy : N.COVER.light); covered = true; info.cover = true; } }
      }
      if (!covered && Math.abs(angDiff(a, t.face)) * 57.2958 > N.FLANK_ARC) { fin *= N.FLANK_BONUS; info.flank = true; }
    }
    return { fin, info };
  }
  N.calcDamage = calcDamage;

  function dealWeapon(W, src, w, t, fx, fz, direct) {
    if (!N.weaponHits(w, t.air)) return; // bullets etc. can never damage air, even via splash
    const r = calcDamage(W, src.owner, w, t, fx, fz, direct);
    hurt(W, t, r.fin, src.owner, src.id, r.info);
  }
  function splash(W, owner, srcId, w, x, z, primary) {
    const R = w.splash;
    N.emit(W, { t: 'impact', x, z, r: R, kind: w.kind });
    const list = [];
    const team = W.players[owner].team;
    N.query(W, x, z, R + 3, (e) => { if (e.team === team || e.kind === 'deposit' || e.owner < 0) return; list.push(e); }); // no friendly splash: teammates are never damaged
    list.sort((a, b) => a.id - b.id);
    for (const e of list) {
      const d = e.kind === 'building' ? N.edgeDist(x, z, e) : Math.max(0, Math.hypot(e.x - x, e.z - z) - e.radius * 0.5);
      if (d > R) continue;
      const src = { owner, id: srcId };
      const f = 1 - 0.5 * (d / R);
      if (!N.weaponHits(w, e.air)) continue;
      const r = calcDamage(W, owner, w, e, null, null, false);
      hurt(W, e, r.fin * f, owner, srcId, r.info);
    }
  }
  function fire(W, src, wi, t) {
    const w = src.def.weapons[wi];
    src.cd[wi] = w.cd;
    N.emit(W, { t: 'shot', src: src.id, dst: t.id, kind: w.kind, wname: w.name, x: src.x, z: src.z, tx: t.x, tz: t.z, air: !!t.air, sair: !!src.air, big: w.dmg > 26 || w.splash > 0, role: src.role, fid: src.fid, owner: src.owner, delay: w.delay, splash: w.splash });
    if (w.delay > 0) {
      W.impacts.push({ due: W.time + w.delay, t: 'w', owner: src.owner, src: src.id, w, x: t.x, z: t.z, tid: t.id, fx: src.x, fz: src.z });
    } else if (w.splash > 0) {
      splash(W, src.owner, src.id, w, t.x, t.z, t);
    } else dealWeapon(W, src, w, t, src.x, src.z, true);
  }

  function armed(e) { return e.def.weapons.length > 0; }
  function acquire(W, e, range, prefer) {
    let best = null, bs = 1e9;
    const owner = e.owner, ws = e.def.weapons;
    N.query(W, e.x, e.z, range + 3, (t) => {
      if (t.team === e.team || t.kind === 'deposit' || t.owner < 0) return;
      if (!N.visibleTo(W, owner, t)) return;
      const ed = N.edgeDist(e.x, e.z, t);
      let okw = false;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        if (N.weaponHits(w, t.air) && ed <= N.rangeOf(W, e, w) + (range - maxRange(W, e)) && ed >= w.min) { okw = true; break; }
      }
      if (!okw) return;
      let s = ed;
      if (!armed(t)) s += t.kind === 'building' ? 7 : 4;
      if (t.kind === 'building' && !t.built) s += 4;
      if (prefer && t.id === prefer) s -= 6;
      if (s < bs) { bs = s; best = t; }
    });
    return best;
  }
  function maxRange(W, e) { let m = 0; for (const w of e.def.weapons) m = Math.max(m, N.rangeOf(W, e, w)); return m; }

  // returns true if the unit is occupied with the target (fired or approaching)
  function engage(W, u, t, chase) {
    const ws = u.def.weapons;
    const ed = N.edgeDist(u.x, u.z, t);
    let any = false, R = 0, minR = 99;
    for (let i = 0; i < ws.length; i++) if (N.weaponHits(ws[i], t.air)) { any = true; R = Math.max(R, N.rangeOf(W, u, ws[i])); minR = Math.min(minR, ws[i].min); }
    if (!any) return false;
    const ang = Math.atan2(t.z - u.z, t.x - u.x);
    if (ed <= R) {
      u.want = ang; u.face = ang; u.moving = false; u.path = null;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        if (u.cd[i] <= 0 && N.weaponHits(w, t.air) && ed <= N.rangeOf(W, u, w) && ed >= w.min) fire(W, u, i, t);
      }
      return true;
    }
    if (!chase) return false;
    if (!u.goal || W.time - u.pathT > 0.7 || Math.hypot(u.goal.x - t.x, u.goal.z - t.z) > 2.5 || !u.path) {
      if (!pathTo(W, u, t.x, t.z)) return false;
    }
    stepMove(W, u);
    return true;
  }

  /* ------------------------------------------------------------ unit update */
  function nearestDropoff(W, u) {
    let best = null, bd = 1e9;
    for (const e of W.ents) if (e.alive && e.owner === u.owner && e.kind === 'building' && e.built && e.def.dropoff) { const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function nearestDeposit(W, x, z, maxD, avoid) {
    let best = null, bd = maxD;
    for (const e of W.ents) if (e.alive && e.kind === 'deposit' && e.amount > 0 && e.miners < 3 && e.id !== avoid) { const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  N.nearestDeposit = nearestDeposit;

  function workerHarvest(W, u, pl) {
    const o = u.order;
    if (u.hs === 'toBase') {
      const dp = nearestDropoff(W, u);
      if (!dp) { setOrder(W, u, { t: 'idle' }); return; }
      if (N.edgeDist(u.x, u.z, dp) <= 1.6 + u.radius) {
        const got = u.carry * pl.gatherMult; pl.res += got; pl.stats.income += got; pl.stats.gathered += got; u.carry = 0; u.hs = 'toDep'; u.path = null;
        N.emit(W, { t: 'deliver', x: u.x, z: u.z, owner: u.owner });
        return;
      }
      if (!u.path || W.time - u.pathT > 2.0 || u.navVer !== W.navVer) pathTo(W, u, dp.x, dp.z);
      stepMove(W, u);
      return;
    }
    let dep = W.byId.get(o.dep);
    if (!dep || !dep.alive || dep.amount <= 0) {
      const from = dep || u;
      dep = nearestDeposit(W, from.x, from.z, 30);
      if (!dep) { setOrder(W, u, { t: 'idle' }); return; }
      o.dep = dep.id; u.path = null; u.mineT = 0; // progress and reservation belong to the dead deposit; re-admit at the new one
    }
    const near = N.edgeDist(u.x, u.z, dep) <= 1.5 + u.radius;
    if (!near) {
      if (!u.path || u.navVer !== W.navVer || W.time - u.pathT > 3) pathTo(W, u, dep.x, dep.z);
      if (!stepMove(W, u) && !near) { u.stuckT += DT; if (u.stuckT > 1.5) { u.path = null; u.stuckT = 0; } }
      return;
    }
    // at deposit
    u.moving = false;
    if (u.mineT === 0) {
      if (dep.miners >= 3) { const alt = nearestDeposit(W, u.x, u.z, 14, dep.id); if (alt) { o.dep = alt.id; u.path = null; } return; }
      dep.miners++; // reserve now; from the next tick the mineT > 0 pre-count keeps this slot
    }
    u.mineT += DT; u.want = Math.atan2(dep.z - u.z, dep.x - u.x);
    if (u.mineT >= 3) {
      const take = Math.min(10, dep.amount); dep.amount -= take; u.carry = take; u.mineT = 0; u.hs = 'toBase'; u.path = null;
      if (dep.amount <= 0) { dep.alive = false; N.setOcc(W, dep, 0); N.emit(W, { t: 'depleted', x: dep.x, z: dep.z, id: dep.id }); }
    }
  }

  function workerBuild(W, u) {
    const s = W.byId.get(u.order.site);
    if (!s || !s.alive || s.built) { setOrder(W, u, { t: 'idle' }); return; }
    if (N.edgeDist(u.x, u.z, s) <= 1.4 + u.radius) {
      u.moving = false;
      u.want = Math.atan2(s.z - u.z, s.x - u.x);
      if (s.builders < 3) { s.builders++; s.progress += DT / s.def.time; u.building = true; }
      return;
    }
    if (!u.path || u.navVer !== W.navVer || W.time - u.pathT > 3) { if (!pathTo(W, u, s.x, s.z)) { setOrder(W, u, { t: 'idle' }); return; } }
    stepMove(W, u);
  }

  function workerRepair(W, u, pl) {
    const t = W.byId.get(u.order.id);
    if (!t || !t.alive || t.hp >= t.hpMax) { setOrder(W, u, { t: 'idle' }); return; }
    if (N.edgeDist(u.x, u.z, t) <= 1.6 + u.radius) {
      u.moving = false; u.want = Math.atan2(t.z - u.z, t.x - u.x);
      const rate = 10 * DT, cost = (t.def.cost * 0.25 / t.hpMax) * rate;
      if (pl.res < cost) { N.emit(W, { t: 'norepair', owner: u.owner }); setOrder(W, u, { t: 'idle' }); return; }
      spend(W, u.owner, cost); t.hp = Math.min(t.hpMax, t.hp + rate);
      return;
    }
    if (!u.path || W.time - u.pathT > 2) pathTo(W, u, t.x, t.z);
    stepMove(W, u);
  }

  function updateSupport(W, u) {
    const h = u.def.heal; if (!h) return;
    const pl = W.players[u.owner];
    let tgt = null, bd = 1e9;
    const list = [];
    N.query(W, u.x, u.z, h.range + 2, (e) => { if (e.team === u.team && e.kind === 'unit' && e !== u && (e.hp < e.hpMax || (h.shield && e.shield < N.shieldMax(W, e)))) list.push(e); });
    list.sort((a, b) => a.id - b.id);
    if (h.aura) {
      for (const e of list) if (Math.hypot(e.x - u.x, e.z - u.z) <= h.range) e.hp = Math.min(e.hpMax, e.hp + h.rate * DT);
      if (list.length && W.tick % 10 === 0) N.emit(W, { t: 'aura', x: u.x, z: u.z, r: h.range, fid: u.fid });
    } else {
      for (const e of list) { const d = Math.hypot(e.x - u.x, e.z - u.z); if (d <= h.range && d < bd) { bd = d; tgt = e; } }
      if (tgt) {
        tgt.hp = Math.min(tgt.hpMax, tgt.hp + h.rate * DT);
        if (h.shield) { const sm = N.shieldMax(W, tgt); tgt.shield = Math.min(sm, tgt.shield + h.shield * DT); }
        u.want = Math.atan2(tgt.z - u.z, tgt.x - u.x);
        if (W.tick % 8 === 0) N.emit(W, { t: 'healbeam', x: u.x, z: u.z, tx: tgt.x, tz: tgt.z, fid: u.fid });
      }
    }
    if (!tgt && !h.aura && u.order.t === 'idle' && (W.tick + u.id) % 10 === 0) {
      let best = null, b2 = 12;
      N.query(W, u.x, u.z, 12, (e) => { if (e.team === u.team && e.kind === 'unit' && e !== u && e.hp < e.hpMax * 0.95) { const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < b2) { b2 = d; best = e; } } });
      if (best) { u.healChase = best.id; pathTo(W, u, best.x, best.z); }
    }
    void pl;
  }

  function updateUnit(W, u) {
    const d = u.def, pl = W.players[u.owner];
    // regen, shields, buffs
    const fm = N.FACTIONS[u.fid].mods;
    const regen = (fm.regen + d.regen) * (pl.upg.special && u.fid === 'brood' ? 3 : 1);
    if (regen > 0 && u.hp < u.hpMax) u.hp = Math.min(u.hpMax, u.hp + regen * DT);
    const sm = N.shieldMax(W, u);
    if (sm > 0 && W.time - u.lastHit > 5 && u.shield < sm) u.shield = Math.min(sm, u.shield + d.shieldRegen * (pl.upg.special && u.fid === 'lattice' ? 2 : 1) * DT);
    if (u.overT && W.time > u.overT) { u.overT = 0; u.shield = Math.min(u.shield, sm); }
    if (u.frenzyT > 0 && W.time >= u.frenzyT) { u.frenzyT = 0; }
    if (u.stasisT > W.time) { u.moving = false; u.path = null; return; } // frozen: cannot move, fire or heal (immunity handled in hurt)
    const rm = rateMul(W, u);
    for (let i = 0; i < u.cd.length; i++) if (u.cd[i] > 0) u.cd[i] -= DT * rm;
    if (!u.air && N.blockedPt(W, u.x, u.z)) { const f = N.freeNear(W, u.x, u.z, 12); u.x = f.x; u.z = f.z; u.path = null; }
    u.building = false;
    if (d.heal) updateSupport(W, u);
    const o = u.order;
    const canFight = d.weapons.length > 0;
    const tgt = () => { const t = W.byId.get(u.target); return t && t.alive && t.team !== u.team && t.owner >= 0 && N.visibleTo(W, u.owner, t) ? t : null; };

    switch (o.t) {
      case 'idle': case 'hold': {
        if (canFight) {
          let t = tgt();
          if (!t && (W.tick + u.id) % 4 === 0) {
            const R = maxRange(W, u) + (o.t === 'hold' ? 0 : 2);
            let pref = 0; if (u.lastAttacker && W.time - u.lastHit < 3) pref = u.lastAttacker;
            t = acquire(W, u, R, pref); u.target = t ? t.id : 0;
          }
          if (t) {
            const chase = o.t === 'idle';
            if (chase && u.home && Math.hypot(u.x - u.home.x, u.z - u.home.z) > 12) { u.target = 0; Cmd.move(W, u.owner, [u.id], u.home.x, u.home.z, false); u.order.t = 'move'; break; }
            if (!engage(W, u, t, chase)) u.target = 0;
            break;
          }
        }
        if (o.t === 'idle' && u.path && u.pi < u.path.length && d.heal) stepMove(W, u);
        else u.moving = false;
        break;
      }
      case 'move':
        if (!stepMove(W, u)) setOrder(W, u, { t: 'idle' });
        break;
      case 'attackmove': {
        let t = tgt();
        if (!t && (W.tick + u.id) % 4 === 0) { t = acquire(W, u, maxRange(W, u) + 3, u.lastAttacker && W.time - u.lastHit < 3 ? u.lastAttacker : 0); u.target = t ? t.id : 0; }
        if (t) {
          if (!engage(W, u, t, true)) u.target = 0;
          u.amResume = true;
          break;
        }
        if (u.amResume || !u.path) { u.amResume = false; if (!pathTo(W, u, o.x, o.z)) { setOrder(W, u, { t: 'idle' }); break; } }
        if (!stepMove(W, u)) setOrder(W, u, { t: 'idle' });
        break;
      }
      case 'attack': {
        const t = W.byId.get(o.id);
        if (!t || !t.alive || t.team === u.team) { setOrder(W, u, { t: 'idle' }); break; }
        if (N.visibleTo(W, u.owner, t)) {
          o.lostT = 0; o.lastX = t.x; o.lastZ = t.z;
          if (!engage(W, u, t, true)) setOrder(W, u, { t: 'idle' });
          break;
        }
        // target not visible: no shots, and only the last OBSERVED position is used (never t.x/t.z)
        o.lostT = (o.lostT || 0) + DT;
        if (o.lastX == null) { setOrder(W, u, { t: 'idle' }); break; }
        if (o.lostT > 4) { const lx = o.lastX, lz = o.lastZ; setOrder(W, u, { t: 'attackmove', x: lx, z: lz }); if (!pathTo(W, u, lx, lz)) setOrder(W, u, { t: 'idle' }); break; }
        if (!u.goal || u.goal.x !== o.lastX || u.goal.z !== o.lastZ || !u.path) { if (!pathTo(W, u, o.lastX, o.lastZ)) { setOrder(W, u, { t: 'idle' }); break; } }
        stepMove(W, u);
        break;
      }
      case 'transit': u.moving = false; break; // channelling through a Transit Nexus: stationary (and vulnerable)
      case 'harvest': workerHarvest(W, u, pl); break;
      case 'build': workerBuild(W, u); break;
      case 'repair': workerRepair(W, u, pl); break;
      default: setOrder(W, u, { t: 'idle' });
    }
    // turn body toward wanted heading
    if (u.want != null) { const df = angDiff(u.want, u.face), st = 9 * DT; u.face += Math.abs(df) < st ? df : Math.sign(df) * st; }
  }

  function updateBuilding(W, b) {
    const pl = W.players[b.owner], d = b.def, F = N.FACTIONS[b.fid];
    if (!b.built) {
      if (F.mods.autoGrow) b.progress += (DT / d.time) * F.mods.autoGrow;
      b.progress = Math.min(1, b.progress);
      const gain = b.progress - (b.pp || 0); b.pp = b.progress;
      b.hp = Math.min(d.hp, b.hp + d.hp * 0.9 * gain);
      if (b.progress >= 1) { b.built = true; if (b.hp > d.hp - 0.01) b.hp = d.hp; N.emit(W, { t: 'built', id: b.id, owner: b.owner, x: b.x, z: b.z, role: b.role }); }
      return;
    }
    for (let i = 0; i < b.cd.length; i++) if (b.cd[i] > 0) b.cd[i] -= DT;
    // production
    if (b.queue.length) {
      const it = b.queue[0];
      if (!it.started) {
        if (it.kind === 'up' || pl.supplyUsed + it.supply <= pl.supplyCap) { it.started = true; pl.supplyUsed += it.supply; b.blocked = null; } else b.blocked = 'supply';
      }
      if (it.started) {
        it.progress += DT / it.time;
        if (it.progress >= 1) {
          b.queue.shift();
          if (it.kind === 'up') { pl.upg[it.key.slice(3)] = true; N.emit(W, { t: 'researched', owner: b.owner, key: it.key }); }
          else {
            const ud = F.units[it.key], pos = spawnPos(W, b, ud, b.rally);
            const u = N.spawnUnit(W, b.owner, it.key, pos.x, pos.z);
            pl.stats.unitsMade++;
            W.spawnLog.push({ p: b.owner, role: it.key, t: W.time });
            N.emit(W, { t: 'ready', owner: b.owner, role: it.key, id: u.id, x: pos.x, z: pos.z });
            if (b.rally) {
              if (it.key === 'worker' && b.rally.dep) Cmd.harvest(W, b.owner, [u.id], b.rally.dep);
              else Cmd.move(W, b.owner, [u.id], b.rally.x, b.rally.z, false);
            } else if (it.key === 'worker') {
              const dep = nearestDeposit(W, b.x, b.z, 40);
              if (dep) Cmd.harvest(W, b.owner, [u.id], dep.id);
            }
          }
        }
      }
    }
    // turrets
    if (d.weapons.length) {
      let t = W.byId.get(b.target); if (!t || !t.alive || !N.visibleTo(W, b.owner, t)) t = null;
      if (t) { const ed = N.edgeDist(b.x, b.z, t); let ok2 = false; d.weapons.forEach((w) => { if (N.weaponHits(w, t.air) && ed <= N.rangeOf(W, b, w)) ok2 = true; }); if (!ok2) t = null; }
      if (!t && (W.tick + b.id) % 4 === 0) { t = acquire(W, b, maxRange(W, b), 0); b.target = t ? t.id : 0; }
      if (t) {
        b.face = Math.atan2(t.z - b.z, t.x - b.x);
        const ed = N.edgeDist(b.x, b.z, t);
        for (let i = 0; i < d.weapons.length; i++) if (b.cd[i] <= 0 && N.weaponHits(d.weapons[i], t.air) && ed <= N.rangeOf(W, b, d.weapons[i])) fire(W, b, i, t);
      }
    }
  }

  function separate(W) {
    const us = [];
    for (const e of W.ents) if (e.alive && e.kind === 'unit') us.push(e);
    for (const a of us) {
      N.query(W, a.x, a.z, 2.6, (b) => {
        if (b.kind !== 'unit' || b.id <= a.id || b.air !== a.air) return;
        const dx = b.x - a.x, dz = b.z - a.z, min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) return;
        let d = Math.sqrt(d2), nx, nz;
        if (d < 0.001) { nx = ((a.id * 7) % 5) - 2 || 1; nz = ((b.id * 3) % 5) - 2; const l = Math.hypot(nx, nz); nx /= l; nz /= l; d = 0; } else { nx = dx / d; nz = dz / d; }
        const push = (min - d) * 0.5;
        let wa = 0.5, wb = 0.5;
        if (a.moving && !b.moving) { wa = 0.15; wb = 0.85; } else if (b.moving && !a.moving) { wa = 0.85; wb = 0.15; }
        if (a.role === 'worker' && a.order.t === 'harvest' && b.owner === a.owner && b.role !== 'worker') { wa = 0.85; wb = 0.15; }
        const ax = a.x - nx * push * wa * 1.6, az = a.z - nz * push * wa * 1.6, bx = b.x + nx * push * wb * 1.6, bz = b.z + nz * push * wb * 1.6;
        if (a.air || !N.blockedPt(W, ax, az)) { a.x = ax; a.z = az; }
        if (b.air || !N.blockedPt(W, bx, bz)) { b.x = bx; b.z = bz; }
      });
    }
  }

  function landPod(W, im) {
    const pl = W.players[im.owner], F = N.FACTIONS[pl.faction], pw = F.power, team = pl.team;
    N.emit(W, { t: 'impact', x: im.x, z: im.z, r: pw.radius, kind: 'pod', big: true });
    N.query(W, im.x, im.z, pw.radius + 3, (e) => {
      if (e.kind !== 'unit' || e.air || e.team === team || e.owner < 0) return;
      if (Math.hypot(e.x - im.x, e.z - im.z) - e.radius * 0.5 <= pw.radius) hurt(W, e, pw.crush, im.owner, 0, { kind: 'pod' });
    });
    if (!pl.alive) return;
    let back = 0, made = 0;
    let used = 0; for (const e of W.ents) if (e.alive && e.owner === im.owner) used += e.kind === 'unit' ? e.def.supply : (e.kind === 'building' && e.queue.length && e.queue[0].started ? e.queue[0].supply : 0);
    pw.spawn.forEach((role, i) => {
      const d = F.units[role];
      if (used + d.supply > pl.supplyCap) { back += d.cost; return; }
      used += d.supply;
      const a = (i / pw.spawn.length) * Math.PI * 2 + 0.6, pos = N.freeNear(W, im.x + Math.cos(a) * 1.3, im.z + Math.sin(a) * 1.3, 6);
      const u = N.spawnUnit(W, im.owner, role, pos.x, pos.z); made++;
      pl.stats.unitsMade++; W.spawnLog.push({ p: im.owner, role, t: W.time, pod: true });
      N.emit(W, { t: 'ready', owner: im.owner, role, id: u.id, x: pos.x, z: pos.z, pod: true });
    });
    if (back) refund(W, im.owner, back);
    im.result = { made, refunded: back };
    W.lastPod = im.result;
  }

  function resolveImpacts(W) {
    for (let i = 0; i < W.impacts.length; i++) {
      const im = W.impacts[i];
      if (im.due > W.time) continue;
      W.impacts.splice(i, 1); i--;
      const team = W.players[im.owner].team;
      if (im.t === 'w') {
        const w = im.w;
        if (w.splash > 0) splash(W, im.owner, im.src, w, im.x, im.z, null);
        else { const t = W.byId.get(im.tid); if (t && t.alive) dealWeapon(W, { owner: im.owner, id: im.src }, w, t, im.fx, im.fz, false); }
      } else if (im.t === 'lance') {
        N.emit(W, { t: 'impact', x: im.x, z: im.z, r: im.r, kind: 'lance', big: true });
        N.query(W, im.x, im.z, im.r + 4, (e) => {
          if (e.team === team || e.kind === 'deposit' || e.owner < 0 || e.air) return;
          const d = e.kind === 'building' ? N.edgeDist(im.x, im.z, e) : Math.hypot(e.x - im.x, e.z - im.z) - e.radius * 0.5;
          if (d <= im.r) hurt(W, e, e.kind === 'building' ? 75 : 150, im.owner, 0, { kind: 'lance' });
        });
      } else if (im.t === 'bloom') {
        N.emit(W, { t: 'impact', x: im.x, z: im.z, r: im.r, kind: 'bloom' });
        N.query(W, im.x, im.z, im.r + 2, (e) => { if (e.team === team && e.kind === 'unit' && Math.hypot(e.x - im.x, e.z - im.z) <= im.r) e.hp = Math.min(e.hpMax, e.hp + 80); });
      } else if (im.t === 'field') {
        N.emit(W, { t: 'impact', x: im.x, z: im.z, r: im.r, kind: 'field' });
        // Allies may each cast it, but overlapping fields do not add up: a unit never holds more than ONE field's worth (+80) above its own shield maximum; a repeat cast only tops up and refreshes the 15s timer.
        const add = N.FACTIONS.lattice.ability.shield;
        N.query(W, im.x, im.z, im.r + 2, (e) => { if (e.team === team && e.kind === 'unit' && Math.hypot(e.x - im.x, e.z - im.z) <= im.r) { e.shield = Math.max(e.shield || 0, Math.min((e.shield || 0) + add, N.shieldMax(W, e) + add)); e.overT = W.time + 15; } });
      } else if (im.t === 'pod') landPod(W, im);
      else if (im.t === 'stasis') {
        const pw = N.FACTIONS.lattice.power; let n = 0;
        N.query(W, im.x, im.z, im.r + 2, (e) => {
          if (e.kind !== 'unit' || e.air || e.team === team || e.owner < 0) return;
          if (Math.hypot(e.x - im.x, e.z - im.z) <= im.r) { e.stasisT = W.time + pw.duration; e.path = null; e.moving = false; n++; }
        });
        N.emit(W, { t: 'impact', x: im.x, z: im.z, r: im.r, kind: 'stasis', frozen: n });
        W.lastStasis = { frozen: n, at: W.time };
      }
    }
  }

  /* ------------------------------------------------------------ abilities and signature powers */
  const seenBy = (W, p, x, z) => W.players[p].vis[Math.floor(z) * W.w + Math.floor(x)] === 1;
  Cmd.ability = function (W, p, x, z) {
    const pl = W.players[p], ab = N.FACTIONS[pl.faction].ability;
    if (!pl.alive) return fail('eliminated');
    if (!N.hasBuilt(W, p, 'lab')) return fail('needlab');
    if (pl.abilCd > 0) return fail('cooldown');
    x = Math.max(1, Math.min(W.w - 1, x)); z = Math.max(1, Math.min(W.h - 1, z));
    if (pl.faction === 'vanguard' && !seenBy(W, p, x, z)) return fail('unseen'); // no orbital fire into the fog
    pl.abilCd = ab.cd;
    const type = pl.faction === 'vanguard' ? 'lance' : pl.faction === 'brood' ? 'bloom' : 'field';
    W.impacts.push({ due: W.time + ab.delay, t: type, owner: p, x, z, r: ab.radius });
    N.emit(W, { t: 'ability', fid: pl.faction, x, z, r: ab.radius, delay: ab.delay, owner: p });
    return ok();
  };
  // Faction signature power (key G). Same costs, cooldowns, fog rules and supply caps for humans and Normal AI.
  // Pure validation shared by Cmd.power and the UI's live target preview: returns a failure reason or null.
  N.powerCheck = function (W, p, x, z) {
    const pl = W.players[p], pw = N.FACTIONS[pl.faction].power, team = pl.team;
    N.rebuildHash(W); // target validation must see units spawned earlier this tick
    if (!pl.alive) return 'eliminated';
    if (!N.hasBuilt(W, p, 'lab')) return 'needlab';
    if (pl.powCd > 0) return 'cooldown';
    if (typeof x !== 'number' || typeof z !== 'number' || !isFinite(x) || !isFinite(z)) return 'badtarget';
    x = Math.max(1.5, Math.min(W.w - 1.5, x)); z = Math.max(1.5, Math.min(W.h - 1.5, z));
    if (!seenBy(W, p, x, z)) return 'unseen';
    if (pl.res < pw.cost) return 'afford';
    if (pw.id === 'droppod') {
      if (N.blockedPt(W, x, z)) return 'blocked';
      for (const e of W.ents) if (e.alive && e.kind === 'building' && e.team !== team && e.owner >= 0 && N.edgeDist(x, z, e) < 10) return 'tooclose';
    } else if (pw.id === 'stasis') {
      let n = 0; N.query(W, x, z, pw.radius + 2, (e) => { if (e.kind === 'unit' && !e.air && e.team !== team && e.owner >= 0 && Math.hypot(e.x - x, e.z - z) <= pw.radius && N.visibleTo(W, p, e)) n++; });
      if (!n) return 'notarget';
    } else if (pw.id === 'frenzy') {
      let n = 0; N.query(W, x, z, pw.radius + 2, (e) => { if (e.kind === 'unit' && e.team === team && Math.hypot(e.x - x, e.z - z) <= pw.radius) n++; });
      if (!n) return 'notarget';
    }
    return null;
  };
  Cmd.power = function (W, p, x, z) {
    const pl = W.players[p], pw = N.FACTIONS[pl.faction].power, team = pl.team;
    const why = N.powerCheck(W, p, x, z); if (why) return fail(why);
    x = Math.max(1.5, Math.min(W.w - 1.5, x)); z = Math.max(1.5, Math.min(W.h - 1.5, z));    spend(W, p, pw.cost); pl.powCd = pw.cd; pl.stats.powers++;
    if (pw.id === 'droppod') W.impacts.push({ due: W.time + pw.delay, t: 'pod', owner: p, x, z, r: pw.radius });
    else if (pw.id === 'stasis') W.impacts.push({ due: W.time + pw.delay, t: 'stasis', owner: p, x, z, r: pw.radius });
    else {
      let n = 0;
      N.query(W, x, z, pw.radius + 2, (e) => { if (e.kind === 'unit' && e.team === team && Math.hypot(e.x - x, e.z - z) <= pw.radius) { e.frenzyT = W.time + pw.duration; e.spentT = W.time + pw.duration + pw.spent; n++; } });
      W.lastFrenzy = { n, at: W.time };
    }
    N.emit(W, { t: 'power', id: pw.id, fid: pl.faction, x, z, r: pw.radius, delay: pw.delay, owner: p, dur: pw.duration || 0 });
    return ok();
  };

  /* ------------------------------------------------------------ Transit Nexus logistics */
  Cmd.transit = function (W, p, ids, fromId, toId) {
    const pl = W.players[p];
    if (!pl.alive) return fail('eliminated');
    const from = W.sites.find((s) => s.id === fromId), to = W.sites.find((s) => s.id === toId);
    if (!from || !to || from === to || from.k !== 'nexus' || to.k !== 'nexus') return fail('badsite');
    if (from.owner !== pl.team || to.owner !== pl.team) return fail('notheld');
    if (W.time < from.cdUntil) return fail('cooldown');
    const D = N.SITES.nexus;
    const us = pick(W, p, ids, 'unit').filter((u) => u.order.t !== 'transit' && Math.hypot(u.x - from.x, u.z - from.z) <= D.radius && u.stasisT <= W.time).slice(0, D.maxUnits);
    if (!us.length) return fail('nounits');
    let supply = 0; us.forEach((u) => { supply += u.def.supply; });
    const cost = supply * D.costPerSupply;
    if (pl.res < cost) return fail('afford');
    spend(W, p, cost); from.cdUntil = W.time + D.cooldown;
    us.forEach((u) => setOrder(W, u, { t: 'transit' }));
    W.transits.push({ owner: p, ids: us.map((u) => u.id), from: from.id, to: to.id, due: W.time + D.channel, cost, n: us.length });
    N.emit(W, { t: 'transit', owner: p, x: from.x, z: from.z, tx: to.x, tz: to.z, n: us.length, delay: D.channel });
    return ok({ n: us.length, cost });
  };
  function updateTransits(W) {
    for (let i = 0; i < W.transits.length; i++) {
      const tr = W.transits[i];
      if (tr.due > W.time) continue;
      W.transits.splice(i, 1); i--;
      const pl = W.players[tr.owner], from = W.sites.find((s) => s.id === tr.from), to = W.sites.find((s) => s.id === tr.to);
      const us = tr.ids.map((id) => W.byId.get(id)).filter((u) => u && u.alive && u.order.t === 'transit');
      const held = pl.alive && from.owner === pl.team && to.owner === pl.team;
      if (!held) { us.forEach((u) => setOrder(W, u, { t: 'idle' })); if (pl.alive) refund(W, tr.owner, tr.cost); N.emit(W, { t: 'transitCancel', owner: tr.owner, x: from.x, z: from.z }); continue; }
      const dead = tr.n - us.length; if (dead > 0) refund(W, tr.owner, Math.floor((tr.cost * dead) / tr.n));
      us.forEach((u, k) => {
        const a = (k / Math.max(1, us.length)) * Math.PI * 2, rr = 1.6 + 0.9 * Math.floor(k / 6), pos = N.freeNear(W, to.x + Math.cos(a) * rr, to.z + Math.sin(a) * rr, 8);
        setOrder(W, u, { t: 'idle' }); u.x = pos.x; u.z = pos.z; u.home = { x: pos.x, z: pos.z };
      });
      N.emit(W, { t: 'transitDone', owner: tr.owner, x: to.x, z: to.z, n: us.length });
      W.lastTransit = { n: us.length, at: W.time };
    }
  }

  /* ------------------------------------------------------------ objectives, sites, outcomes */
  const aliveMembers = (W, t) => W.teams[t].members.filter((id) => W.players[id].alive);
  function updateObjectives(W) {
    for (const p of W.players) p.held = 0;
    for (const tm of W.teams) tm.held = 0;
    for (const o of W.objs) {
      const cnt = [0, 0];
      N.query(W, o.x, o.z, o.r + 1, (e) => { if (e.kind === 'unit' && !e.air && Math.hypot(e.x - o.x, e.z - o.z) <= o.r) cnt[e.team]++; });
      if (cnt[0] && !cnt[1]) o.prog = Math.min(1, o.prog + DT / 10);
      else if (cnt[1] && !cnt[0]) o.prog = Math.max(-1, o.prog - DT / 10);
      o.contested = cnt[0] > 0 && cnt[1] > 0;
      if (o.prog >= 1) o.owner = 0; else if (o.prog <= -1) o.owner = 1;
      else if ((o.owner === 0 && o.prog <= 0) || (o.owner === 1 && o.prog >= 0)) o.owner = -1;
      if (o.owner >= 0) {
        const tm = W.teams[o.owner], mem = aliveMembers(W, o.owner); tm.held++;
        mem.forEach((id) => { const p = W.players[id]; p.held++; const inc = (N.OBJ_INCOME * DT) / mem.length; p.res += inc; p.stats.income += inc; });
        if (W.mode === 'objective') tm.score += DT;
      }
    }
  }
  // Strategic sites: only real, mature, non-flying, non-worker units capture (no spawn/ghost/fog capture); benefits derive from current ownership only.
  function updateSites(W) {
    for (const s of W.sites) {
      const cnt = [0, 0];
      N.query(W, s.x, s.z, s.r + 1, (e) => {
        if (e.kind === 'unit' && !e.air && e.role !== 'worker' && W.time - e.born >= N.CAPTURE_GRACE && e.order.t !== 'transit' && Math.hypot(e.x - s.x, e.z - s.z) <= s.r) cnt[e.team]++;
      });
      s.count = cnt;
      const rate = (n) => (DT / s.def.capTime) * (1 + 0.25 * (Math.min(n, 5) - 1));
      s.contested = cnt[0] > 0 && cnt[1] > 0;
      if (cnt[0] && !cnt[1]) s.prog = Math.min(1, s.prog + rate(cnt[0]));
      else if (cnt[1] && !cnt[0]) s.prog = Math.max(-1, s.prog - rate(cnt[1]));
      const prev = s.owner; let o = prev;
      if (s.prog >= 1) o = 0; else if (s.prog <= -1) o = 1; else if ((prev === 0 && s.prog <= 0) || (prev === 1 && s.prog >= 0)) o = -1;
      if (o !== prev) {
        s.owner = o; W.siteLog.push({ t: W.time, id: s.id, k: s.k, owner: o, prev });
        N.emit(W, { t: 'site', id: s.id, k: s.k, owner: o, prev, x: s.x, z: s.z });
        if (s.k === 'radar') N.updateVision(W);
      }
      if (s.owner >= 0 && s.k === 'foundry') {
        const D = s.def;
        N.query(W, s.x, s.z, D.radius + 1, (e) => {
          if (e.kind !== 'unit' || e.team !== s.owner || Math.hypot(e.x - s.x, e.z - s.z) > D.radius) return;
          if (e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + D.rate * DT);
          const sm = N.shieldMax(W, e); if (sm > 0 && e.shield < sm) e.shield = Math.min(sm, e.shield + D.shield * DT);
        });
      }
    }
  }

  function eliminate(W, p, why) {
    if (!p.alive) return;
    p.alive = false; p.elimT = W.time; W.elimLog.push({ p: p.id, t: W.time, why });
    for (const e of W.ents) if (e.alive && e.owner === p.id) kill(W, e, -1, 0);
    N.emit(W, { t: 'eliminated', owner: p.id, why });
  }

  function checkOutcome(W) {
    for (const p of W.players) {
      if (!p.alive) continue;
      const bare = !W.ents.some((e) => e.alive && e.owner === p.id && e.kind === 'building');
      if (p.surrendered || bare) eliminate(W, p, p.surrendered ? 'surrender' : 'elimination');
    }
    for (const tm of W.teams) tm.alive = tm.members.some((id) => W.players[id].alive);
    const live = W.teams.filter((t) => t.alive);
    if (!live.length) { W.over = { winner: -1, reason: 'mutual', time: W.time }; return; }
    if (live.length === 1) { const last = W.elimLog[W.elimLog.length - 1]; W.over = { winner: live[0].id, reason: last && last.why === 'surrender' ? 'surrender' : 'elimination', time: W.time }; return; }
    if (W.mode === 'objective') {
      const s = W.teams.map((t) => t.score);
      if (s[0] >= N.OBJ_TARGET || s[1] >= N.OBJ_TARGET) { W.over = { winner: s[0] >= N.OBJ_TARGET && s[0] >= s[1] ? 0 : 1, reason: 'objectives', time: W.time }; return; }
    }
    if (W.time >= N.MATCH_LIMIT) {
      const st = W.teams.map((t) => t.members.reduce((n, id) => n + N.standing(W, id), 0));
      W.over = { winner: st[0] === st[1] ? -1 : st[0] > st[1] ? 0 : 1, reason: 'timelimit', time: W.time, standing: st };
    }
  }
  /* ------------------------------------------------------------ world step */
  N.stepWorld = function (W) {
    if (W.over) return;
    W.tick++; W.time += DT;
    N.rebuildHash(W);
    for (const p of W.players) {
      p.supplyCap = 0; p.supplyUsed = 0;
      if (p.abilCd > 0) p.abilCd = Math.max(0, p.abilCd - DT);
      if (p.powCd > 0) p.powCd = Math.max(0, p.powCd - DT);
    }
    for (const e of W.ents) {
      if (!e.alive) continue;
      if (e.kind === 'building') { e.builders = 0; if (e.built) W.players[e.owner].supplyCap += e.def.supply; if (e.built && e.queue.length && e.queue[0].started) W.players[e.owner].supplyUsed += e.queue[0].supply; }
      else if (e.kind === 'unit') W.players[e.owner].supplyUsed += e.def.supply;
      else if (e.kind === 'deposit') e.miners = 0;
    }
    // mining slots: any worker mid-extraction (mineT > 0) beside a live deposit holds a reservation; count them before anyone new is admitted.
    // A worker that lost its deposit or was pushed out of reach drops its reservation (and its partial progress) so slots never orphan.
    for (const e of W.ents) {
      if (!e.alive || e.kind !== 'unit' || e.mineT <= 0) continue;
      const d = e.order.t === 'harvest' && e.hs !== 'toBase' ? W.byId.get(e.order.dep) : null;
      if (d && d.alive && d.kind === 'deposit' && d.amount > 0 && N.edgeDist(e.x, e.z, d) <= 1.5 + e.radius) d.miners++;
      else e.mineT = 0;
    }
    for (const p of W.players) p.supplyCap = Math.min(N.MAX_SUPPLY, p.supplyCap);
    if (W.tick % 4 === 1) N.updateVision(W);
    const n = W.ents.length, rev = W.tick & 1; // alternate iteration order so neither seat gets a systematic first-move edge
    for (let ii = 0; ii < n; ii++) {
      const e = W.ents[rev ? n - 1 - ii : ii];
      if (!e.alive) continue;
      if (e.kind === 'unit') updateUnit(W, e); else if (e.kind === 'building') updateBuilding(W, e);
    }
    separate(W);
    resolveImpacts(W);
    updateObjectives(W);
    updateSites(W);
    updateTransits(W);
    // finish construction that completed this tick and drop the dead
    let w = 0;
    for (let i = 0; i < W.ents.length; i++) { const e = W.ents[i]; if (e.alive) W.ents[w++] = e; else W.byId.delete(e.id); }
    W.ents.length = w;
    if (W.tick % 10 === 0) checkOutcome(W);
    // AIs that think on the same tick (mirror counterparts) alternate who goes first each think cycle, so neither seat has a fixed first-move edge
    const due = W.players.filter((p) => p.ai && p.alive && N.AI.due(W, p));
    if (due.length > 1 && (Math.floor(W.tick / due[0].ai.cfg.think) & 1)) due.reverse();
    for (const p of due) if (!W.over) N.AI.step(W, p);
  };
})();


