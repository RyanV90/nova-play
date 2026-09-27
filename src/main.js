/* Tin Soldiers: Nova - boot, single RAF loop, match lifecycle, settings application, QA/debug surface. */
(function () {
  "use strict";
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  if (typeof document === "undefined") return;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const params = new URLSearchParams(location.search);

  const G = (N.game = {
    settings: null,
    stack: new N.OverlayStack(),
    W: null,
    R: null,
    ui: null,
    pid: 0,
    setup: null,
    seed: 0,
    matchActive: false,
    loopsStarted: 0,
    frames: 0,
    matches: 0,
    errors: [],
    qaSpeed: 0,
    acc: 0,
    last: 0,
    resultsShown: false,
    seedParam: null,
    storage: null,
    preview: null,
    simTicksRun: 0,
    lastRafId: 0,
  });

  window.addEventListener("error", (e) => {
    G.errors.push(String(e.message || e));
  });
  window.addEventListener("unhandledrejection", (e) => {
    G.errors.push("rejection: " + String(e.reason));
  });

  G.speedMul = function () {
    if (G.qaSpeed > 0) return G.qaSpeed;
    return has({ 1: 1, 2: 2, 4: 4 }, G.settings.speed) ? +G.settings.speed : 1;
  };
  G.speedLabel = function () {
    const m = G.speedMul();
    return G.stack.blocking() ? "PAUSED" : m === 1 ? "" : m + "x speed";
  };
  G.gesture = function () {
    N.Audio.unlock();
    N.Audio.setVolumes(G.settings);
  };
  // The chosen scale is capped so the whole HUD always fits the window (top bar width, dock height): controls are never clipped or unreachable.
  G.effectiveScale = function () {
    const sc = N.UI_SCALES[G.settings.uiScale] || N.UI_SCALES.comfortable;
    return Math.max(
      0.85,
      Math.min(sc.f, window.innerWidth / 930, window.innerHeight / 371),
    );
  };
  G.applyScale = function () {
    const f = G.effectiveScale();
    document.documentElement.style.setProperty("--ui", f.toFixed(3));
    document.documentElement.dataset.uiScale = G.settings.uiScale;
    document.documentElement.dataset.uiEffective = f.toFixed(2);
    if (G.R) requestAnimationFrame(() => G.R.resize());
  };
  G.applySettings = function () {
    G.settings = N.sanitizeSettings(G.settings);
    N.saveSettings(G.storage, G.settings);
    if (G.R) G.R.setQuality(G.settings.quality);
    G.applyScale();
    N.Audio.setVolumes(G.settings);
  };
  G.onOverlayChange = function () {
    const paused = G.stack.blocking() && G.matchActive;
    N.Audio.setPaused(paused);
  };
  G.hash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  G.cleanSetup = function (setup) {
    const S = N.sanitizeSettings({ lastSetup: setup }).lastSetup,
      out = Object.assign({}, S);
    out.mode = setup.mode === "objective" ? "objective" : "elim";
    out.format = setup.format === "3v3" ? "3v3" : "1v1";
    return out;
  };
  G.activeMap = function (s) {
    return s.format === "3v3" ? s.map3 : s.map;
  };

  G.makePreview = function (mapId) {
    const m = N.MAPS[mapId],
      n = m.starts.length * 2;
    const F = N.FACTION_IDS,
      s = G.setup,
      list = [];
    for (let i = 0; i < n; i++)
      list.push({ faction: i === 0 ? s.faction : F[i % 3] });
    const W = N.createWorld({
      map: mapId,
      players: list,
      seed: 1,
      reveal: true,
    });
    G.preview = W;
    G.R.loadWorld(W, 0);
    G.R.cam.dist = m.size === "compact" ? 46 : 60;
    G.R.centerOn(W.w / 2, W.h / 2, true);
  };

  G.start = function (setup, seedStr, noGesture) {
    if (!noGesture) G.gesture();
    const s = G.cleanSetup(setup);
    let seed;
    if (seedStr == null || seedStr === "")
      seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    else if (/^\d+$/.test(String(seedStr))) seed = +seedStr >>> 0;
    else seed = G.hash(String(seedStr));
    G.setup = s;
    G.seed = seed;
    G.settings.lastSetup = Object.assign({}, s);
    G.applySettings();
    const players = N.playersFromSetup(s);
    const W = N.createWorld({
      map: G.activeMap(s),
      players,
      seed,
      mode: s.mode,
      wantEvents: true,
      reveal: false,
    });
    W.players.forEach((p) => {
      if (p.diff) N.AI.attach(W, p.id, p.diff);
    });
    if (G.qaAI0) N.AI.attach(W, 0, G.qaAI0);
    G.W = W;
    G.preview = null;
    G.matches++;
    G.resultsShown = false;
    G.acc = 0;
    G.R.loadWorld(W, G.pid);
    G.stack.clear();
    G.ui.bindMatch(W, G.R, G.pid);
    G.matchActive = true;
    N.Audio.stopAmbient();
    N.Audio.startAmbient(W.map.theme.name);
    N.Audio.setPaused(false);
    G.ui.renderOverlays();
    if (!G.settings.tutorialSeen && !params.has("notut")) G.ui.open("tutorial");
    G.onOverlayChange();
  };
  G.rematch = function () {
    G.start(G.setup, String((G.seed + 1) >>> 0));
  };
  G.toSetup = function () {
    G.matchActive = false;
    G.W = null;
    G.ui.W = null;
    G.ui.mode = null;
    G.stack.clear();
    G.stack.push("setup");
    N.Audio.stopAmbient();
    G.ui.el.hud.classList.add("hidden");
    G.ui.renderOverlays();
    G.makePreview(G.activeMap(G.setup));
    G.onOverlayChange();
  };

  function audioEvents(events) {
    const R = G.R,
      A = N.Audio;
    if (!A.ctx) return;
    const pos = (x, z) => {
      const d = Math.hypot(x - R.cam.tx, z - R.cam.tz),
        p = R.project(x, 0.5, z, (G._ap = G._ap || {}));
      return {
        g: Math.max(0, 1 - d / (28 + R.cam.dist)),
        pan: Math.max(-0.8, Math.min(0.8, (p.x / R.w) * 2 - 1)),
      };
    };
    let sh = 0;
    for (const ev of events) {
      if (ev.t === "shot") {
        if (++sh <= 6) A.weapon(ev.kind, ev.big, pos(ev.x, ev.z));
      } else if (ev.t === "impact")
        A.boom(Math.min(3, (ev.r || 1) * 0.6), pos(ev.x, ev.z));
      else if (ev.t === "death")
        A.boom(
          ev.kind === "building" ? 3 : ev.role === "heavy" ? 2 : 0.6,
          pos(ev.x, ev.z),
        );
    }
  }

  function frame(ts) {
    G.lastRafId = requestAnimationFrame(frame);
    const R = G.R,
      ui = G.ui;
    G.frames++;
    const dtRaw = G.last ? Math.min(0.1, (ts - G.last) / 1000) : 0.016;
    if (G.last) {
      R.stats.dts.push(ts - G.last);
      if (R.stats.dts.length > 300) R.stats.dts.shift();
      const pw = R.stats.win;
      if (pw) {
        if (pw.dts.length < 20000) pw.dts.push(ts - G.last);
        else pw.truncated = true;
      }
    }
    G.last = ts;
    const W = G.W;
    const run = N.simShouldRun(
      G.matchActive && W && !W.over,
      G.stack,
      document.hidden,
    );
    if (W && G.matchActive) {
      if (run) {
        G.acc += dtRaw * G.speedMul();
        let steps = 0;
        const maxSteps = G.qaSpeed > 4 ? 40 : 12;
        while (G.acc >= N.TICK && steps < maxSteps) {
          N.stepWorld(W);
          G.acc -= N.TICK;
          steps++;
          G.simTicksRun++;
          if (W.over) break;
        }
        if (steps === maxSteps) G.acc = 0;
        if (W.events.length) {
          const ev = W.events;
          W.events = [];
          R.consume(ev);
          ui.onEvents(ev);
          audioEvents(ev);
        }
        let mv = 0;
        for (const e of W.ents)
          if (e.alive && e.owner === G.pid && e.moving) mv++;
        N.Audio.engine(mv);
      }
      if (W.over && !G.resultsShown) {
        G.resultsShown = true;
        N.Audio.stopAmbient();
        setTimeout(() => {
          if (G.W === W) ui.showResults();
        }, 900);
      }
      ui.update(dtRaw);
      R.updateCamera(dtRaw);
      R.sync(run ? dtRaw : 0, {
        sel: ui.sel,
        hover: ui.hover,
        place: R.preview,
        site: ui.siteSel,
        hoverSite: ui.hoverSite && ui.hoverSite.id,
        power:
          ui.mode && (ui.mode.t === "power" || ui.mode.t === "ability")
            ? ui.mode
            : null,
      });
      ui.updateHud(dtRaw);
      ui.drawOverlay();
    } else if (G.preview) {
      R.cam.yaw += dtRaw * 0.04;
      R.cam.tx = G.preview.w / 2;
      R.cam.tz = G.preview.h / 2;
      R.updateCamera(dtRaw);
      R.sync(dtRaw, null);
    }
    R.render();
  }

  G.boot = function () {
    G.storage = N.safeStorage();
    G.settings = N.loadSettings(G.storage);
    const cv = document.getElementById("gl"),
      ov = document.getElementById("ov");
    G.setup = Object.assign({}, G.settings.lastSetup);
    G.applyScale();
    try {
      G.R = new N.Renderer(cv, ov);
    } catch (e) {
      document.getElementById("fatal").textContent =
        "WebGL is required: " + e.message;
      document.getElementById("fatal").classList.remove("hidden");
      G.errors.push("renderer: " + e.message);
      return;
    }
    G.R.setQuality(G.settings.quality);
    G.ui = new N.UI(G);
    window.addEventListener("resize", () => {
      G.applyScale();
      G.R.resize();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) N.Audio.suspend();
      else if (N.Audio.ctx) N.Audio.resume();
    });
    // URL parameters (validated) for reproducible QA runs
    if (params.has("seed")) G.seedParam = params.get("seed");
    if (
      params.has("speed") &&
      /^\d+$/.test(params.get("speed")) &&
      params.has("qa")
    )
      G.qaSpeed = Math.max(1, Math.min(64, +params.get("speed")));
    if (
      params.has("qaai") &&
      has(N.DIFFICULTY, params.get("qaai")) &&
      params.has("qa")
    )
      G.qaAI0 = params.get("qaai");
    if (params.has("scale") && has(N.UI_SCALES, params.get("scale"))) {
      G.settings.uiScale = params.get("scale");
      G.applySettings();
    }
    if (params.has("quality") && has(N.QUALITY, params.get("quality"))) {
      G.settings.quality = params.get("quality");
      G.applySettings();
    }
    const su = G.setup;
    if (params.get("format") === "3v3" || params.get("format") === "1v1")
      su.format = params.get("format");
    if (params.has("map") && has(N.MAPS, params.get("map"))) {
      if (N.MAPS[params.get("map")].format === "3v3") {
        su.map3 = params.get("map");
        su.format = "3v3";
      } else su.map = params.get("map");
    }
    if (params.has("faction") && has(N.FACTIONS, params.get("faction")))
      su.faction = params.get("faction");
    if (params.has("opp") && has(N.FACTIONS, params.get("opp")))
      su.opponent = params.get("opp");
    if (params.has("allies")) {
      const a = params.get("allies").split(",");
      if (a.length === 2 && a.every((f) => has(N.FACTIONS, f))) su.allies = a;
    }
    if (params.has("enemies")) {
      const a = params.get("enemies").split(",");
      if (a.length === 3 && a.every((f) => has(N.FACTIONS, f))) su.enemies = a;
    }
    if (params.has("diff") && has(N.DIFFICULTY, params.get("diff")))
      su.difficulty = params.get("diff");
    if (params.get("mode") === "objective") su.mode = "objective";
    G.ui.setup = su;
    G.stack.push("setup");
    G.ui.renderOverlays();
    G.makePreview(G.activeMap(su));
    G.loopsStarted++;
    G.lastRafId = requestAnimationFrame(frame);
    if (params.has("autostart")) G.start(su, G.seedParam, true);
  };

  // Compact state summary for the browser QA runner (read-only).
  G.debug = function () {
    const W = G.W,
      R = G.R;
    return {
      version: N.VERSION,
      matchActive: G.matchActive,
      stack: G.stack.items.slice(),
      loopsStarted: G.loopsStarted,
      frames: G.frames,
      matches: G.matches,
      errors: G.errors.slice(),
      setup: G.setup,
      seed: G.seed,
      quality: R && R.qname,
      uiScale: G.settings && G.settings.uiScale,
      uiEffective: G.effectiveScale && +G.effectiveScale().toFixed(2),
      world: W
        ? {
            tick: W.tick,
            time: W.time,
            over: W.over,
            mode: W.mode,
            map: W.map.id,
            players: W.players.map((p) => ({
              faction: p.faction,
              team: p.team,
              alive: p.alive,
              res: Math.round(p.res),
              supplyUsed: p.supplyUsed,
              supplyCap: p.supplyCap,
              units: W.ents.filter(
                (e) => e.alive && e.owner === p.id && e.kind === "unit",
              ).length,
              buildings: W.ents.filter(
                (e) => e.alive && e.owner === p.id && e.kind === "building",
              ).length,
              stats: p.stats,
              upg: Object.keys(p.upg),
            })),
            objs: W.objs.map((o) => ({
              owner: o.owner,
              prog: +o.prog.toFixed(2),
            })),
            sites: W.sites.map((s) => ({
              id: s.id,
              k: s.k,
              owner: s.owner,
              prog: +s.prog.toFixed(2),
            })),
          }
        : null,
      render: R
        ? {
            stats: R.frameStats(),
            gpu: R.gpuInfo(),
            views: R.views.size,
            viewport: [R.w, R.h],
          }
        : null,
      audio: N.Audio.debug(),
      selection: G.ui ? G.ui.sel.slice() : [],
      mode: G.ui && G.ui.mode ? G.ui.mode.t : null,
    };
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", G.boot);
  else G.boot();
})();
