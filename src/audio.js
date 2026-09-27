/* Tin Soldiers: Nova - synthesized layered audio (WebAudio). Starts only after a user gesture. */
const bgMusic = new Audio(
  "./assets/music/starostin-documentary-sad-sorrowful-music-479773.mp3",
);

bgMusic.loop = true;
bgMusic.volume = 0.5;

function startMusic() {
  bgMusic.play().catch((err) => {
    console.error("Could not start music:", err);
  });

  document.removeEventListener("click", startMusic);
  document.removeEventListener("keydown", startMusic);
}

document.addEventListener("click", startMusic);
document.addEventListener("keydown", startMusic);

(function () {
  "use strict";
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const A = (N.Audio = {
    ctx: null,
    errors: [],
    played: {},
    voices: 0,
    nodes: 0,
    started: false,
    ambientOn: false,
    paused: false,
    vol: { master: 0.8, sfx: 0.8, amb: 0.5, ui: 0.7, mute: false },
  });
  const err = (e) => {
    if (A.errors.length < 30)
      A.errors.push(String(e && e.message ? e.message : e));
  };

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === "suspended" && !document.hidden)
        A.ctx.resume().catch(err);
      return true;
    }
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) {
        err("no AudioContext");
        return false;
      }
      const c = (A.ctx = new AC());
      A.master = c.createGain();
      A.comp = c.createDynamicsCompressor();
      A.master.connect(A.comp);
      A.comp.connect(c.destination);
      A.sfx = c.createGain();
      A.amb = c.createGain();
      A.ui = c.createGain();
      [A.sfx, A.amb, A.ui].forEach((g) => g.connect(A.master));
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate),
        d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.noise = nb;
      A.nodes += 6;
      A.applyVolumes();
      A.started = true;
      return true;
    } catch (e) {
      err(e);
      return false;
    }
  };
  A.setVolumes = function (s) {
    A.vol.master = s.volMaster;
    A.vol.sfx = s.volSfx;
    A.vol.amb = s.volAmbient;
    A.vol.ui = s.volUi;
    A.vol.mute = !!s.mute;
    A.applyVolumes();
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    const t = A.ctx.currentTime,
      v = A.vol;
    A.master.gain.setTargetAtTime(v.mute ? 0 : v.master, t, 0.03);
    A.sfx.gain.setTargetAtTime(A.paused ? 0 : v.sfx, t, 0.05);
    A.amb.gain.setTargetAtTime(A.paused ? 0 : v.amb * 0.6, t, 0.2);
    A.ui.gain.setTargetAtTime(v.ui, t, 0.03);
  };
  A.setPaused = function (p) {
    A.paused = !!p;
    A.applyVolumes();
  };
  A.suspend = function () {
    if (A.ctx && A.ctx.state === "running") A.ctx.suspend().catch(err);
  };
  A.resume = function () {
    if (A.ctx && A.ctx.state === "suspended") A.ctx.resume().catch(err);
  };

  function voice(bus, dur) {
    if (!A.ctx || A.voices > 28) return null;
    A.voices++;
    A.nodes++;
    setTimeout(
      () => {
        A.voices = Math.max(0, A.voices - 1);
      },
      dur * 1000 + 60,
    );
    return bus;
  }
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(bus, type, f0, f1, dur, peak, delay, pan) {
    const c = A.ctx;
    if (!voice(bus, dur + (delay || 0))) return;
    try {
      const t = c.currentTime + (delay || 0),
        o = c.createOscillator(),
        g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      env(g, t, 0.005, peak, dur);
      o.connect(g);
      let out = g;
      if (pan && c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        out = p;
      }
      out.connect(bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {
      err(e);
    }
  }
  function noise(bus, dur, peak, ftype, f0, f1, delay, pan, q) {
    const c = A.ctx;
    if (!voice(bus, dur + (delay || 0))) return;
    try {
      const t = c.currentTime + (delay || 0),
        s = c.createBufferSource(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      s.buffer = A.noise;
      s.loop = true;
      f.type = ftype;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      f.Q.value = q || 0.8;
      env(g, t, 0.004, peak, dur);
      s.connect(f);
      f.connect(g);
      let out = g;
      if (pan && c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        out = p;
      }
      out.connect(bus);
      s.start(t, Math.random());
      s.stop(t + dur + 0.05);
    } catch (e) {
      err(e);
    }
  }
  const mark = (n) => {
    A.played[n] = (A.played[n] || 0) + 1;
  };
  let lastShot = 0,
    shotCount = 0;

  // pos: {g, pan} attenuation from the listener camera
  A.weapon = function (kind, big, pos) {
    if (!A.ctx || A.paused) return;
    const g = pos ? pos.g : 1;
    if (g < 0.05) return;
    const now = A.ctx.currentTime;
    if (now - lastShot > 0.1) {
      lastShot = now;
      shotCount = 0;
    }
    if (++shotCount > 6) return;
    mark("w:" + kind);
    const p = pos ? pos.pan : 0,
      b = A.sfx,
      k = 0.22 * g;
    switch (kind) {
      case "bullet":
      case "spine":
        noise(b, 0.07, k * 0.9, "highpass", 3500, 1800, 0, p);
        tone(b, "square", 900, 300, 0.05, k * 0.4, 0, p);
        break;
      case "cannon":
        noise(b, 0.2, k * 1.2, "lowpass", 1800, 200, 0, p);
        tone(b, "sine", 160, 45, 0.22, k * 1.2, 0, p);
        break;
      case "rocket":
        noise(b, 0.45, k, "bandpass", 500, 2600, 0, p, 1.2);
        tone(b, "sawtooth", 220, 90, 0.3, k * 0.4, 0, p);
        break;
      case "energy":
      case "beam":
        tone(b, "sawtooth", 1200, 320, 0.16, k * 0.6, 0, p);
        tone(b, "sine", 2200, 1400, 0.12, k * 0.3, 0.02, p);
        break;
      case "arc":
        noise(b, 0.14, k, "bandpass", 4000, 1500, 0, p, 3);
        tone(b, "square", 700, 1600, 0.08, k * 0.3, 0, p);
        break;
      case "lance":
      case "plasma":
        tone(b, "sawtooth", 300, 1200, 0.3, k * 0.6, 0, p);
        noise(b, 0.3, k * 0.6, "highpass", 800, 4000, 0, p);
        break;
      case "acid":
      case "spore":
        tone(b, "sine", 300, 900, 0.16, k * 0.9, 0, p);
        tone(b, "sine", 700, 200, 0.14, k * 0.5, 0.06, p);
        noise(b, 0.12, k * 0.4, "lowpass", 900, 300, 0, p);
        break;
      case "claw":
        noise(b, 0.09, k * 0.9, "bandpass", 2500, 5000, 0, p, 2);
        break;
      case "shell":
        tone(b, "sine", 120, 35, 0.4, k * 1.4, 0, p);
        noise(b, 0.3, k, "lowpass", 1200, 150, 0, p);
        break;
      default:
        noise(b, 0.08, k, "highpass", 2500, 1500, 0, p);
    }
  };
  A.boom = function (size, pos) {
    if (!A.ctx || A.paused) return;
    const g = pos ? pos.g : 1;
    if (g < 0.05) return;
    mark("boom");
    const k = 0.35 * g * (0.6 + size * 0.4),
      p = pos ? pos.pan : 0;
    noise(A.sfx, 0.5 + size * 0.3, k, "lowpass", 900 + size * 200, 80, 0, p);
    tone(A.sfx, "sine", 100, 28, 0.5 + size * 0.2, k * 1.3, 0, p);
  };
  A.uiSound = function (name) {
    if (!A.ctx) return;
    mark("ui:" + name);
    const b = A.ui;
    switch (name) {
      case "click":
        tone(b, "square", 880, 700, 0.05, 0.12);
        break;
      case "hover":
        tone(b, "sine", 1200, 1200, 0.02, 0.03);
        break;
      case "error":
        tone(b, "sawtooth", 160, 110, 0.18, 0.18);
        break;
      case "select":
        tone(b, "triangle", 520, 780, 0.07, 0.14);
        break;
      case "command":
        tone(b, "square", 600, 900, 0.06, 0.1);
        tone(b, "square", 900, 1200, 0.05, 0.08, 0.05);
        break;
      case "place":
        tone(b, "sine", 140, 60, 0.25, 0.3);
        noise(b, 0.2, 0.15, "lowpass", 800, 200);
        break;
      case "ready":
        tone(b, "triangle", 660, 660, 0.09, 0.16);
        tone(b, "triangle", 990, 990, 0.14, 0.16, 0.09);
        break;
      case "research":
        [523, 659, 784, 1046].forEach((f, i) =>
          tone(b, "triangle", f, f, 0.14, 0.14, i * 0.08),
        );
        break;
      case "alert":
        [0, 0.16, 0.32].forEach((d) =>
          tone(b, "sawtooth", 420, 380, 0.11, 0.16, d),
        );
        break;
      case "win":
        [392, 523, 659, 784].forEach((f, i) =>
          tone(b, "triangle", f, f, 0.3, 0.2, i * 0.15),
        );
        break;
      case "lose":
        [330, 262, 196].forEach((f, i) =>
          tone(b, "sawtooth", f, f * 0.9, 0.4, 0.16, i * 0.22),
        );
        break;
      default:
        tone(b, "sine", 500, 500, 0.05, 0.1);
    }
  };
  A.startAmbient = function (theme) {
    if (!A.ctx || A.ambientOn) return;
    A.ambientOn = true;
    const c = A.ctx;
    try {
      const base =
        theme === "prismatic" ? 73.4 : theme === "karthaga" ? 49 : 55;
      A.ambNodes = [];
      [base, base * 1.5, base * 2.01].forEach((f, i) => {
        const o = c.createOscillator(),
          g = c.createGain(),
          lfo = c.createOscillator(),
          lg = c.createGain();
        o.type = i ? "sine" : "triangle";
        o.frequency.value = f;
        g.gain.value = 0.05 / (i + 1);
        lfo.frequency.value = 0.05 + i * 0.03;
        lg.gain.value = 0.02 / (i + 1);
        lfo.connect(lg);
        lg.connect(g.gain);
        o.connect(g);
        g.connect(A.amb);
        o.start();
        lfo.start();
        A.ambNodes.push(o, lfo);
      });
      const ns = c.createBufferSource(),
        nf = c.createBiquadFilter(),
        ng = c.createGain(),
        nl = c.createOscillator(),
        nlg = c.createGain();
      ns.buffer = A.noise;
      ns.loop = true;
      nf.type = "bandpass";
      nf.frequency.value = 500;
      nf.Q.value = 0.7;
      ng.gain.value = 0.05;
      nl.frequency.value = 0.07;
      nlg.gain.value = 300;
      nl.connect(nlg);
      nlg.connect(nf.frequency);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(A.amb);
      ns.start();
      nl.start();
      A.ambNodes.push(ns, nl);
      A.nodes += 14;
      A.chirp = setInterval(() => {
        if (!A.paused && A.ctx && A.ctx.state === "running") {
          mark("amb:chirp");
          tone(
            A.amb,
            "sine",
            900 + Math.random() * 1400,
            300 + Math.random() * 500,
            0.6,
            0.03,
            0,
            Math.random() * 2 - 1,
          );
        }
      }, 5200);
      // engine bed: gain follows moving-unit count
      const eo = c.createOscillator(),
        ef = c.createBiquadFilter();
      A.eg = c.createGain();
      eo.type = "sawtooth";
      eo.frequency.value = 48;
      ef.type = "lowpass";
      ef.frequency.value = 160;
      A.eg.gain.value = 0;
      eo.connect(ef);
      ef.connect(A.eg);
      A.eg.connect(A.sfx);
      eo.start();
      A.ambNodes.push(eo);
    } catch (e) {
      err(e);
    }
  };
  A.engine = function (movers) {
    if (A.eg && A.ctx)
      A.eg.gain.setTargetAtTime(
        Math.min(0.06, movers * 0.004),
        A.ctx.currentTime,
        0.3,
      );
  };
  A.stopAmbient = function () {
    A.ambientOn = false;
    clearInterval(A.chirp);
    (A.ambNodes || []).forEach((n) => {
      try {
        n.stop();
      } catch (e) {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch (e) {
        /* ok */
      }
    });
    A.ambNodes = [];
    if (A.eg) {
      try {
        A.eg.disconnect();
      } catch (e) {
        /* ok */
      }
      A.eg = null;
    }
  };
  A.debug = function () {
    return {
      state: A.ctx ? A.ctx.state : "not-created",
      sampleRate: A.ctx ? A.ctx.sampleRate : 0,
      started: A.started,
      ambientOn: A.ambientOn,
      paused: A.paused,
      voices: A.voices,
      nodesCreated: A.nodes,
      errors: A.errors.slice(),
      played: Object.assign({}, A.played),
      volumes: Object.assign({}, A.vol),
      buses: A.ctx
        ? {
            master: A.master.gain.value,
            sfx: A.sfx.gain.value,
            amb: A.amb.gain.value,
            ui: A.ui.gain.value,
          }
        : null,
    };
  };
})();
