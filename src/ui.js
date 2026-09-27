/* Tin Soldiers: Nova - HUD, setup/pause/settings/help/tutorial/results overlays, input, command cards, tooltips, team roster, site cards. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const F = N.FACTIONS, Cmd = N.Cmd;
  const $ = (s, el) => (el || document).querySelector(s);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach((c) => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return e;
  }
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const BUILD_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'G'];
  const PROD_KEYS = ['Q', 'W', 'E', 'R', 'T'];
  const TRANSIT_KEYS = ['T', 'U', 'I'];
  const FAC_LETTER = { vanguard: 'V', brood: 'B', lattice: 'L' };

  /* ------------------------------------------------------------ icons (inline SVG, original pictograms) */
  const S = (inner) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  const ICONS = {
    worker: S('<path d="M5 15a7 7 0 0 1 14 0z"/><path d="M3 18.5h18M12 8V5"/>'), trooper: S('<circle cx="12" cy="6" r="3"/><path d="M12 9v7M7.5 12l4.5-1 5 3M9 21l3-5 3 5"/>'),
    raider: S('<path d="M3 14h18l-2.5-5.5h-11z"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>'), lancer: S('<path d="M12 3c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11z"/><path d="M9 17l-3 4M15 17l3 4"/>'),
    skyhunter: S('<path d="M12 21V6M7.5 10.5L12 5l4.5 5.5M5 21h14"/>'), walker: S('<rect x="7" y="4" width="10" height="8" rx="2"/><path d="M8.5 12l-2.5 8M15.5 12l2.5 8M3.5 20h5M15.5 20h5"/>'),
    artillery: S('<path d="M4 18h16M7 18l3.5-9 7-4 1.5 3-6 4-1.5 6"/>'), flyer: S('<path d="M12 3l3 8 7 4-7 1-3 5-3-5-7-1 7-4z"/>'),
    support: S('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'), heavy: S('<rect x="5" y="9" width="14" height="9" rx="1"/><path d="M12 9V4M8 9V6M16 9V6M3 21h18"/>'),
    hq: S('<path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/>'), supply: S('<rect x="4" y="12" width="8" height="8"/><rect x="12" y="8" width="8" height="12"/>'),
    dropoff: S('<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 8v8M8 12h8"/>'), barracks: S('<path d="M3 20h18M4 20V10l8-6 8 6v10"/><path d="M9 20v-5h6v5"/>'),
    factory: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'), airfield: S('<path d="M3 12h18M8 8l-3 4 3 4M16 8l3 4-3 4"/>'),
    lab: S('<path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/>'), turret: S('<circle cx="12" cy="14" r="5"/><path d="M12 14l8-6M5 20h14"/>'),
    aaturret: S('<circle cx="12" cy="16" r="4"/><path d="M12 12V3M8 7l4-4 4 4M5 21h14"/>'),
    move: S('<path d="M4 12h14M13 6l6 6-6 6"/>'), attackmove: S('<circle cx="12" cy="12" r="6.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'), stop: S('<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/>'),
    hold: S('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>'), build: S('<path d="M4 20l8-8M9 9l4-4 6 6-4 4z"/>'), repair: S('<path d="M14 6a4 4 0 0 0 5 5l-9 9-4-4 9-9a4 4 0 0 0-1-1z"/>'),
    ability: S('<path d="M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z"/>'), power: S('<path d="M13 2L5 13h6l-1 9 9-12h-6z"/>'), rally: S('<path d="M6 21V3M6 4h12l-3 4 3 4H6"/>'),
    cancel: S('<path d="M5 5l14 14M19 5L5 19"/>'), back: S('<path d="M9 5l-6 7 6 7M3 12h18"/>'), research: S('<path d="M12 20V6M6 11l6-6 6 6M5 21h14"/>'), done: S('<path d="M4 12l5 5 11-11"/>'),
    transit: S('<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M11 12h2"/>'),
  };
  N.ICONS = ICONS;
  const REASONS = {
    afford: 'Not enough Aether', queuefull: 'Queue is full (5)', gap: 'Keep 1 free tile between structures', blocked: 'Blocked by terrain or another object', bounds: 'Outside the map', unexplored: 'Unexplored: scout the area first',
    far: 'Too far from your finished structures (max 26 tiles)', far_deposit: 'Too far. Drop-offs and HQs may also be placed within 9 tiles of an Aether deposit', enemyunit: 'Enemy units are in the way', noworkers: 'Select a worker first', cannottarget: 'Selected units cannot attack that target (bullets, spines and claws cannot hit air; AA weapons cannot hit ground)',
    needlab: 'Requires a Research building', cooldown: 'Recharging', badtarget: 'Invalid target (allies are never valid attack targets)', cannotrepair: 'Infantry cannot be repaired by workers', unfinished: 'Structure is not finished', have: 'Already researched', queued: 'Already being researched', nounits: 'No eligible units selected', invalid: 'Invalid',
    unseen: 'Target area is hidden: your team must be able to see it', tooclose: 'Too close to an enemy structure (min 10 tiles)', notarget: 'Nothing valid in the ring (needs an enemy ground unit / a friendly unit, depending on the power)', notheld: 'Both Transit Nexuses must be held by your team',
    badsite: 'Not a Transit Nexus', eliminated: 'Your commander has been eliminated', site: 'Too close to a strategic site',
  };
  function reasonText(r) {
    if (!r) return '';
    if (r.indexOf('req:') === 0) return 'Requires ' + r.slice(4);
    return REASONS[r] || r;
  }

  N.UI = function (game) {
    const ui = this;
    ui.g = game; ui.stack = game.stack; ui.sel = []; ui.groups = new Array(10).fill(null); ui.mode = null; ui.page = 'main'; ui.hover = 0; ui.mouse = { x: 0, y: 0, cx: 0, cy: 0, in: false, down: null }; ui.keys = {}; ui.drag = null;
    ui.lastClick = { t: 0, id: 0 }; ui.alertT = {}; ui.lastGroupKey = { k: -1, t: 0 }; ui.lastAlert = null; ui.msgs = []; ui.hudT = 0; ui.sig = ''; ui.selSig = ''; ui.overlayEls = {}; ui.incSamples = []; ui.siteSel = null; ui.hoverSite = null; ui.teamSig = ''; ui.rem = 13;
    ui.el = { hud: $('#hud'), gl: $('#gl'), ov: $('#ov'), res: $('#rRes'), inc: $('#rInc'), sup: $('#rSup'), supWrap: $('#rSupWrap'), time: $('#rTime'), obj: $('#rObj'), alerts: $('#alerts'), hint: $('#hint'), sel: $('#selPanel'), cmd: $('#cmdPanel'), mm: $('#mm'), tip: $('#tip'), overlays: $('#overlays'), speed: $('#rSpeed'), abil: $('#abilBtn'), pow: $('#powBtn'), team: $('#teamBar'), spec: $('#specBanner') };
    ui.octx = ui.el.ov.getContext('2d');
    ui.bindInput();
    $('#btnMenu').addEventListener('click', () => ui.openPause());
    $('#btnHelp').addEventListener('click', () => ui.open('help'));
    ui.setup = Object.assign({}, game.settings.lastSetup);
  };
  const UP = N.UI.prototype;

  UP.bindMatch = function (W, R, pid) {
    this.W = W; this.R = R; this.pid = pid; this.myTeam = W.players[pid].team; this.sel = []; this.groups.fill(null); this.mode = null; this.page = 'main'; this.hover = 0; this.alertT = {}; this.msgs = []; this.el.alerts.innerHTML = ''; this.sig = ''; this.selSig = ''; this.lastAlert = null; this.incSamples = []; this.siteSel = null; this.hoverSite = null; this.teamSig = '';
    this.el.hud.classList.remove('hidden'); this.hudT = 0; this.el.hint.classList.add('hidden'); this.el.spec.classList.add('hidden');
  };
  UP.selEnts = function () { const W = this.W; if (!W) return []; const out = []; this.sel = this.sel.filter((id) => { const e = W.byId.get(id); if (e && e.alive) { out.push(e); return true; } return false; }); return out; };
  UP.setSel = function (ids) { this.sel = ids.slice(0, 200); this.page = 'main'; this.sig = ''; this.selSig = ''; this.siteSel = null; };
  UP.selectSite = function (id) { this.sel = []; this.siteSel = id; this.page = 'main'; this.sig = ''; this.selSig = ''; };
  UP.notify = function (text, kind) {
    const d = h('div', { class: 'msg ' + (kind || '') }, text); this.el.alerts.appendChild(d);
    while (this.el.alerts.children.length > 5) this.el.alerts.removeChild(this.el.alerts.firstChild);
    setTimeout(() => { d.classList.add('fade'); setTimeout(() => d.remove(), 600); }, 3600);
  };
  UP.fail = function (reason) { this.notify(reasonText(reason), 'bad'); N.Audio.uiSound('error'); };
  UP.alive = function () { return !this.W || this.W.players[this.pid].alive; };
  UP.relation = function (e) { return e.owner < 0 ? 'neutral' : e.owner === this.pid ? 'own' : e.team === this.myTeam ? 'ally' : 'enemy'; };

  /* ------------------------------------------------------------ tooltips */
  UP.weaponLines = function (d, pl) {
    return d.weapons.map((w) => {
      const air = N.weaponHits(w, true), gnd = N.weaponHits(w, false), tg = air && gnd ? 'ground + air' : air ? 'AIR ONLY' : 'ground only';
      const mult = pl ? N.dmgMult(pl) : 1, dps = (w.dmg * mult / w.cd).toFixed(1);
      return `<div class="wl"><b>${esc(w.name)}</b> <span class="k">${w.kind}</span> ${w.dmg} dmg, pen ${w.pen}, range ${w.range}${w.min ? ' (min ' + w.min + ')' : ''}, ${w.cd}s${w.splash ? ', splash ' + w.splash : ''}${w.delay ? ', ' + w.delay + 's flight' : ''} <i>(${dps} dps)</i> - <span class="${air ? 'tgA' : 'tgG'}">${tg}</span>${N.NO_AIR.indexOf(w.kind) >= 0 ? ' <em>Cannot hit air.</em>' : ''}</div>`;
    }).join('');
  };
  UP.unitTip = function (role) {
    const pl = this.W.players[this.pid], d = N.unitDef(pl.faction, role);
    const reqs = d.req.map((r) => N.buildingDef(pl.faction, r).name + (N.hasBuilt(this.W, this.pid, r) ? '' : ' (missing)')).join(', ');
    return `<h4>${esc(d.name)} <small>${N.ROLE_LABEL[role]}</small></h4><div class="st">${d.cost} Aether · ${d.time}s · supply ${d.supply}</div><div class="st">HP ${d.hp}${d.shield ? ' + shield ' + d.shield : ''} · armor ${d.armor} (${d.atype}${d.air ? ', flying' : ''}) · speed ${d.speed} · sight ${d.sight}</div>${this.weaponLines(d, pl)}${d.heal ? `<div class="wl">Heals ${d.heal.rate} hp/s${d.heal.aura ? ' to all allies in range ' + d.heal.range : ' (range ' + d.heal.range + ')'}${d.heal.shield ? ', restores ' + d.heal.shield + ' shield/s' : ''}</div>` : ''}<div class="good">Strong: ${esc(d.strong || d.note || '')}</div>${d.weak ? `<div class="bad">Weak: ${esc(d.weak)}</div>` : ''}<div class="note">${esc(d.note || '')}</div>${reqs ? `<div class="req">Requires: ${esc(reqs)}</div>` : ''}<div class="hk">Produced at ${esc(N.buildingDef(pl.faction, d.prod).name)}</div>`;
  };
  UP.buildingTip = function (role) {
    const pl = this.W.players[this.pid], d = N.buildingDef(pl.faction, role);
    const reqs = d.req.map((r) => N.buildingDef(pl.faction, r).name + (N.hasBuilt(this.W, this.pid, r) ? '' : ' (missing)')).join(', ');
    return `<h4>${esc(d.name)}</h4><div class="st">${d.cost} Aether · ${d.time}s build · ${d.size}x${d.size} tiles · HP ${d.hp} · armor ${d.armor}${d.supply ? ' · +' + d.supply + ' supply' : ''}</div><div class="note">${esc(d.desc)}</div>${this.weaponLines(d, pl)}${d.prod.length ? `<div class="hk">Trains: ${d.prod.map((k) => esc(N.unitDef(pl.faction, k).name)).join(', ')}</div>` : ''}${reqs ? `<div class="req">Requires: ${esc(reqs)}</div>` : ''}<div class="hk">Rule: 1 free tile between structures; within 26 tiles of a finished structure (drop-offs/HQs also near deposits).</div>`;
  };
  UP.siteTip = function (s) {
    const D = s.def, t = this.myTeam, holder = s.owner < 0 ? 'Neutral' : s.owner === t ? 'Held by your team' : 'Held by the enemy team';
    return `<h4>${esc(D.name)} <small>${holder}${s.contested ? ' · CONTESTED' : ''}</small></h4><div class="note">${esc(D.desc)}</div><div class="st">Capture: real army units (ground, not workers, alive 3s+) within ${s.r} tiles. ${D.capTime}s base, faster with more units (max +100%). Contested while both teams are present.</div><div class="hk">Benefits apply only while your team holds it and end the moment it is taken.</div>`;
  };
  UP.showTip = function (html, ev) { const t = this.el.tip; t.innerHTML = html; t.classList.remove('hidden'); this.moveTip(ev); };
  UP.moveTip = function (ev) { const t = this.el.tip, w = window.innerWidth, hh = window.innerHeight; const r = t.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY - r.height - 12; if (x + r.width > w - 6) x = w - r.width - 6; if (y < 6) y = ev.clientY + 18; if (y + r.height > hh - 6) y = hh - r.height - 6; t.style.left = x + 'px'; t.style.top = y + 'px'; };
  UP.hideTip = function () { this.el.tip.classList.add('hidden'); };
  UP.tipify = function (el, htmlFn) { el.addEventListener('mouseenter', (e) => this.showTip(typeof htmlFn === 'function' ? htmlFn() : htmlFn, e)); el.addEventListener('mousemove', (e) => this.moveTip(e)); el.addEventListener('mouseleave', () => this.hideTip()); };

  /* ------------------------------------------------------------ command card */
  UP.canQueue = function (b, key) {
    const W = this.W, pl = W.players[this.pid];
    if (b.queue.length >= 5) return 'queuefull';
    if (key.indexOf('up:') === 0) {
      const uk = key.slice(3), up = F[pl.faction].upgrades[uk];
      if (pl.upg[uk]) return 'have';
      for (const r of up.req) if (!pl.upg[r]) return 'req:' + F[pl.faction].upgrades[r].name;
      for (const e of W.ents) if (e.alive && e.owner === this.pid && e.kind === 'building') for (const q of e.queue) if (q.key === key) return 'queued';
      if (pl.res < up.cost) return 'afford'; return null;
    }
    const d = N.unitDef(pl.faction, key);
    for (const r of d.req) if (!N.hasBuilt(W, this.pid, r)) return 'req:' + N.buildingDef(pl.faction, r).name;
    if (pl.res < d.cost) return 'afford'; return null;
  };
  UP.transitOptions = function (units) {
    const W = this.W, D = N.SITES.nexus, out = [];
    const held = W.sites.filter((s) => s.k === 'nexus' && s.owner === this.myTeam);
    if (held.length < 2) return out;
    for (const from of held) {
      const near = units.filter((u) => u.owner === this.pid && Math.hypot(u.x - from.x, u.z - from.z) <= D.radius && u.order.t !== 'transit');
      if (!near.length) continue;
      for (const to of held) if (to !== from) out.push({ from, to, units: near });
    }
    return out;
  };
  UP.buildCard = function () {
    const W = this.W, pid = this.pid, pl = W.players[pid], Fc = F[pl.faction], btns = [];
    if (!pl.alive) return btns;
    const sel = this.selEnts();
    if (!sel.length || sel[0].owner !== pid) return btns;
    const units = sel.filter((e) => e.kind === 'unit'), blds = sel.filter((e) => e.kind === 'building');
    const ui = this;
    if (blds.length && !units.length) {
      const b = blds[0];
      if (!b.built) { btns.push({ label: 'Cancel', icon: 'cancel', key: 'X', desc: 'Cancel construction (75% refund)', act: () => { blds.forEach((s) => { if (!s.built) Cmd.cancelSite(W, pid, s.id); }); ui.setSel([]); } }); return btns; }
      b.def.prod.forEach((k, i) => { const d = Fc.units[k]; const why = ui.canQueue(b, k); btns.push({ label: d.name, icon: k, key: PROD_KEYS[i], cost: d.cost, off: why, tip: () => ui.unitTip(k), act: (ev) => ui.queue(b, k, ev && ev.shiftKey ? 5 : 1) }); });
      if (b.def.research) Object.keys(Fc.upgrades).forEach((k, i) => { const up = Fc.upgrades[k], why = ui.canQueue(b, 'up:' + k); btns.push({ label: up.name, icon: pl.upg[k] ? 'done' : 'research', key: PROD_KEYS[i], cost: up.cost, off: why, done: !!pl.upg[k], tip: () => `<h4>${esc(up.name)}</h4><div class="st">${up.cost} Aether · ${up.time}s</div><div class="note">${esc(up.desc)}</div>${up.req.length ? '<div class="req">Requires: ' + up.req.map((r) => esc(Fc.upgrades[r].name)).join(', ') + '</div>' : ''}`, act: () => ui.queue(b, 'up:' + k, 1) }); });
      if (b.def.prod.length) btns.push({ label: 'Rally', icon: 'rally', key: 'Y', tip: () => '<h4>Set rally point</h4><div class="note">New units go here. Right-click a deposit to send new workers to mine it. Also: right-click the ground with the building selected.</div>', act: () => ui.setMode({ t: 'rally', hint: 'Click the ground (or an Aether deposit) to set the rally point. Esc cancels.' }) });
      return btns;
    }
    const hasW = units.some((u) => u.role === 'worker');
    if (this.page === 'build' && hasW) {
      Object.keys(Fc.buildings).forEach((k, i) => {
        const d = Fc.buildings[k]; let why = null; for (const r of d.req) if (!N.hasBuilt(W, pid, r)) { why = 'req:' + Fc.buildings[r].name; break; }
        if (!why && pl.res < d.cost) why = 'afford';
        btns.push({ label: d.name, icon: k, key: BUILD_KEYS[i], cost: d.cost, off: why, tip: () => ui.buildingTip(k), act: () => { if (why) return ui.fail(why); ui.setMode({ t: 'build', role: k, hint: 'Left-click to place ' + d.name + ' (Shift keeps placing). Right-click / Esc cancels. Green = valid.' }); } });
      });
      btns.push({ label: 'Back', icon: 'back', key: 'Escape', keyLabel: 'Esc', act: () => { ui.page = 'main'; ui.sig = ''; } });
      return btns;
    }
    btns.push({ label: 'Move', icon: 'move', key: 'M', tip: () => '<h4>Move</h4><div class="note">Units go there and do not fire on the way. Right-click does the same.</div>', act: () => ui.setMode({ t: 'move', hint: 'Click a destination. Esc cancels.' }) });
    if (units.some((u) => u.def.weapons.length)) btns.push({ label: 'Attack-move', icon: 'attackmove', key: 'A', tip: () => '<h4>Attack-move</h4><div class="note">Move and engage anything hostile met on the way. Right-click an enemy to attack it directly. Allies are never targeted.</div>', act: () => ui.setMode({ t: 'attackmove', hint: 'Click a destination: units fight everything hostile they meet. Esc cancels.' }) });
    btns.push({ label: 'Stop', icon: 'stop', key: 'S', tip: () => '<h4>Stop</h4><div class="note">Cancel orders. Idle units still return fire and engage nearby foes.</div>', act: () => { Cmd.stop(W, pid, units.map((u) => u.id)); N.Audio.uiSound('command'); } });
    btns.push({ label: 'Hold', icon: 'hold', key: 'H', tip: () => '<h4>Hold position</h4><div class="note">Stay put and only shoot what comes into range.</div>', act: () => { Cmd.hold(W, pid, units.map((u) => u.id)); N.Audio.uiSound('command'); } });
    if (hasW) {
      btns.push({ label: 'Build', icon: 'build', key: 'B', tip: () => '<h4>Build structures</h4><div class="note">Opens the construction menu. Workers also mine (right-click a deposit) and repair damaged structures and vehicles (right-click).</div>', act: () => { ui.page = 'build'; ui.sig = ''; } });
      btns.push({ label: 'Repair', icon: 'repair', key: 'R', tip: () => '<h4>Repair</h4><div class="note">Click a damaged structure or vehicle of yours. Costs a little Aether per point restored.</div>', act: () => ui.setMode({ t: 'repair', hint: 'Click a damaged own structure or vehicle. Esc cancels.' }) });
    }
    this.abilityButtons(btns);
    this.transitOptions(units).forEach((o, i) => {
      if (i >= TRANSIT_KEYS.length) return;
      const sup = o.units.reduce((n, u) => n + u.def.supply, 0), cost = sup * N.SITES.nexus.costPerSupply, cd = Math.max(0, Math.ceil(o.from.cdUntil - W.time));
      const why = cd > 0 ? 'cooldown' : pl.res < cost ? 'afford' : null;
      btns.push({ label: 'Transit ' + (i + 1), icon: 'transit', key: TRANSIT_KEYS[i], cost, off: why, sub: cd > 0 ? cd + 's' : '', cls: 'tint-site', tip: () => `<h4>Transit Nexus jump</h4><div class="note">Send the ${o.units.length} selected unit(s) near this Nexus to the linked Nexus at ${Math.round(o.to.x)},${Math.round(o.to.z)}. ${sup} supply x ${N.SITES.nexus.costPerSupply} = ${cost} Aether. ${N.SITES.nexus.channel}s channel: units are frozen and vulnerable; if either Nexus is lost the jump is cancelled and refunded.</div>`, act: () => { const r = Cmd.transit(W, pid, o.units.map((u) => u.id), o.from.id, o.to.id); if (!r.ok) ui.fail(r.reason); else { N.Audio.uiSound('command'); ui.R.ping(o.from.x, o.from.z, 0xd18cff); ui.notify('Transit started: ' + r.n + ' units, ' + r.cost + ' Aether'); } } });
    });
    return btns;
  };
  UP.abilityButtons = function (btns) {
    const W = this.W, pid = this.pid, pl = W.players[pid], Fc = F[pl.faction], hasLab = N.hasBuilt(W, pid, 'lab'), ui = this;
    const ab = Fc.ability, pw = Fc.power;
    btns.push({ label: ab.name, icon: 'ability', key: 'F', cls: 'tint-abil', off: !hasLab ? 'needlab' : pl.abilCd > 0 ? 'cooldown' : null, sub: pl.abilCd > 0 ? Math.ceil(pl.abilCd) + 's' : '', tip: () => `<h4>${esc(ab.name)} <small>Faction ability · F</small></h4><div class="note">${esc(ab.desc)}</div><div class="st">Cooldown ${ab.cd}s</div>`, act: () => ui.abilityMode() });
    btns.push({ label: pw.short, icon: 'power', key: 'G', cost: pw.cost, cls: 'tint-pow', off: !hasLab ? 'needlab' : pl.powCd > 0 ? 'cooldown' : pl.res < pw.cost ? 'afford' : null, sub: pl.powCd > 0 ? Math.ceil(pl.powCd) + 's' : '', tip: () => `<h4>${esc(pw.name)} <small>Signature power · G</small></h4><div class="note">${esc(pw.desc)}</div><div class="st">${pw.cost} Aether · cooldown ${pw.cd}s${pw.delay ? ' · ' + pw.delay + 's telegraph' : ''} · radius ${pw.radius}</div>`, act: () => ui.powerMode() });
  };
  UP.abilityMode = function () {
    const W = this.W, pid = this.pid, pl = W.players[pid], ab = F[pl.faction].ability;
    if (!pl.alive) return this.fail('eliminated');
    if (!N.hasBuilt(W, pid, 'lab')) return this.fail('needlab');
    if (pl.abilCd > 0) return this.fail('cooldown');
    this.setMode({ t: 'ability', radius: ab.radius, name: ab.name, hint: 'Click the target area for ' + ab.name + '. Esc cancels.' });
  };
  UP.powerMode = function () {
    const W = this.W, pid = this.pid, pl = W.players[pid], pw = F[pl.faction].power;
    if (!pl.alive) return this.fail('eliminated');
    if (!N.hasBuilt(W, pid, 'lab')) return this.fail('needlab');
    if (pl.powCd > 0) return this.fail('cooldown');
    if (pl.res < pw.cost) return this.fail('afford');
    this.setMode({ t: 'power', radius: pw.radius, name: pw.name, hint: pw.name + ' (' + pw.cost + ' Aether): click the target. The ring shows the exact area; green = valid. Esc cancels.' });
  };
  UP.queue = function (b, key, n) {
    let ok = 0;
    for (let i = 0; i < n; i++) { const r = Cmd.queue(this.W, this.pid, b.id, key); if (r.ok) ok++; else { if (!ok) this.fail(r.reason); break; } }
    if (ok) N.Audio.uiSound('click');
    this.sig = '';
  };
  UP.setMode = function (m) { this.mode = m; this.el.hint.textContent = m ? m.hint : ''; this.el.hint.classList.toggle('hidden', !m); this.el.ov.style.cursor = m ? 'crosshair' : 'default'; if (!m) this.R.preview = null; N.Audio.uiSound('click'); };
  UP.clearMode = function () { this.mode = null; this.el.hint.classList.add('hidden'); this.el.ov.style.cursor = 'default'; };

  /* ------------------------------------------------------------ HUD refresh */
  UP.updateTeamBar = function () {
    const W = this.W, bar = this.el.team, sig = W.players.map((p) => (p.alive ? 1 : 0)).join('') + this.pid;
    if (sig === this.teamSig) return; this.teamSig = sig; bar.innerHTML = '';
    const order = W.players.filter((p) => p.team === this.myTeam).concat(W.players.filter((p) => p.team !== this.myTeam));
    order.forEach((p, i) => {
      if (i > 0 && p.team !== order[i - 1].team) bar.appendChild(h('span', { class: 'sep' }, 'vs'));
      const tag = p.id === this.pid ? 'You' : p.team === this.myTeam ? 'Ally' : 'Foe';
      const c = h('button', { class: 'chip6' + (p.alive ? '' : ' dead') + (p.id === this.pid ? ' me' : ''), type: 'button', style: 'border-color:' + hex(N.PLAYER_COLORS[p.id]) }, h('b', null, FAC_LETTER[p.faction]), h('span', null, p.alive ? tag : 'OUT'));
      c.addEventListener('click', () => { const s = p.start; if (p.team === this.myTeam || W.players[this.pid].expl[Math.floor(s.z) * W.w + Math.floor(s.x)]) this.R.centerOn(s.x, s.z); else this.notify('You have not scouted that base yet'); });
      this.tipify(c, () => `<h4>${esc(N.PLAYER_COLOR_NAMES[p.id])} <small>${esc(F[p.faction].name)}</small></h4><div class="st">${p.team === this.myTeam ? 'Your team' : 'Enemy team'} · ${p.id === this.pid ? 'you' : p.human ? 'human' : 'computer (' + N.DIFFICULTY[p.diff].label + ')'}</div><div class="note">${p.alive ? 'Active commander.' : 'ELIMINATED' + (W.elimLog.find((l) => l.p === p.id) ? ' at ' + fmtTime(W.elimLog.find((l) => l.p === p.id).t) : '') + '.'} Click to centre the camera on its base${p.team === this.myTeam ? '' : ' (if scouted)'}.</div>`);
      bar.appendChild(c);
    });
  };
  UP.updateHud = function (dt) {
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 0.12;
    const W = this.W, pl = W.players[this.pid], t = this.myTeam, tm = W.teams[t];
    this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 13;
    this.el.res.textContent = Math.floor(pl.res);
    const now = W.time; this.incSamples.push([now, pl.stats.gathered]); while (this.incSamples.length && now - this.incSamples[0][0] > 30) this.incSamples.shift();
    const s0 = this.incSamples[0], rate = s0 && now - s0[0] > 4 ? ((pl.stats.gathered - s0[1]) / (now - s0[0])) * 60 : 0;
    this.el.inc.textContent = rate ? '+' + Math.round(rate) + '/min' : '';
    this.el.sup.textContent = pl.supplyUsed + '/' + pl.supplyCap; this.el.supWrap.classList.toggle('warn', pl.supplyUsed >= pl.supplyCap);
    this.el.time.textContent = fmtTime(W.time);
    const held = W.objs.filter((o) => o.owner === t).length, theirs = W.objs.filter((o) => o.owner >= 0 && o.owner !== t).length, alive = tm.members.filter((id) => W.players[id].alive).length || 1;
    const sh = W.sites.filter((s) => s.owner === t).length;
    const enemyScore = Math.max(...W.teams.filter((x) => x.id !== t).map((x) => x.score));
    this.el.obj.textContent = (W.mode === 'objective' ? `Score ${Math.floor(tm.score)}/${N.OBJ_TARGET} vs ${Math.floor(enemyScore)} · Points ${held}-${theirs}` : `Points ${held}/${W.objs.length} (+${((held * N.OBJ_INCOME) / alive).toFixed(1)}/s)`) + (W.sites.length ? ` · Sites ${sh}/${W.sites.length}` : '');
    for (const e of W.ents) if (e.alive && e.owner === this.pid && e.kind === 'building' && e.blocked === 'supply' && e.queue.length) { if (this.throttle('supply', 12)) { this.notify('Supply blocked: build more ' + N.buildingDef(pl.faction, 'supply').name + 's', 'warn'); N.Audio.uiSound('alert'); } break; }
    this.el.speed.textContent = this.g.speedLabel();
    this.updateTeamBar();
    // spectator mode
    const dead = !pl.alive; this.el.spec.classList.toggle('hidden', !dead || !!W.over);
    if (dead && !W.over) { this.el.spec.textContent = 'You have been eliminated. Spectating: your allies fight on and share vision with you. The match ends when a whole team falls.'; if (this.mode) this.clearMode(); if (this.sel.length) this.setSel([]); }
    // command card
    const btns = this.buildCard(), sig = this.mode ? JSON.stringify([this.page, this.sel.length, this.sel[0]]) + btns.map((b) => b.label + (b.off || '') + (b.sub || '') + (b.done ? 'd' : '')).join('|') : this.page + '#' + this.sel.join(',') + this.siteSel + btns.map((b) => b.label + (b.off || '') + (b.sub || '') + (b.done ? 'd' : '')).join('|');
    if (sig !== this.sig) { this.sig = sig; this.renderCard(btns); }
    this.cardBtns = btns;
    this.renderSel();
    this.R.drawMinimap(this.el.mm);
    // always-available ability / power buttons (also keyboard F / G)
    const lab = N.hasBuilt(W, this.pid, 'lab'), Fc = F[pl.faction], ab = Fc.ability, pw = Fc.power;
    this.el.abil.classList.toggle('hidden', !lab || dead); this.el.pow.classList.toggle('hidden', !lab || dead);
    this.el.abil.classList.toggle('cool', pl.abilCd > 0); this.el.abil.classList.toggle('ready', pl.abilCd <= 0);
    this.el.abil.innerHTML = `${esc(ab.name)}<small>[F] ${pl.abilCd > 0 ? Math.ceil(pl.abilCd) + 's' : 'ready'}</small>`;
    this.el.pow.classList.toggle('cool', pl.powCd > 0 || pl.res < pw.cost); this.el.pow.classList.toggle('ready', pl.powCd <= 0 && pl.res >= pw.cost);
    this.el.pow.innerHTML = `${esc(pw.name)}<small>[G] ${pl.powCd > 0 ? Math.ceil(pl.powCd) + 's' : pw.cost + ' Aether'}</small>`;
  };
  UP.throttle = function (k, sec) { const t = this.W.time; if (this.alertT[k] != null && t - this.alertT[k] < sec) return false; this.alertT[k] = t; return true; };
  UP.renderCard = function (btns) {
    const c = this.el.cmd; c.innerHTML = ''; this.hideTip();
    btns.forEach((b) => {
      const spoken = [b.label, b.cost != null ? b.cost + ' Aether' : '', b.sub || '', b.key ? 'hotkey ' + (b.keyLabel || b.key) : '', b.off ? 'unavailable: ' + reasonText(b.off) : ''].filter(Boolean).join(', ');
      const el = h('button', { class: 'cbtn ' + (b.cls || '') + (b.off ? ' off' : '') + (b.done ? ' done' : ''), type: 'button', 'data-key': b.key || '', 'aria-label': spoken, 'aria-disabled': b.off ? 'true' : 'false' },h('span', { class: 'ic', html: ICONS[b.icon] || ICONS.ability }), h('span', { class: 'lb' }, b.label), b.cost != null ? h('span', { class: 'cs' }, b.cost) : null, b.key ? h('span', { class: 'hk' }, b.keyLabel || b.key) : null, b.sub ? h('span', { class: 'sb' }, b.sub) : null);
      el.addEventListener('click', (ev) => { if (b.off) { this.fail(b.off); return; } b.act(ev); if (!b.noClick) N.Audio.uiSound('click'); });
      this.tipify(el, () => (b.tip ? b.tip() : `<h4>${esc(b.label)}</h4><div class="note">${esc(b.desc || '')}</div>`) + (b.off ? `<div class="bad">${esc(reasonText(b.off))}</div>` : ''));
      el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); this.showTip(b.tip ? b.tip() : `<h4>${esc(b.label)}</h4><div class="note">${esc(b.desc || '')}</div>` + (b.off ? `<div class="bad">${esc(reasonText(b.off))}</div>` : ''), { clientX: r.left + r.width / 2, clientY: r.top }); });
      el.addEventListener('blur', () => this.hideTip());
      c.appendChild(el);
    });
  };
  UP.renderSiteCard = function (P, s) {
    const D = s.def, t = this.myTeam, holder = s.owner < 0 ? 'Neutral' : s.owner === t ? 'Held by your team' : 'Held by the enemy team';
    const box = h('div', { class: 'siteCard' });
    box.appendChild(h('h3', { style: 'color:' + hex(D.tint) }, D.name, h('small', null, ' · Strategic site · ' + holder + (s.contested ? ' · CONTESTED' : ''))));
    const prog = s.owner < 0 ? Math.abs(s.prog) : 1, sign = s.prog > 0 ? 'Blue' : 'Red';
    box.appendChild(h('div', { class: 'bar cap' }, h('i', { style: 'width:' + Math.round(Math.min(1, prog) * 100) + '%' }), h('span', null, s.owner < 0 ? (Math.abs(s.prog) > 0.01 ? sign + ' capturing ' + Math.round(Math.abs(s.prog) * 100) + '%' : 'Uncaptured') : Math.round(Math.abs(s.prog) * 100) + '% control')));
    box.appendChild(h('p', null, D.desc));
    box.appendChild(h('div', { class: 'stats' }, `Capture: real army units (ground, not workers, alive 3s+) within ${s.r} tiles · ${D.capTime}s base, faster with more units · contested while both teams are present.`));
    if (s.k === 'nexus') box.appendChild(h('div', { class: 'stats' }, 'To use: select your units within ' + D.radius + ' tiles of a held Nexus; Transit buttons appear on the command card (needs a second held Nexus).'));
    P.appendChild(box);
  };
  UP.renderSel = function () {
    const W = this.W, pl = W.players[this.pid], sel = this.selEnts(), P = this.el.sel;
    const ss = this.siteSel && W.sites.find((x) => x.id === this.siteSel);
    const sig = sel.map((e) => e.id + ':' + Math.ceil(e.hp / 5) + (e.queue ? e.queue.map((q) => q.key + Math.floor(q.progress * 20)).join('') : '') + (e.built === false ? Math.floor(e.progress * 50) : '')).join(',') + '|' + Math.floor(pl.res / 10) + (ss ? ss.owner + ':' + Math.round(ss.prog * 50) + ss.contested : '');
    if (sig === this.selSig) return; this.selSig = sig;
    P.innerHTML = ''; this.hideTip();
    if (!sel.length && ss) { this.renderSiteCard(P, ss); return; }
    if (!sel.length) { P.appendChild(h('div', { class: 'selempty' }, h('b', null, 'Nothing selected'), h('p', null, 'Click or drag-box your units. Right-click to move/attack/mine. Click a marked site for its benefit. F1 for help.'))); return; }
    const e0 = sel[0];
    if (sel.length === 1) {
      const d = e0.def, rel = this.relation(e0), own = rel === 'own';
      if (e0.kind === 'deposit') { P.appendChild(h('div', { class: 'one' }, h('h3', null, 'Aether deposit'), h('p', null, Math.floor(e0.amount) + ' / ' + e0.amount0 + ' remaining. Workers right-click it to mine (max 3 at a time). Deposits are finite.'))); return; }
      const box = h('div', { class: 'one' });
      const relTxt = own ? 'Yours' : rel === 'ally' ? 'Ally · ' + N.PLAYER_COLOR_NAMES[e0.owner] : 'Enemy · ' + N.PLAYER_COLOR_NAMES[e0.owner];
      box.appendChild(h('h3', { style: 'color:' + (own ? '#9ff' : rel === 'ally' ? '#9fe0c0' : '#f99') }, d.name, h('small', null, ' ' + (e0.kind === 'unit' ? N.ROLE_LABEL[e0.role] : 'Structure') + ' · ' + F[e0.fid].short + ' · ' + relTxt)));
      const bar = (v, m, cls) => h('div', { class: 'bar ' + cls }, h('i', { style: 'width:' + Math.max(0, Math.min(100, (v / m) * 100)) + '%' }), h('span', null, Math.ceil(v) + '/' + Math.ceil(m)));
      box.appendChild(bar(e0.hp, e0.hpMax, 'hp'));
      if (e0.kind === 'unit' && N.shieldMax(W, e0) > 0) box.appendChild(bar(e0.shield, N.shieldMax(W, e0), 'sh'));
      box.appendChild(h('div', { class: 'stats' }, `Armor ${N.armorOf(W, e0)} (${d.atype}) · ${e0.kind === 'unit' ? 'speed ' + d.speed + ' · ' : ''}sight ${d.sight}${e0.stasisT > W.time ? ' · FROZEN ' + Math.ceil(e0.stasisT - W.time) + 's' : ''}${e0.frenzyT > W.time ? ' · FRENZY ' + Math.ceil(e0.frenzyT - W.time) + 's' : e0.spentT > W.time ? ' · exhausted' : ''}`));
      if (d.weapons.length) box.appendChild(h('div', { class: 'wlines', html: this.weaponLines(d, W.players[e0.owner]) }));
      if (e0.kind === 'unit' && own) box.appendChild(h('div', { class: 'stats' }, 'Order: ' + e0.order.t + (e0.carry ? ' · carrying ' + e0.carry : '') + (e0.kills ? ' · kills ' + e0.kills : '')));
      if (e0.kind === 'building') {
        if (!e0.built) box.appendChild(h('div', { class: 'stats' }, 'Under construction ' + Math.floor(e0.progress * 100) + '%' + (own ? (e0.builders ? ' (' + e0.builders + ' builders)' : ' - needs a worker (right-click it with a worker)') : '')));
        else if (own) {
          const q = h('div', { class: 'queue' });
          e0.queue.forEach((it, i) => { const name = it.kind === 'up' ? F[e0.fid].upgrades[it.key.slice(3)].name : N.unitDef(e0.fid, it.key).name; const qi = h('button', { class: 'qi' + (i === 0 && it.started ? ' act' : ''), type: 'button' }, h('span', null, name.slice(0, 11)), h('small', null, 'cancel'), h('i', { style: 'width:' + Math.floor(it.progress * 100) + '%' })); qi.addEventListener('click', () => { const r = Cmd.cancel(W, this.pid, e0.id, i); if (r.ok) { this.notify('Cancelled ' + name + ' (' + (it.started ? '75%' : '100%') + ' refund)'); N.Audio.uiSound('click'); this.selSig = ''; } }); this.tipify(qi, `<h4>${esc(name)}</h4><div class="note">Click to cancel. Refund ${it.started ? '75% (already started)' : '100% (not started)'}.</div>`); q.appendChild(qi); });
          if (e0.blocked === 'supply' && e0.queue.length) q.appendChild(h('div', { class: 'warnl' }, 'SUPPLY BLOCKED'));
          box.appendChild(q);
        }
      }
      P.appendChild(box); return;
    }
    const counts = {}; sel.forEach((e) => { const k = e.kind + e.role; (counts[k] = counts[k] || { n: 0, e }).n++; });
    const grid = h('div', { class: 'multi' });
    sel.slice(0, 60).forEach((e) => { const b = h('button', { class: 'mi', type: 'button', style: 'border-color:' + hex(N.PLAYER_COLORS[e.owner]) }, e.role.slice(0, 2).toUpperCase(), h('i', { style: 'width:' + Math.floor((e.hp / e.hpMax) * 100) + '%' })); b.addEventListener('click', (ev) => { if (ev.shiftKey) this.setSel(this.sel.filter((id) => id !== e.id)); else this.setSel([e.id]); }); this.tipify(b, () => `<h4>${esc(e.def.name)}</h4><div class="st">HP ${Math.ceil(e.hp)}/${e.hpMax}</div><div class="note">Click: select only this. Shift-click: remove.</div>`); grid.appendChild(b); });
    P.appendChild(h('div', { class: 'many' }, h('h3', null, sel.length + ' selected', h('small', null, ' ' + Object.keys(counts).map((k) => counts[k].n + ' ' + counts[k].e.def.name).join(', '))), grid));
  };

  /* ------------------------------------------------------------ input */
  UP.siteAt = function (gp) {
    if (!gp || !this.W) return null;
    const p = this.W.players[this.pid]; let best = null, bd = 1e9;
    for (const s of this.W.sites) { const d = Math.hypot(gp.x - s.x, gp.z - s.z); if (d <= Math.max(2.6, s.r * 0.55) && d < bd && p.expl[Math.floor(s.z) * this.W.w + Math.floor(s.x)]) { bd = d; best = s; } }
    return best;
  };
  UP.pick = function (px, py, unitsOnly) {
    const R = this.R, W = this.W, gp = R.groundPoint(px, py);
    const ppu = R.h / (2 * Math.tan((R.camera.fov * Math.PI) / 360) * R.cam.dist);
    let best = null, bd = 1e9;
    for (const e of W.ents) {
      if (!e.alive || !R.entVisible(e)) continue;
      let d = null;
      if (e.kind === 'building') { if (unitsOnly) continue; if (gp && gp.x >= e.tx - 0.2 && gp.x <= e.tx + e.size + 0.2 && gp.z >= e.tz - 0.2 && gp.z <= e.tz + e.size + 0.2) d = 60; }
      else if (e.kind === 'deposit') { if (unitsOnly) continue; if (gp && gp.x >= e.tx - 0.4 && gp.x <= e.tx + e.size + 0.4 && gp.z >= e.tz - 0.4 && gp.z <= e.tz + e.size + 0.4) d = 40; }
      else {
        const v = R.views.get(e.id); if (!v) continue;
        const p = R.project(v.obj.position.x, v.obj.position.y + Math.max(0.4, e.radius), v.obj.position.z, this._pp = this._pp || {});
        if (p.behind) continue; const dist = Math.hypot(p.x - px, p.y - py), thr = Math.max(13, e.radius * ppu * 1.5 + (e.air ? 8 : 0));
        if (dist < thr) d = dist;
      }
      if (d != null && d < bd) { bd = d; best = e; }
    }
    return best;
  };
  UP.tileFor = function (gp, role) { const d = N.buildingDef(this.W.players[this.pid].faction, role); return { tx: Math.round(gp.x - d.size / 2), tz: Math.round(gp.z - d.size / 2), d }; };
  UP.selectedUnitIds = function () { return this.selEnts().filter((e) => e.kind === 'unit' && e.owner === this.pid).map((e) => e.id); };

  UP.bindInput = function () {
    const ui = this, ov = ui.el.ov;
    ov.addEventListener('contextmenu', (e) => e.preventDefault());
    ov.addEventListener('pointerdown', (e) => { ui.g.gesture(); if (ui.stack.blocking() || !ui.W) return; ov.setPointerCapture(e.pointerId); ui.mouse.x = e.offsetX; ui.mouse.y = e.offsetY; ui.onDown(e); });
    ov.addEventListener('pointermove', (e) => { ui.mouse.x = e.offsetX; ui.mouse.y = e.offsetY; ui.mouse.cx = e.clientX; ui.mouse.cy = e.clientY; ui.mouse.in = true; if (ui.stack.blocking() || !ui.W) return; ui.onMove(e); });
    ov.addEventListener('pointerup', (e) => { if (ui.stack.blocking() || !ui.W) return; ui.onUp(e); });
    ov.addEventListener('pointerleave', () => { ui.mouse.in = false; if (ui.hoverSite) { ui.hoverSite = null; ui.hideTip(); } });
    ov.addEventListener('wheel', (e) => { e.preventDefault(); if (ui.stack.blocking() || !ui.W) return; ui.R.cam.dist *= e.deltaY > 0 ? 1.1 : 0.91; ui.R.clampCam(); }, { passive: false });
    window.addEventListener('keydown', (e) => ui.onKey(e, true));
    window.addEventListener('keyup', (e) => { ui.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { ui.keys = {}; ui.drag = null; });
    const mm = ui.el.mm;
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
    const mmPt = (e) => { const r = mm.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ui.W.w, z: ((e.clientY - r.top) / r.height) * ui.W.h }; };
    mm.addEventListener('pointerdown', (e) => { ui.g.gesture(); if (ui.stack.blocking() || !ui.W) return; mm.setPointerCapture(e.pointerId); const p = mmPt(e); if (e.button === 2) { ui.contextCommand(null, p, true); } else { ui.mmDrag = true; ui.R.centerOn(p.x, p.z); } });
    mm.addEventListener('pointermove', (e) => { if (ui.mmDrag && ui.W) { const p = mmPt(e); ui.R.centerOn(p.x, p.z); } });
    mm.addEventListener('pointerup', () => { ui.mmDrag = false; });
    $('#abilBtn').addEventListener('click', () => ui.abilityMode());
    $('#powBtn').addEventListener('click', () => ui.powerMode());
    ui.el.abil.addEventListener('mouseenter', (e) => { const pl = ui.W && ui.W.players[ui.pid]; if (pl) { const ab = F[pl.faction].ability; ui.showTip(`<h4>${esc(ab.name)} <small>Faction ability · F</small></h4><div class="note">${esc(ab.desc)}</div><div class="st">Cooldown ${ab.cd}s</div>`, e); } });
    ui.el.pow.addEventListener('mouseenter', (e) => { const pl = ui.W && ui.W.players[ui.pid]; if (pl) { const pw = F[pl.faction].power; ui.showTip(`<h4>${esc(pw.name)} <small>Signature power · G</small></h4><div class="note">${esc(pw.desc)}</div><div class="st">${pw.cost} Aether · cooldown ${pw.cd}s${pw.delay ? ' · ' + pw.delay + 's telegraph' : ''} · radius ${pw.radius}</div>`, e); } });
    [ui.el.abil, ui.el.pow].forEach((b) => { b.addEventListener('mousemove', (e) => ui.moveTip(e)); b.addEventListener('mouseleave', () => ui.hideTip()); });
  };

  UP.onDown = function (e) {
    const ui = this, x = e.offsetX, y = e.offsetY;
    if (e.button === 1) { ui.mouse.down = { btn: 1, x, y, yaw: ui.R.cam.yaw, pitch: ui.R.cam.pitch }; return; }
    if (e.button === 2) {
      if (ui.mode) { ui.clearMode(); return; }
      const gp = ui.R.groundPoint(x, y); if (!gp) return; ui.contextCommand(ui.pick(x, y), gp, e.altKey || ui.keys['a']); return;
    }
    if (e.button === 0) {
      const gp = ui.R.groundPoint(x, y);
      if (ui.mode && gp) { ui.applyMode(gp, e); return; }
      ui.mouse.down = { btn: 0, x, y }; ui.drag = { x0: x, y0: y, x1: x, y1: y, on: false };
    }
  };
  UP.onMove = function (e) {
    const ui = this, x = e.offsetX, y = e.offsetY, md = ui.mouse.down;
    if (md && md.btn === 1) { ui.R.cam.yaw = md.yaw + (x - md.x) * 0.006; ui.R.cam.pitch = md.pitch - (y - md.y) * 0.004; return; }
    if (ui.drag) { ui.drag.x1 = x; ui.drag.y1 = y; if (Math.hypot(x - ui.drag.x0, y - ui.drag.y0) > 5) ui.drag.on = true; }
    ui.updateHover(x, y, e);
  };
  UP.updateHover = function (x, y) {
    const ui = this, gp = ui.R.groundPoint(x, y);
    if (ui.mode && ui.mode.t === 'build' && gp) { const t = ui.tileFor(gp, ui.mode.role), why = N.checkPlace(ui.W, ui.pid, ui.mode.role, t.tx, t.tz); const pl = ui.W.players[ui.pid]; ui.R.preview = { role: ui.mode.role, tx: t.tx, tz: t.tz, ok: !why && pl.res >= t.d.cost, reason: why || (pl.res < t.d.cost ? 'afford' : null) }; }
    else ui.R.preview = null;
    const e = ui.drag && ui.drag.on ? null : ui.pick(x, y); ui.hover = e ? e.id : 0;
    ui.hoverEnt = e;
    const site = !e && !ui.mode && !(ui.drag && ui.drag.on) ? ui.siteAt(gp) : null;
    if (site !== ui.hoverSite) { ui.hoverSite = site; if (site) ui.showTip(ui.siteTip(site), { clientX: ui.mouse.cx, clientY: ui.mouse.cy }); else ui.hideTip(); }
    else if (site) ui.moveTip({ clientX: ui.mouse.cx, clientY: ui.mouse.cy });
    let cur = ui.mode ? 'crosshair' : 'default';
    if (!ui.mode && e && ui.sel.length) {
      const sel = ui.selEnts(), rel = ui.relation(e);
      if (rel === 'enemy') cur = sel.some((u) => u.kind === 'unit' && u.owner === ui.pid && N.canAttack(u, e)) ? 'crosshair' : 'not-allowed';
      else if (e.kind === 'deposit' && sel.some((u) => u.role === 'worker')) cur = 'copy';
    }
    ui.el.ov.style.cursor = cur;
  };
  UP.onUp = function (e) {
    const ui = this, md = ui.mouse.down; ui.mouse.down = null;
    if (!md || md.btn !== 0) { ui.drag = null; return; }
    const d = ui.drag; ui.drag = null; if (!d) return;
    const shift = e.shiftKey;
    if (d.on) {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1), ids = [];
      for (const en of ui.W.ents) {
        if (!en.alive || en.kind !== 'unit' || en.owner !== ui.pid) continue;
        const v = ui.R.views.get(en.id); if (!v) continue; const p = ui.R.project(v.obj.position.x, v.obj.position.y + 0.5, v.obj.position.z, ui._pp = ui._pp || {});
        if (!p.behind && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(en.id);
      }
      if (ids.length) { ui.setSel(shift ? Array.from(new Set(ui.sel.concat(ids))) : ids); N.Audio.uiSound('select'); }
      else if (!shift) ui.setSel([]);
      return;
    }
    const en = ui.pick(d.x0, d.y0);
    const now = performance.now();
    if (!en) {
      const st = ui.siteAt(ui.R.groundPoint(d.x0, d.y0));
      if (st) { ui.selectSite(st.id); N.Audio.uiSound('select'); return; }
      if (!shift) ui.setSel([]); return;
    }
    if (en.owner === ui.pid && en.kind === 'unit' && ui.lastClick.id === en.id && now - ui.lastClick.t < 380) {
      const ids = []; for (const o of ui.W.ents) { if (o.alive && o.kind === 'unit' && o.owner === ui.pid && o.role === en.role) { const v = ui.R.views.get(o.id); if (!v) continue; const p = ui.R.project(v.obj.position.x, v.obj.position.y + 0.5, v.obj.position.z, ui._pp = ui._pp || {}); if (!p.behind && p.x > 0 && p.x < ui.R.w && p.y > 0 && p.y < ui.R.h) ids.push(o.id); } }
      ui.setSel(ids); N.Audio.uiSound('select'); ui.lastClick.t = 0; return;
    }
    ui.lastClick = { t: now, id: en.id };
    if (shift && en.owner === ui.pid) { const cur = ui.selEnts(); if (cur.every((c) => c.kind === 'unit') && en.kind === 'unit') ui.setSel(ui.sel.indexOf(en.id) >= 0 ? ui.sel.filter((i) => i !== en.id) : ui.sel.concat(en.id)); else ui.setSel([en.id]); }
    else ui.setSel([en.id]);
    N.Audio.uiSound('select');
  };

  UP.applyMode = function (gp, e) {
    const ui = this, m = ui.mode, W = ui.W, pid = ui.pid;
    const ids = ui.selectedUnitIds(); let r;
    if (m.t === 'build') {
      const t = ui.tileFor(gp, m.role); const workers = ids.filter((id) => W.byId.get(id).role === 'worker');
      r = Cmd.build(W, pid, workers, m.role, t.tx, t.tz);
      if (!r.ok) { ui.fail(r.reason); return; }
      N.Audio.uiSound('place'); ui.R.ping(t.tx + t.d.size / 2, t.tz + t.d.size / 2, 0x40ff70);
      if (!e.shiftKey) { ui.clearMode(); ui.R.preview = null; }
      return;
    }
    if (m.t === 'move' || m.t === 'attackmove') { r = Cmd.move(W, pid, ids, gp.x, gp.z, m.t === 'attackmove'); if (!r.ok) ui.fail(r.reason); else { ui.R.ping(gp.x, gp.z, m.t === 'move' ? 0x40ff70 : 0xff5040); N.Audio.uiSound('command'); } ui.clearMode(); return; }
    if (m.t === 'ability') { r = Cmd.ability(W, pid, gp.x, gp.z); if (!r.ok) ui.fail(r.reason); else N.Audio.uiSound('command'); ui.clearMode(); return; }
    if (m.t === 'power') { r = Cmd.power(W, pid, gp.x, gp.z); if (!r.ok) { ui.fail(r.reason); return; } N.Audio.uiSound('command'); ui.clearMode(); return; }
    if (m.t === 'rally') { ui.selEnts().filter((b) => b.kind === 'building' && b.owner === pid).forEach((b) => Cmd.rally(W, pid, b.id, gp.x, gp.z)); ui.R.ping(gp.x, gp.z, 0xffe060); N.Audio.uiSound('command'); ui.clearMode(); return; }
    if (m.t === 'repair') { const t = ui.pick(ui.mouse.x, ui.mouse.y); if (t) { r = Cmd.repair(W, pid, ids, t.id); if (!r.ok) ui.fail(r.reason); else N.Audio.uiSound('command'); } else ui.fail('badtarget'); ui.clearMode(); }
  };

  UP.contextCommand = function (en, gp, attackMove) {
    const ui = this, W = ui.W, pid = ui.pid, sel = ui.selEnts();
    if (!sel.length || sel[0].owner !== pid || !ui.alive()) return;
    const ids = ui.selectedUnitIds();
    if (!ids.length) { // buildings: rally
      const b = sel.filter((x) => x.kind === 'building' && x.def.prod.length); if (b.length) { b.forEach((x) => Cmd.rally(W, pid, x.id, gp.x, gp.z)); ui.R.ping(gp.x, gp.z, 0xffe060); N.Audio.uiSound('command'); ui.notify('Rally point set'); }
      return;
    }
    const rel = en ? ui.relation(en) : null;
    if (en && rel === 'enemy') {
      const r = Cmd.attack(W, pid, ids, en.id);
      if (r.ok) { ui.R.ping(en.x, en.z, 0xff5040); N.Audio.uiSound('command'); const rest = ids.filter((id) => !N.canAttack(W.byId.get(id), en)); if (rest.length) Cmd.move(W, pid, rest, en.x, en.z, false); }
      else { ui.fail(r.reason); Cmd.move(W, pid, ids, gp.x, gp.z, false); }
      return;
    }
    if (en && en.kind === 'deposit') { const r = Cmd.harvest(W, pid, ids, en.id); const rest = ids.filter((id) => W.byId.get(id).role !== 'worker'); if (rest.length) Cmd.move(W, pid, rest, en.x, en.z, false); if (r.ok) { ui.R.ping(en.x, en.z, 0xffe060); N.Audio.uiSound('command'); } return; }
    if (en && en.owner === pid && en.kind === 'building' && !en.built) { const r = Cmd.resume(W, pid, ids, en.id); if (r.ok) { ui.R.ping(en.x, en.z, 0x40ff70); N.Audio.uiSound('command'); return; } }
    if (en && en.owner === pid && en.hp < en.hpMax && !(en.kind === 'unit' && (en.inf || en.role === 'worker'))) { const r = Cmd.repair(W, pid, ids, en.id); if (r.ok) { ui.R.ping(en.x, en.z, 0x40ff70); N.Audio.uiSound('command'); const rest = ids.filter((id) => W.byId.get(id).role !== 'worker'); if (rest.length) Cmd.move(W, pid, rest, en.x, en.z, false); return; } }
    const r = Cmd.move(W, pid, ids, gp.x, gp.z, !!attackMove);
    if (r.ok) { ui.R.ping(gp.x, gp.z, attackMove ? 0xff5040 : 0x40ff70); N.Audio.uiSound('command'); }
  };

  UP.onKey = function (e) {
    const ui = this, k = e.key, kl = k.toLowerCase();
    ui.g.gesture();
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && k !== 'Escape') return;
    if (k === 'F1') { e.preventDefault(); if (ui.stack.has('help')) ui.close('help'); else ui.open('help'); return; }
    if (ui.stack.blocking()) { if (k === 'Escape') { const t = ui.stack.top(); if (t !== 'results' && t !== 'setup') ui.close(t); } return; }
    if (!ui.W) return;
    ui.keys[kl] = true;
    if (k === 'Escape') { if (ui.mode) { ui.clearMode(); ui.R.preview = null; } else if (ui.page === 'build') { ui.page = 'main'; ui.sig = ''; } else ui.openPause(); return; }
    if (e.ctrlKey && /^[0-9]$/.test(k)) { e.preventDefault(); ui.groups[+k] = ui.sel.slice(); ui.notify('Control group ' + k + ' set (' + ui.sel.length + ')'); return; }
    if (/^[0-9]$/.test(k) && !e.ctrlKey && !e.altKey) {
      const g = ui.groups[+k]; if (g && g.length) { const live = g.filter((id) => { const en = ui.W.byId.get(id); return en && en.alive; }); ui.groups[+k] = live; if (live.length) { ui.setSel(live); const en = ui.W.byId.get(live[0]); if (ui.lastGroupKey.k === +k && performance.now() - ui.lastGroupKey.t < 450) ui.R.centerOn(en.x, en.z); ui.lastGroupKey = { k: +k, t: performance.now() }; N.Audio.uiSound('select'); } }
      return;
    }
    if (k === 'Home' || k === 'Backspace') { e.preventDefault(); const s = ui.W.players[ui.pid].start; ui.R.centerOn(s.x, s.z); return; }
    if (k === ' ') { e.preventDefault(); if (ui.lastAlert) ui.R.centerOn(ui.lastAlert.x, ui.lastAlert.z); return; }
    if (k === '.') { const w = ui.W.ents.find((x) => x.alive && x.owner === ui.pid && x.role === 'worker' && x.order.t === 'idle'); if (w) { ui.setSel([w.id]); ui.R.centerOn(w.x, w.z); } else ui.notify('No idle workers'); return; }
    if (k === '[') { ui.R.cam.yaw -= 0.15; return; } if (k === ']') { ui.R.cam.yaw += 0.15; return; }
    if (k === '+' || k === '=') { ui.R.cam.dist *= 0.9; return; } if (k === '-') { ui.R.cam.dist *= 1.1; return; }
    if (kl === 'p') { ui.openPause(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui.page !== 'build') {
      if (kl === 'f' && ui.buildCard().every((b) => b.key !== 'F')) { e.preventDefault(); ui.abilityMode(); return; }
      if (kl === 'g' && ui.buildCard().every((b) => b.key !== 'G')) { e.preventDefault(); ui.powerMode(); return; }
    }
    {
      const key = k.length === 1 ? k.toUpperCase() : k;
      ui.cardBtns = ui.buildCard(); // rebuilt on every key press so a hotkey right after (re)selecting always matches the current selection
      const b = ui.cardBtns.find((c) => c.key === key || (c.key === 'Escape' && k === 'Escape'));
      if (b) { e.preventDefault(); if (b.off) ui.fail(b.off); else { b.act(e); N.Audio.uiSound('click'); } }
    }
  };

  UP.update = function (dt) {
    const ui = this, R = ui.R; if (!ui.W) return;
    if (ui.stack.blocking()) return;
    const c = R.cam, sp = (20 + c.dist * 0.75) * dt, k = ui.keys;
    let fx = 0, fz = 0;
    if (k['arrowup']) fz += 1; if (k['arrowdown']) fz -= 1; if (k['arrowright']) fx += 1; if (k['arrowleft']) fx -= 1;
    if (ui.g.settings.edgeScroll && ui.mouse.in && !ui.drag && !ui.mouse.down) { const m = 6, w = R.w, hh = R.h; if (ui.mouse.x < m) fx -= 1; if (ui.mouse.x > w - m) fx += 1; if (ui.mouse.y < m) fz += 1; if (ui.mouse.y > hh - m) fz -= 1; }
    if (fx || fz) { const f = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) }, r = { x: -Math.sin(c.yaw), z: Math.cos(c.yaw) }; c.tx += (f.x * fz + r.x * fx) * sp; c.tz += (f.z * fz + r.z * fx) * sp; }
  };

  UP.onEvents = function (events) {
    const W = this.W, pid = this.pid, pl = W.players[pid], t = this.myTeam;
    const mySee = (x, z) => pl.vis[Math.floor(z) * W.w + Math.floor(x)] === 1;
    for (const ev of events) {
      if (ev.t === 'hit') { const e = W.byId.get(ev.id); if (e && e.owner === pid && this.throttle('att', 8)) { this.lastAlert = { x: e.x, z: e.z }; this.notify('Under attack!', 'bad'); N.Audio.uiSound('alert'); } else if (e && e.team === t && e.owner !== pid && this.throttle('ally' + e.owner, 12)) { this.lastAlert = { x: e.x, z: e.z }; this.notify(N.PLAYER_COLOR_NAMES[e.owner] + ' (ally) is under attack', 'warn'); } }
      else if (ev.t === 'ready' && ev.owner === pid) { N.Audio.uiSound('ready'); if (this.throttle('rd' + ev.role, 3)) this.notify(N.unitDef(pl.faction, ev.role).name + ' ready', 'good'); }
      else if (ev.t === 'built' && ev.owner === pid) { N.Audio.uiSound('ready'); this.notify(N.buildingDef(pl.faction, ev.role).name + ' complete', 'good'); this.sig = ''; }
      else if (ev.t === 'researched' && ev.owner === pid) { N.Audio.uiSound('research'); this.notify('Research complete: ' + F[pl.faction].upgrades[ev.key.slice(3)].name, 'good'); this.sig = ''; }
      else if (ev.t === 'norepair' && ev.owner === pid) this.notify('Repair stopped: not enough Aether', 'bad');
      else if (ev.t === 'depleted') { if (pl.expl[Math.floor(ev.z) * W.w + Math.floor(ev.x)] && this.throttle('dep', 10)) this.notify('An Aether deposit ran dry. Expand to a fresh one.', 'warn'); }
      else if (ev.t === 'site') {
        const D = N.SITES[ev.k]; N.Audio.uiSound(ev.owner === t ? 'ready' : 'alert');
        if (ev.owner === t) this.notify(D.name + ' captured by your team. Its benefit is now yours.', 'good');
        else if (ev.owner >= 0) this.notify(D.name + ' captured by the enemy team!', 'bad');
        else this.notify(D.name + ' is now neutral', 'warn');
        this.sig = ''; this.selSig = '';
      } else if (ev.t === 'eliminated') { const nm = N.PLAYER_COLOR_NAMES[ev.owner]; this.notify(ev.owner === pid ? 'You have been eliminated' : nm + (W.players[ev.owner].team === t ? ' (ally)' : ' (enemy)') + ' has been eliminated', ev.owner === pid || W.players[ev.owner].team === t ? 'bad' : 'good'); N.Audio.uiSound('alert'); this.teamSig = ''; }
      else if (ev.t === 'power' && N.isEnemy(W, pid, ev.owner) && ev.delay > 0 && mySee(ev.x, ev.z)) { this.lastAlert = { x: ev.x, z: ev.z }; this.notify('Enemy ' + F[ev.fid].power.name + ' incoming: move out of the ring (' + ev.delay + 's)', 'bad'); N.Audio.uiSound('alert'); }
      else if (ev.t === 'ability' && N.isEnemy(W, pid, ev.owner) && mySee(ev.x, ev.z) && this.throttle('abwarn', 3)) { this.lastAlert = { x: ev.x, z: ev.z }; this.notify('Enemy ' + F[ev.fid].ability.name + ' incoming!', 'bad'); }
      else if (ev.t === 'transit' && ev.owner !== pid && W.players[ev.owner].team === t) this.notify(N.PLAYER_COLOR_NAMES[ev.owner] + ' is jumping ' + ev.n + ' units through a Transit Nexus', 'good');
      else if (ev.t === 'transitDone' && N.isEnemy(W, pid, ev.owner) && mySee(ev.x, ev.z)) { this.lastAlert = { x: ev.x, z: ev.z }; this.notify('Enemy units arrived through a Transit Nexus!', 'bad'); }
    }
  };

  UP.drawOverlay = function () {
    const ui = this, g = ui.octx, R = ui.R, W = ui.W; if (!W) return;
    const cv = ui.el.ov; if (cv.width !== R.w || cv.height !== R.h) { cv.width = R.w; cv.height = R.h; }
    g.clearRect(0, 0, cv.width, cv.height);
    const k = ui.rem / 13, always = ui.g.settings.bars === 'always', selSet = new Set(ui.sel), t = ui.myTeam;
    const p = {};
    for (const e of W.ents) {
      if (!e.alive || e.kind === 'deposit') continue;
      const v = R.views.get(e.id); if (!v || !v.obj.visible) continue;
      const dmg = e.hp < e.hpMax * 0.995, shd = e.shield > 0 && e.def.shield;
      if (!(selSet.has(e.id) || dmg || always || ui.hover === e.id || (e.kind === 'building' && !e.built))) continue;
      const top = e.kind === 'building' ? e.size * 0.5 + 1.6 : (e.air ? 0.6 : 0) + e.radius * 1.6 + 0.7;
      R.project(v.obj.position.x, v.obj.position.y + top, v.obj.position.z, p); if (p.behind) continue;
      const w = (e.kind === 'building' ? 46 + e.size * 6 : 26 + e.radius * 14) * Math.max(1, k * 0.9), x = p.x - w / 2, y = p.y, bh = Math.max(3, 3 * k);
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 1, y - 1, w + 2, (shd ? bh * 2.3 : bh + 2) + 1);
      const f = Math.max(0, Math.min(1, e.hp / e.hpMax)); g.fillStyle = e.owner === ui.pid ? (f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#f87171') : e.team === t ? '#5eead4' : '#f87171'; g.fillRect(x, y, w * f, bh);
      if (shd) { g.fillStyle = '#7dd3fc'; g.fillRect(x, y + bh + 1, w * Math.max(0, Math.min(1, e.shield / N.shieldMax(W, e))), Math.max(2, 2 * k)); }
      if (e.kind === 'building' && !e.built) { g.fillStyle = '#93c5fd'; g.fillRect(x, y + bh + 1, w * e.progress, Math.max(2, 2 * k)); }
      if (e.kind === 'building' && e.built && e.queue.length && e.owner === ui.pid) { g.fillStyle = '#fde68a'; g.fillRect(x, y + bh + 2, w * Math.min(1, e.queue[0].progress), Math.max(2, 2 * k)); }
      if (e.stasisT > W.time) { g.fillStyle = '#39e6d6'; g.font = 'bold ' + Math.round(11 * k) + 'px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText('FROZEN', p.x, y - 4); }
      if (e.owner !== ui.pid && (selSet.has(e.id) || ui.hover === e.id) && e.owner >= 0) { g.font = Math.round(11 * k) + 'px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillStyle = e.team === t ? '#9ff0d0' : '#ffb4a8'; g.fillText((e.team === t ? 'ALLY ' : 'ENEMY ') + N.PLAYER_COLOR_NAMES[e.owner], p.x, y - (e.stasisT > W.time ? 16 : 4)); }
    }
    // capture-point + strategic-site labels
    const fnt = 'bold ' + Math.round(12 * k) + 'px Segoe UI, sans-serif', me = W.players[ui.pid];
    // Labels are collected, then clipped to the free battlefield (never under the top bar / sub-bar / dock or off-screen) and de-overlapped by priority
    // (contested > enemy or being captured > neutral > held > capture points). Team colour, site type and CONTESTED are always kept on whatever is drawn.
    const dom = (id) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect() : null; }, sc = R.h / window.innerHeight, topR = dom('top'), subR = dom('subbar'), botR = dom('bottom');
    const safeY0 = Math.max(topR ? topR.bottom : 0, subR && subR.height ? subR.bottom : 0) * sc + 8, safeY1 = (botR ? botR.top : window.innerHeight) * sc - 6, labels = [];
    W.objs.forEach((o) => { R.project(o.x, R.groundY(o.x, o.z) + 4.3, o.z, p); if (p.behind) return; labels.push({ txt: o.owner === t ? 'POINT HELD' : o.owner >= 0 ? 'POINT: ENEMY' : Math.abs(o.prog) > 0.02 ? 'CAPTURING ' + Math.floor(Math.abs(o.prog) * 100) + '%' : 'CAPTURE POINT', x: p.x, y: p.y, c: o.owner < 0 ? '#fff' : hex(N.TEAM_COLORS[o.owner]), prio: 0 }); });
    W.sites.forEach((s) => {
      if (!me.expl[Math.floor(s.z) * W.w + Math.floor(s.x)]) return;
      R.project(s.x, R.groundY(s.x, s.z) + 6.2, s.z, p); if (p.behind) return;
      const c = s.owner < 0 ? '#ffffff' : hex(N.TEAM_COLORS[s.owner]), st = s.owner === t ? 'HELD' : s.owner >= 0 ? 'ENEMY' : Math.abs(s.prog) > 0.02 ? Math.floor(Math.abs(s.prog) * 100) + '%' : 'NEUTRAL';
      labels.push({ txt: s.def.name + ' · ' + st + (s.contested ? ' · CONTESTED' : ''), x: p.x, y: p.y, c, prio: s.contested ? 5 : s.owner >= 0 && s.owner !== t ? 4 : Math.abs(s.prog) > 0.02 ? 3 : s.owner < 0 ? 2 : 1, sub: s.k === 'nexus' && s.cdUntil > W.time && s.owner === t ? 'recharging ' + Math.ceil(s.cdUntil - W.time) + 's' : null });
    });
    labels.sort((a, b) => b.prio - a.prio); const placed = [];
    labels.forEach((l) => {
      g.font = fnt; const w = g.measureText(l.txt).width, hh = 15 * k, x0 = l.x - w / 2 - 4, x1 = l.x + w / 2 + 4, y0 = l.y - hh, y1 = l.y + (l.sub ? hh + 2 : 0) + 4;
      if (x0 < 4 || x1 > R.w - 4 || y0 < safeY0 || y1 > safeY1 || placed.some((q) => x0 < q[2] && x1 > q[0] && y0 < q[3] && y1 > q[1])) return; placed.push([x0, y0, x1, y1]);
      g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(l.txt, l.x, l.y); g.fillStyle = l.c; g.fillText(l.txt, l.x, l.y);
      if (l.sub) { g.fillStyle = '#d18cff'; g.fillText(l.sub, l.x, l.y + 14 * k); }
    });
    if (ui.drag && ui.drag.on) { g.strokeStyle = 'rgba(120,255,160,0.95)'; g.fillStyle = 'rgba(120,255,160,0.12)'; g.lineWidth = 1; const x = Math.min(ui.drag.x0, ui.drag.x1), y = Math.min(ui.drag.y0, ui.drag.y1), w = Math.abs(ui.drag.x1 - ui.drag.x0), hh = Math.abs(ui.drag.y1 - ui.drag.y0); g.fillRect(x, y, w, hh); g.strokeRect(x + 0.5, y + 0.5, w, hh); }
    const pv = R.preview;
    if (ui.mode && ui.mode.t === 'build' && pv) { const d = N.buildingDef(W.players[ui.pid].faction, pv.role); g.font = Math.round(13 * k) + 'px Segoe UI, sans-serif'; g.textAlign = 'left'; g.fillStyle = pv.ok ? '#8cffb0' : '#ff8080'; const tx = ui.mouse.x + 18, ty = ui.mouse.y + 6; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(d.name + ' · ' + d.cost + ' Aether', tx, ty); if (pv.reason) g.fillText(reasonText(pv.reason), tx, ty + 16 * k); g.shadowBlur = 0; }
    if (ui.mode && (ui.mode.t === 'ability' || ui.mode.t === 'power')) {
      const gp = R.groundPoint(ui.mouse.x, ui.mouse.y);
      if (gp) {
        const rad = ui.mode.radius, a = R.project(gp.x, R.groundY(gp.x, gp.z), gp.z, p), b2 = R.project(gp.x + rad, R.groundY(gp.x, gp.z), gp.z, {}); const rr = Math.abs(b2.x - a.x);
        let why = null; if (ui.mode.t === 'power' && N.powerCheck) why = N.powerCheck(W, ui.pid, gp.x, gp.z);
        g.strokeStyle = why ? '#ff6b5e' : ui.mode.t === 'power' ? '#7dffa0' : '#ffd070'; g.fillStyle = why ? 'rgba(255,90,80,0.12)' : 'rgba(120,255,160,0.12)'; g.lineWidth = 3; g.beginPath(); g.ellipse(a.x, a.y, rr, rr * 0.55, 0, 0, 7); g.fill(); g.stroke();
        g.font = Math.round(13 * k) + 'px Segoe UI, sans-serif'; g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillStyle = why ? '#ffb4a8' : '#d8ffe4'; g.fillText(why ? reasonText(why) : ui.mode.name + ' · radius ' + rad, a.x, a.y - rr * 0.55 - 8); g.shadowBlur = 0;
      }
    }
    const he = ui.hoverEnt;
    if (he && !ui.mode && ui.relation(he) === 'enemy' && ui.sel.length) { const sel = ui.selEnts(); const can = he.kind !== 'deposit' && sel.some((u) => u.kind === 'unit' && N.canAttack(u, he)); if (!can && sel.some((u) => u.kind === 'unit')) { g.font = Math.round(12 * k) + 'px Segoe UI, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#ffb4a8'; g.shadowColor = '#000'; g.shadowBlur = 3; g.fillText('Selection cannot target this' + (he.air ? ' (air needs AA weapons)' : ''), ui.mouse.x + 14, ui.mouse.y + 20); g.shadowBlur = 0; } }
  };

  /* ------------------------------------------------------------ overlays */
  UP.open = function (id) { if (this.stack.has(id)) return; this.stack.push(id); this.renderOverlays(); N.Audio.uiSound('click'); this.g.onOverlayChange(); };
  UP.close = function (id) { this.stack.pop(id); this.renderOverlays(); this.g.onOverlayChange(); N.Audio.uiSound('click'); };
  UP.openPause = function () { if (this.W && !this.stack.blocking() && !this.W.over) this.open('pause'); };
  UP.renderOverlays = function () {
    const root = this.el.overlays; const want = this.stack.items;
    Array.from(root.children).forEach((c) => { if (want.indexOf(c.dataset.id) < 0) root.removeChild(c); });
    want.forEach((id, i) => {
      let el = root.querySelector('[data-id="' + id + '"]');
      if (!el) { el = h('div', { class: 'overlay', 'data-id': id }); el.appendChild(this.buildOverlay(id)); root.appendChild(el); }
      el.style.zIndex = 10 + i; el.classList.toggle('under', i < want.length - 1);
    });
    this.el.hud.classList.toggle('blocked', want.length > 0);
  };
  UP.panel = function (title, cls, body, foot) { return h('div', { class: 'panel ' + (cls || '') }, h('h2', null, title), h('div', { class: 'pbody' }, body), foot ? h('div', { class: 'pfoot' }, foot) : null); };
  UP.btn = function (label, fn, cls) { return h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: (e) => { this.g.gesture(); N.Audio.uiSound('click'); fn(e); } }, label); };
  UP.buildOverlay = function (id) {
    const ui = this, g = ui.g;
    switch (id) {
      case 'setup': return ui.buildSetup();
      case 'pause': return ui.panel('Paused', 'small', [h('p', null, 'The simulation is frozen while this menu is open.')], [
        ui.btn('Resume', () => ui.close('pause'), 'primary'), ui.btn('Settings', () => ui.open('settings')), ui.btn('Help & controls', () => ui.open('help')), ui.btn('Tutorial', () => ui.open('tutorial')),
        ui.btn('Restart match', () => { ui.stack.clear(); ui.renderOverlays(); g.rematch(); }), ui.btn('Surrender', () => ui.open('confirm')), ui.btn('Quit to setup', () => { g.toSetup(); })]);
      case 'confirm': return ui.panel('Surrender?', 'small', [h('p', null, ui.W && ui.W.teams[ui.myTeam].members.length > 1 ? 'Your commander leaves the battle. Your allies keep fighting and the team is only defeated when every teammate has fallen.' : 'Surrendering ends the match as a defeat.')], [ui.btn('Surrender', () => { ui.stack.pop('confirm'); ui.stack.pop('pause'); Cmd.surrender(ui.W, ui.pid); ui.renderOverlays(); g.onOverlayChange(); }, 'danger'), ui.btn('Keep fighting', () => ui.close('confirm'), 'primary')]);
      case 'settings': return ui.buildSettings();
      case 'help': return ui.buildHelp();
      case 'tutorial': return ui.buildTutorial();
      case 'results': return ui.buildResults();
      default: return h('div');
    }
  };

  UP.buildSetup = function () {
    const ui = this, s = ui.setup, root = h('div', { class: 'setup' }), big = s.format === '3v3';
    root.appendChild(h('div', { class: 'title' }, h('h1', null, 'TIN SOLDIERS: NOVA'), h('p', null, 'Full Team Battles · offline sci-fi RTS · you + two allied AIs vs three AIs, or a classic 1v1')));
    const fmt = h('div', { class: 'fmt' });
    [['1v1', '1v1 Skirmish', 'You vs one computer commander on a compact board.'], ['3v3', '3v3 Team Battle', 'You and two allied computer commanders vs three computer commanders on a large or very large map with strategic sites.']].forEach((f) => { const b = h('button', { class: s.format === f[0] ? 'on' : '', type: 'button' }, f[1]); b.addEventListener('click', () => { s.format = f[0]; ui.g.makePreview(ui.g.activeMap(s)); ui.refreshSetup(); N.Audio.uiSound('click'); }); ui.tipify(b, '<div class="note">' + esc(f[2]) + '</div>'); fmt.appendChild(b); });
    root.appendChild(fmt);
    const cols = h('div', { class: 'cols' });
    const left = h('div', { class: 'col' }, h('h3', null, 'Teams (click a seat to change its faction)'));
    const cycle = (list, i) => { list[i] = N.FACTION_IDS[(N.FACTION_IDS.indexOf(list[i]) + 1) % 3]; };
    const seat = (who, fid, colorIdx, onClick) => { const f = F[fid]; const b = h('button', { type: 'button', style: '--c:' + f.color + ';--a:' + f.accent }, h('b', null, f.name), h('small', null, f.tagline)); b.addEventListener('click', () => { onClick(); ui.refreshSetup(); N.Audio.uiSound('click'); }); ui.tipify(b, `<h4>${esc(f.name)}</h4><div class="note">${esc(f.strengths)}</div><div class="st">${esc(f.traits.join(' · '))}</div><div class="note"><b>${esc(f.power.name)}</b>: ${esc(f.power.desc)}</div>`); return h('div', { class: 'seat' }, h('i', { style: 'background:' + hex(N.PLAYER_COLORS[colorIdx]) }), h('span', { class: 'who' }, who), b); };
    const A = h('div', { class: 'team a' }, h('h4', null, big ? 'BLUE TEAM' : 'YOU'));
    const B = h('div', { class: 'team b' }, h('h4', null, big ? 'RED TEAM' : 'OPPONENT'));
    A.appendChild(seat('You (human)', s.faction, 0, () => { s.faction = N.FACTION_IDS[(N.FACTION_IDS.indexOf(s.faction) + 1) % 3]; }));
    if (big) {
      s.allies.forEach((f, i) => A.appendChild(seat('Ally AI ' + (i + 1) + ' · ' + N.DIFFICULTY[s.allyDifficulty].label, f, 1 + i, () => cycle(s.allies, i))));
      s.enemies.forEach((f, i) => B.appendChild(seat('Enemy AI ' + (i + 1) + ' · ' + N.DIFFICULTY[s.difficulty].label, f, 3 + i, () => cycle(s.enemies, i))));
    } else B.appendChild(seat('Computer · ' + N.DIFFICULTY[s.difficulty].label, s.opponent, 3, () => { s.opponent = N.FACTION_IDS[(N.FACTION_IDS.indexOf(s.opponent) + 1) % 3]; }));
    left.appendChild(h('div', { class: 'roster' }, A, B));
    left.appendChild(h('p', { class: 'fine' }, big ? 'Six independent commanders: each has its own base, Aether, supply, queues and research. Teammates share vision and can never hurt each other; you only ever command your own units. A commander who falls is out, but the team fights on until every member is gone.' : 'Classic duel. Your opponent uses the same rules and economy as you.'));
    cols.appendChild(left);
    const mapCol = h('div', { class: 'col' }, h('h3', null, 'Battlefield'));
    (big ? N.MAP_IDS_3V3 : N.MAP_IDS).forEach((mid) => { const m = N.MAPS[mid]; const key = big ? 'map3' : 'map'; const cv = h('canvas', { width: 96, height: 96 }); ui.drawMapPreview(cv, mid); const c = h('button', { class: 'card map' + (s[key] === mid ? ' on' : ''), type: 'button' }, cv, h('div', null, h('b', null, m.name, h('span', { class: 'sz' }, N.SIZE_LABEL[m.size] + ' · ' + m.w + 'x' + m.h)), h('span', null, m.blurb))); c.addEventListener('click', () => { s[key] = mid; ui.g.makePreview(mid); ui.refreshSetup(); N.Audio.uiSound('click'); }); mapCol.appendChild(c); });
    cols.appendChild(mapCol);
    root.appendChild(cols);
    const opts = h('div', { class: 'opts' });
    const chips = (label, cur, list, set) => { const seg = h('div', { class: 'seg' }, h('label', null, label)); list.forEach((d) => { const b = h('button', { class: 'chip' + (cur === d[0] ? ' on' : ''), type: 'button' }, d[1]); b.addEventListener('click', () => { set(d[0]); ui.refreshSetup(); N.Audio.uiSound('click'); }); if (d[2]) ui.tipify(b, d[2]); seg.appendChild(b); }); return seg; };
    const dl = Object.keys(N.DIFFICULTY).map((d) => [d, N.DIFFICULTY[d].label, '<h4>' + N.DIFFICULTY[d].label + '</h4><div class="note">' + esc(N.DIFFICULTY[d].note) + '</div>']);
    opts.appendChild(chips(big ? 'Enemy AI' : 'Difficulty', s.difficulty, dl, (v) => { s.difficulty = v; }));
    if (big) opts.appendChild(chips('Ally AI', s.allyDifficulty, dl, (v) => { s.allyDifficulty = v; }));
    opts.appendChild(chips('Victory', s.mode, [['elim', 'Base elimination', '<div class="note">Destroy every structure of the enemy team. Capture points still pay Aether.</div>'], ['objective', 'Elimination + capture points', '<div class="note">Also wins if your team reaches ' + N.OBJ_TARGET + ' score by holding capture points (1 point/s per point held).</div>']], (v) => { s.mode = v; }));
    opts.appendChild(h('div', { class: 'seg' }, h('label', null, 'Seed'), h('input', { id: 'seedIn', type: 'text', placeholder: 'random', value: ui.g.seedParam != null ? String(ui.g.seedParam) : '' })));
    root.appendChild(opts);
    root.appendChild(h('p', { class: 'fine' }, 'Match ends by team elimination, the ' + Math.floor(N.MATCH_LIMIT / 60) + ':00 time limit (higher team standing wins; exact tie = draw), or capture score. Computer commanders use the same rules; Hard gets a disclosed +25% Aether per delivery, Easy -20%. Interface size is in Settings.'));
    root.appendChild(h('div', { class: 'go' }, ui.btn('START MATCH', () => { const v = $('#seedIn').value.trim(); ui.g.start(Object.assign({}, s), v === '' ? null : v); }, 'primary big'), ui.btn('Tutorial', () => ui.open('tutorial')), ui.btn('Controls & help', () => ui.open('help')), ui.btn('Settings', () => ui.open('settings'))));
    ui.setupRoot = root; return h('div', { class: 'panel wide' }, root);
  };
  UP.refreshSetup = function () { const el = this.el.overlays.querySelector('[data-id="setup"]'); if (el) { const top = el.firstChild ? el.firstChild.scrollTop : 0; el.innerHTML = ''; el.appendChild(this.buildSetup()); el.firstChild.scrollTop = top; } };
  UP.drawMapPreview = function (cv, mid) {
    const m = (this._maps = this._maps || {})[mid] || (this._maps[mid] = N.buildMap(mid)), g = cv.getContext('2d'), th = m.theme;
    const c = (n, k) => `rgb(${Math.min(255, ((n >> 16) & 255) * k) | 0},${Math.min(255, ((n >> 8) & 255) * k) | 0},${Math.min(255, (n & 255) * k) | 0})`;
    const sx = cv.width / m.w, sz = cv.height / m.h;
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) { const k = j * m.w + i; g.fillStyle = m.terrain[k] ? c(th.ground[1], 2.7) : m.slow[k] < 1 ? c(th.ground[2], 1.1) : c(th.ground[0], 1.5); g.fillRect(i * sx, j * sz, sx + 0.6, sz + 0.6); }
    m.starts.forEach((s, i) => { g.fillStyle = hex(N.PLAYER_COLORS[m.players > 2 ? i : i * 3]); g.fillRect(s.x * sx - 3, s.z * sz - 3, 7, 7); });
    m.objectives.forEach((o) => { g.strokeStyle = '#fff'; g.beginPath(); g.arc(o.x * sx, o.z * sz, 3, 0, 7); g.stroke(); });
    m.sites.forEach((s) => { g.fillStyle = hex(N.SITES[s.k].tint); g.fillRect(s.x * sx - 3, s.z * sz - 3, 6, 6); g.strokeStyle = '#000'; g.strokeRect(s.x * sx - 3, s.z * sz - 3, 6, 6); });
    m.deposits.forEach((d) => { g.fillStyle = '#4fe0ff'; g.fillRect(d.x * sx - 1, d.z * sz - 1, 2, 2); });
  };

  UP.buildSettings = function () {
    const ui = this, s = ui.g.settings, save = () => { ui.g.applySettings(); };
    const row = (label, el) => h('div', { class: 'srow' }, h('label', null, label), el);
    const slider = (key) => { const i = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] }); i.addEventListener('input', () => { s[key] = +i.value; save(); }); return i; };
    const sel = (key, opts) => { const e = h('select', null, opts.map((o) => h('option', { value: o[0], selected: String(s[key]) === o[0] }, o[1]))); e.addEventListener('change', () => { s[key] = e.value; save(); }); return e; };
    const chk = (key, label) => { const i = h('input', { type: 'checkbox', checked: !!s[key] }); i.addEventListener('change', () => { s[key] = i.checked; save(); }); return h('label', { class: 'chk' }, i, ' ' + label); };
    return ui.panel('Settings', 'small', [
      row('Interface size', sel('uiScale', Object.keys(N.UI_SCALES).map((k) => [k, N.UI_SCALES[k].label]))), h('p', { class: 'fine' }, 'Scales every button, label, panel and the minimap. Applies instantly and is remembered. On small windows the size is capped automatically so every control always fits and stays reachable.'),
      row('Master volume', slider('volMaster')), row('Effects volume', slider('volSfx')), row('Ambient volume', slider('volAmbient')), row('Interface volume', slider('volUi')), row('', chk('mute', 'Mute all audio')),
      row('Graphics quality', sel('quality', [['low', 'Low (fast)'], ['medium', 'Medium'], ['high', 'High (shadows)']])), row('Health bars', sel('bars', [['auto', 'Selected / damaged'], ['always', 'Always show']])),
      row('Game speed', sel('speed', [['1', 'Normal 1x'], ['2', 'Fast 2x'], ['4', 'Very fast 4x']])), row('', chk('edgeScroll', 'Scroll camera at screen edges')),
      h('p', { class: 'fine' }, 'Settings are saved in this browser (localStorage, namespace ' + N.SAVE_NS + '). Match progress is not saved: closing or refreshing ends the current match.')],
    [ui.btn('Reset to defaults', () => { Object.assign(ui.g.settings, N.defaultSettings(), { lastSetup: ui.g.settings.lastSetup }); ui.g.applySettings(); const el = ui.el.overlays.querySelector('[data-id="settings"]'); el.innerHTML = ''; el.appendChild(ui.buildSettings()); }), ui.btn('Done', () => ui.close('settings'), 'primary')]);
  };
  UP.buildHelp = function () {
    const ui = this, rows = (a) => a.map((r) => h('tr', null, h('td', null, h('b', null, r[0])), h('td', null, r[1])));
    const facs = N.FACTION_IDS.map((fid) => h('div', { class: 'fh' }, h('b', { style: 'color:' + F[fid].color }, F[fid].name), ' - ' + F[fid].lore + ' ', h('em', null, F[fid].strengths), h('div', null, h('b', null, F[fid].ability.name + ' (F): '), F[fid].ability.desc), h('div', null, h('b', null, F[fid].power.name + ' (G): '), F[fid].power.desc)));
    const sites = N.SITE_KINDS.map((k) => h('div', { class: 'fh' }, h('b', null, N.SITES[k].name + ': '), N.SITES[k].desc));
    return ui.panel('Help & controls', 'wide', [
      h('div', { class: 'helpgrid' },
        h('div', null, h('h4', null, 'Controls'), h('table', null, rows([['Left-click / drag box', 'Select units (Shift adds, double-click selects same type on screen); click a site marker for its card'], ['Right-click', 'Context: move / attack / mine / repair / resume building / set rally'], ['A then click', 'Attack-move'], ['M / S / H', 'Move / Stop / Hold position'], ['B, then hotkey', 'Worker build menu; click to place (Shift keeps placing)'], ['Q W E R T', 'Production hotkeys on the selected structure'], ['Y', 'Set rally point'], ['F', 'Faction ability (needs Research building)'], ['G', 'Faction signature power (needs Research building)'], ['T / U / I', 'Transit Nexus jump for selected units near a held Nexus'], ['Ctrl+1..9 / 1..9', 'Set / recall control group (double-tap centers)'], ['Arrows / edge / minimap', 'Pan camera; wheel or +/- zoom; [ ] or middle-drag rotate'], ['Home / Space / .', 'Base / last alert / next idle worker'], ['Esc / P', 'Cancel mode or pause'], ['F1', 'This help']]))),
        h('div', null, h('h4', null, 'Teams'), h('p', null, 'In 3v3 you command only your own base and units. Allied AI commanders run their own economy and army. Teammates share vision and exploration, never damage each other (splash, lances and powers included), and benefit from each other\'s healing, Aegis, Bloom and Frenzy. If a commander loses every structure it is out; the team loses only when all three are out. If you fall you keep watching through your allies.'),
          h('h4', null, 'Economy loop'), h('p', null, 'Workers mine finite Aether deposits (3 at a time per deposit) and carry it to a drop-off. Spend Aether on structures and units. Supply is capped by HQs and supply structures. Capture points pay +1.5 Aether/s per point, split among the holding team.'),
          h('h4', null, 'Combat rules'), h('p', null, 'Damage = weapon damage minus (target armor - weapon penetration), never below 15%. Bullets, spines, claws, cannons and acid can NEVER hit flying units: only dedicated AA weapons and a few flyer weapons can. Infantry beside rocks/ruins get cover; flank shots deal +20%. Ash pits and rivers slow non-hover units.'))),
      h('h4', null, 'Strategic sites (unique benefits for the holding team)'), sites,
      h('h4', null, 'Factions, abilities and signature powers'), facs,
      h('h4', null, 'Winning'), h('p', null, 'Destroy all enemy structures (every enemy commander). Optional capture mode also wins at ' + N.OBJ_TARGET + ' team score. At ' + Math.floor(N.MATCH_LIMIT / 60) + ':00 the higher team standing wins; equal = draw.')],
    [ui.btn('Tutorial', () => ui.open('tutorial')), ui.btn('Close', () => ui.close('help'), 'primary')]);
  };
  const TUT = [
    ['Welcome, commander', 'Lead a faction in a 1v1, or fight a 3v3 with two allied computer commanders against three enemies. Destroy every enemy structure to win. Your units fire automatically; you decide where they go, what they build and when they fight.'],
    ['Camera and selection', 'Pan with the arrow keys, the screen edges or the minimap; zoom with the wheel; rotate with [ ] or the middle mouse button. Left-click a unit or drag a box to select. Right-click to give context orders. Change the interface size in Settings.'],
    ['Economy first', 'Select your workers and right-click a glowing Aether deposit to mine. Workers carry Aether to your HQ or a drop-off. Deposits are finite: expand with a new drop-off. Train more workers from the HQ (Q).'],
    ['Build your base', 'With a worker selected press B, choose a structure, and left-click a green footprint. You need supply structures to grow, a barracks-type building for troops, a factory for mechs, an airfield for flyers and a research building for upgrades, your faction ability (F) and your signature power (G).'],
    ['Teams and allies', 'Allies share vision with you and never take friendly fire. Watch the team bar at the top: each chip is a commander (click to jump to its base). Allied AIs manage themselves and will come to help when a base is raided.'],
    ['Strategic sites', 'Marked sites give the team that holds them something unique: a Recon Array (real shared vision), a Repair Foundry (free healing) or a Transit Nexus (paid jumps between held Nexuses). Park real army units on a site to capture it; workers and flyers cannot. Hover a site for its exact benefit.'],
    ['Counters matter', 'Bullets and claws cannot hit flyers. Build Anti-Air or lose to air. Heavy armor shrugs off rifles: use Anti-Armor. Powers are telegraphed: a ring shows exactly where an attack lands, so you can move out of it.'],
    ['You are ready', 'Open Help (F1) any time. Pause with Esc. The game pauses whenever a menu is open. Good hunting!'],
  ];
  UP.buildTutorial = function () {
    const ui = this; let i = 0; const box = h('div', { class: 'tut' }); const foot = h('div', null);
    const draw = () => { box.innerHTML = ''; box.appendChild(h('h3', null, TUT[i][0])); box.appendChild(h('p', null, TUT[i][1])); box.appendChild(h('div', { class: 'dots' }, TUT.map((_, k) => h('i', { class: k === i ? 'on' : '' })))); foot.innerHTML = ''; foot.appendChild(ui.btn('Back', () => { i = Math.max(0, i - 1); draw(); })); if (i < TUT.length - 1) foot.appendChild(ui.btn('Next', () => { i++; draw(); }, 'primary')); else foot.appendChild(ui.btn('Finish', () => { ui.g.settings.tutorialSeen = true; ui.g.applySettings(); ui.close('tutorial'); }, 'primary')); foot.appendChild(ui.btn('Close', () => { ui.g.settings.tutorialSeen = true; ui.g.applySettings(); ui.close('tutorial'); })); };
    draw(); const p = ui.panel('Tutorial', 'small', [box]); p.appendChild(h('div', { class: 'pfoot' }, foot)); return p;
  };
  UP.buildResults = function () {
    const ui = this, W = ui.W, o = W.over, t = ui.myTeam, win = o.winner === t, draw = o.winner < 0, me = W.players[ui.pid];
    const why = { elimination: 'Every commander on the losing team has been eliminated.', surrender: 'The last opposing commander surrendered.', objectives: 'Capture-point score reached.', timelimit: 'Time limit: decided by team standing (' + (o.standing ? o.standing.join(' vs ') : '') + ').', mutual: 'Both teams fell at the same moment.' }[o.reason] || '';
    const rows = W.players.slice().sort((a, b) => a.team - b.team || a.id - b.id).map((p) => {
      const st = p.stats, el = W.elimLog.find((l) => l.p === p.id), state = p.alive ? (o.winner === p.team ? 'victorious' : 'alive') : (el && el.why === 'surrender' ? 'surrendered ' : 'eliminated ') + (el ? fmtTime(el.t) : '');
      const who = N.PLAYER_COLOR_NAMES[p.id] + (p.id === ui.pid ? ' (you)' : p.team === t ? ' (ally)' : '') + ' · ' + F[p.faction].short;
      return h('tr', { class: 't' + p.team + (p.alive ? '' : ' gone') }, h('td', null, who), h('td', null, state), h('td', null, String(st.unitsMade)), h('td', null, String(st.built)), h('td', null, String(st.killedValue)), h('td', null, String(st.lostValue)), h('td', null, String(Math.round(st.gathered))), h('td', null, String(st.powers)));
    });
    const tbl = h('table', { class: 'res' }, h('tr', null, ['Commander', 'Status', 'Trained', 'Built', 'Value killed', 'Value lost', 'Aether', 'Powers'].map((x) => h('th', null, x))), rows);
    const title = draw ? 'DRAW' : win ? 'VICTORY' : 'DEFEAT';
    return ui.panel(title, (W.players.length > 2 ? 'wide ' : 'small ') + (draw ? '' : win ? 'win' : 'lose'), [h('p', null, (draw ? '' : (win ? 'Your team wins. ' : 'The enemy team wins. ')) + why + ' Match length ' + fmtTime(o.time) + (me.alive ? '' : ' · you were eliminated at ' + fmtTime((W.elimLog.find((l) => l.p === ui.pid) || { t: 0 }).t)) + '.'), tbl, h('p', { class: 'fine' }, 'Seed ' + W.seed + ' · ' + N.MAPS[W.map.id].name + ' · ' + (W.mode === 'objective' ? 'capture mode' : 'elimination'))], [ui.btn('Rematch', () => { ui.stack.clear(); ui.renderOverlays(); ui.g.rematch(); }, 'primary'), ui.btn('New setup', () => ui.g.toSetup())]);
  };
  UP.showResults = function () { if (this.stack.has('results')) return; N.Audio.uiSound(this.W.over.winner === this.myTeam ? 'win' : 'lose'); this.stack.push('results'); this.renderOverlays(); this.g.onOverlayChange(); };
})();
