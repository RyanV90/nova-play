/* Tin Soldiers: Nova - settings persistence (versioned namespace, whitelist validation) and overlay stack. */
(function () {
  "use strict";
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const ENUM = {
    quality: { low: 1, medium: 1, high: 1 },
    bars: { auto: 1, always: 1 },
    speed: { 1: 1, 2: 1, 4: 1 },
    mode: { elim: 1, objective: 1 },
    format: { "1v1": 1, "3v3": 1 },
    uiScale: { compact: 1, comfortable: 1, large: 1, huge: 1 },
  };
  // Interface scale (multiplies the root font size; every HUD dimension is in rem). Comfortable is the default.
  N.UI_SCALES = {
    compact: { f: 1.0, label: "Compact" },
    comfortable: { f: 1.3, label: "Comfortable (default)" },
    large: { f: 1.6, label: "Large" },
    huge: { f: 1.95, label: "Huge" },
  };
  N.SETTINGS_KEY = N.SAVE_NS + ":settings"; // distinct namespace: never reads or overwrites the older games' saves
  N.defaultSettings = function () {
    return {
      v: 2,
      quality: "medium",
      volMaster: 0.8,
      volSfx: 0.8,
      volAmbient: 0.5,
      volUi: 0.7,
      mute: false,
      edgeScroll: true,
      bars: "auto",
      speed: "1",
      tutorialSeen: false,
      uiScale: "comfortable",
      lastSetup: {
        format: "1v1",
        map: "cinder",
        faction: "vanguard",
        opponent: "brood",
        difficulty: "normal",
        allyDifficulty: "normal",
        mode: "elim",
        allies: ["brood", "lattice"],
        enemies: ["lattice", "vanguard", "brood"],
        map3: "lanes",
      },
    };
  };
  const enumOk = (table, v) => typeof v === "string" && has(table, v);
  const num01 = (v, d) =>
    typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : d;
  const facList = (v, n, d) =>
    Array.isArray(v) && v.length === n && v.every((x) => enumOk(N.FACTIONS, x))
      ? v.slice()
      : d;

  // Returns a fully valid settings object no matter what `raw` is.
  N.sanitizeSettings = function (raw) {
    const d = N.defaultSettings();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
    const g = (k) => (has(raw, k) ? raw[k] : undefined);
    if (enumOk(ENUM.quality, g("quality"))) d.quality = g("quality");
    if (enumOk(ENUM.bars, g("bars"))) d.bars = g("bars");
    if (enumOk(ENUM.speed, g("speed"))) d.speed = g("speed");
    if (enumOk(ENUM.uiScale, g("uiScale"))) d.uiScale = g("uiScale");
    d.volMaster = num01(g("volMaster"), d.volMaster);
    d.volSfx = num01(g("volSfx"), d.volSfx);
    d.volAmbient = num01(g("volAmbient"), d.volAmbient);
    d.volUi = num01(g("volUi"), d.volUi);
    if (g("mute") === true) d.mute = true;
    if (g("edgeScroll") === false) d.edgeScroll = false;
    if (g("tutorialSeen") === true) d.tutorialSeen = true;
    const ls = g("lastSetup");
    if (ls && typeof ls === "object" && !Array.isArray(ls)) {
      const s = d.lastSetup,
        l = (k) => (has(ls, k) ? ls[k] : undefined);
      if (enumOk(ENUM.format, l("format"))) s.format = l("format");
      if (enumOk(N.MAPS, l("map")) && N.MAPS[l("map")].format === "1v1")
        s.map = l("map");
      if (enumOk(N.MAPS, l("map3")) && N.MAPS[l("map3")].format === "3v3")
        s.map3 = l("map3");
      if (enumOk(N.FACTIONS, l("faction"))) s.faction = l("faction");
      if (enumOk(N.FACTIONS, l("opponent"))) s.opponent = l("opponent");
      if (enumOk(N.DIFFICULTY, l("difficulty"))) s.difficulty = l("difficulty");
      if (enumOk(N.DIFFICULTY, l("allyDifficulty")))
        s.allyDifficulty = l("allyDifficulty");
      if (enumOk(ENUM.mode, l("mode"))) s.mode = l("mode");
      s.allies = facList(l("allies"), 2, s.allies);
      s.enemies = facList(l("enemies"), 3, s.enemies);
    }
    return d;
  };
  N.safeStorage = function () {
    try {
      const s = globalThis.localStorage;
      if (!s) return null;
      const k = "__nova_probe__";
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  };
  N.loadSettings = function (storage) {
    try {
      if (!storage) return N.defaultSettings();
      const raw = storage.getItem(N.SETTINGS_KEY);
      if (raw == null) return N.defaultSettings();
      return N.sanitizeSettings(JSON.parse(raw));
    } catch (e) {
      return N.defaultSettings();
    }
  };
  N.saveSettings = function (storage, s) {
    try {
      if (!storage) return false;
      storage.setItem(N.SETTINGS_KEY, JSON.stringify(N.sanitizeSettings(s)));
      return true;
    } catch (e) {
      return false;
    }
  };

  // Blocking overlays. The simulation runs only when nothing is on the stack.
  N.OverlayStack = function () {
    this.items = [];
  };
  N.OverlayStack.prototype = {
    push(id) {
      if (this.items.indexOf(id) < 0) this.items.push(id);
      return this;
    },
    pop(id) {
      const i = this.items.lastIndexOf(id);
      if (i >= 0) this.items.splice(i, 1);
      return this;
    },
    has(id) {
      return this.items.indexOf(id) >= 0;
    },
    top() {
      return this.items.length ? this.items[this.items.length - 1] : null;
    },
    blocking() {
      return this.items.length > 0;
    },
    clear() {
      this.items.length = 0;
    },
  };
  N.simShouldRun = function (matchActive, stack, hidden) {
    return !!matchActive && !stack.blocking() && !hidden;
  };
  // Build the player list for createWorld from a (validated) setup. Seat 0 is the human; 3v3 = human + 2 allied AIs vs 3 AIs.
  N.playersFromSetup = function (s) {
    if (s.format === "3v3") {
      const a = s.allies || ["brood", "lattice"],
        e = s.enemies || ["lattice", "vanguard", "brood"];
      return [
        { faction: s.faction, diff: null },
        { faction: a[0], diff: s.allyDifficulty },
        { faction: a[1], diff: s.allyDifficulty },
      ].concat(e.map((f) => ({ faction: f, diff: s.difficulty })));
    }
    return [
      { faction: s.faction, diff: null },
      { faction: s.opponent, diff: s.difficulty },
    ];
  };
})();
