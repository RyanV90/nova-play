/* Tin Soldiers: Nova - procedural art (browser only, vendored Three r128).
   Kit: beveled/tapered/curved primitives with baked ambient occlusion and box-projected UVs, generated PBR-ish texture sets, articulated rigs,
   baked single-mesh LOD, plus site / deposit / landmark models. Build languages:
   Vanguard = manufactured expeditionary armor (chamfered plates, panel seams, hazard trim, exhausts);
   Brood = organic growth (carapace, spines, sacs, tendrils, asymmetry);  Lattice = ancient crystalline energy machines (floating ceramic, gold inlay, glowing crystal). */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const T = globalThis.THREE;
  if (!T) return;
  const M = (N.Models = {});
  const PI = Math.PI;

  /* ------------------------------------------------------------ fog-aware materials */
  const FOGU = (M.FOGU = { uFogTex: { value: null }, uFogSize: { value: new T.Vector2(96, 96) }, uFogOn: { value: 1 } });
  M.fogify = function (mat) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uFogTex = FOGU.uFogTex; sh.uniforms.uFogSize = FOGU.uFogSize; sh.uniforms.uFogOn = FOGU.uFogOn;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wpp = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwpp = instanceMatrix * wpp;\n#endif\nvWP = (modelMatrix * wpp).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform sampler2D uFogTex;\nuniform vec2 uFogSize;\nuniform float uFogOn;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif(uFogOn>0.5){float fv=texture2D(uFogTex, vWP.xz/uFogSize).r; float fm = fv<0.5 ? mix(0.03,0.45,fv*2.0) : mix(0.45,1.0,(fv-0.5)*2.0); gl_FragColor.rgb *= fm;}');
    };
    mat.customProgramCacheKey = () => 'fogify';
    return mat;
  };

  /* ------------------------------------------------------------ generated texture sets (map + bump + emissive) */
  const rng = (seed) => N.mulberry32(seed);
  const cv = (s) => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
  const ctex = (c, srgb) => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; return t; };
  const speckle = (g, s, r, n, a, dark) => { n = Math.round(n * 0.3); a *= 0.7; for (let i = 0; i < n; i++) { g.fillStyle = dark ? `rgba(0,0,0,${a * r()})` : `rgba(255,255,255,${a * r()})`; g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2); } };
  M.texVanguard = function () {
    const s = 512, c = cv(s), g = c.getContext('2d'), b = cv(s), bg = b.getContext('2d'), r = rng(11);
    g.fillStyle = '#8894a0'; g.fillRect(0, 0, s, s); bg.fillStyle = '#808080'; bg.fillRect(0, 0, s, s);
    const P = 128;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 118 + r() * 46; g.fillStyle = `rgb(${v - 8},${v + 2},${v + 14})`; g.fillRect(x * P + 3, y * P + 3, P - 6, P - 6);
      const gr = g.createLinearGradient(x * P, y * P, x * P, y * P + P); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(x * P + 3, y * P + 3, P - 6, P - 6);
      g.strokeStyle = 'rgba(12,18,26,0.9)'; g.lineWidth = 3; g.strokeRect(x * P + 3, y * P + 3, P - 6, P - 6); bg.strokeStyle = '#101010'; bg.lineWidth = 4; bg.strokeRect(x * P + 3, y * P + 3, P - 6, P - 6);
      [[12, 12], [P - 12, 12], [12, P - 12], [P - 12, P - 12]].forEach((p) => { g.fillStyle = 'rgba(26,34,44,0.9)'; g.beginPath(); g.arc(x * P + p[0], y * P + p[1], 3.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x * P + p[0] - 1, y * P + p[1] - 1, 1.3, 0, 7); g.fill(); bg.fillStyle = '#f0f0f0'; bg.beginPath(); bg.arc(x * P + p[0], y * P + p[1], 3.5, 0, 7); bg.fill(); });
      const k = r();
      if (k < 0.16) { g.save(); g.beginPath(); g.rect(x * P + 10, y * P + 50, P - 20, 26); g.clip(); for (let i = -6; i < 14; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#e8a13a'; g.beginPath(); g.moveTo(x * P + 10 + i * 12, y * P + 50); g.lineTo(x * P + 22 + i * 12, y * P + 50); g.lineTo(x * P + 10 + i * 12 + 12 - 26, y * P + 76); g.lineTo(x * P - 2 + i * 12 - 26 + 12, y * P + 76); g.fill(); } g.restore(); }
      else if (k < 0.3) { g.fillStyle = 'rgba(232,161,58,0.9)'; g.font = 'bold 34px sans-serif'; g.fillText(String(10 + Math.floor(r() * 89)), x * P + 20, y * P + 70); }
      else if (k < 0.4) { g.fillStyle = 'rgba(20,28,36,0.75)'; for (let i = 0; i < 6; i++) g.fillRect(x * P + 22, y * P + 22 + i * 14, P - 44, 5); bg.fillStyle = '#303030'; for (let i = 0; i < 6; i++) bg.fillRect(x * P + 22, y * P + 22 + i * 14, P - 44, 5); }
    }
    for (let i = 0; i < 24; i++) { const x = r() * s, y = r() * s; g.strokeStyle = `rgba(${r() > 0.5 ? '230,236,244' : '10,14,20'},${0.1 + r() * 0.25})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60); g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = r() * s, gr = g.createLinearGradient(x, 0, x, 190); gr.addColorStop(0, 'rgba(30,24,18,0.28)'); gr.addColorStop(1, 'rgba(30,24,18,0)'); g.fillStyle = gr; g.fillRect(x, r() * s, 2 + r() * 5, 190); }
    speckle(g, s, r, 3500, 0.12); speckle(g, s, r, 2500, 0.16, true); speckle(bg, s, r, 3000, 0.25);
    return { map: ctex(c, true), bump: ctex(b) };
  };
  M.texBrood = function () {
    const s = 512, c = cv(s), g = c.getContext('2d'), b = cv(s), bg = b.getContext('2d'), e = cv(s), eg = e.getContext('2d'), r = rng(23);
    g.fillStyle = '#84609a'; g.fillRect(0, 0, s, s); bg.fillStyle = '#707070'; bg.fillRect(0, 0, s, s); eg.fillStyle = '#000'; eg.fillRect(0, 0, s, s);
    for (let i = 0; i < 110; i++) { const x = r() * s, y = r() * s, rad = 26 + r() * 74, gr = g.createRadialGradient(x, y, 0, x, y, rad); const h = r() < 0.55 ? '150,96,176' : r() < 0.5 ? '96,132,72' : '52,28,66'; gr.addColorStop(0, `rgba(${h},0.55)`); gr.addColorStop(1, `rgba(${h},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 12; i++) { let x = r() * s, y = r() * s; const pts = [[x, y]]; for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 50; pts.push([x, y]); }
      [[g, 'rgba(232,140,176,0.6)', 2.2], [bg, '#d8d8d8', 3], [eg, 'rgba(150,255,60,0.55)', 1.4]].forEach((L) => { L[0].strokeStyle = L[1]; L[0].lineWidth = L[2]; L[0].beginPath(); pts.forEach((p, i2) => (i2 ? L[0].lineTo(p[0], p[1]) : L[0].moveTo(p[0], p[1]))); L[0].stroke(); }); }
    for (let i = 0; i < 30; i++) { const x = r() * s, y = r() * s, rad = 5 + r() * 11; g.fillStyle = 'rgba(30,10,40,0.6)'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.fillStyle = 'rgba(214,176,224,0.4)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.5, 0, 7); g.fill(); bg.fillStyle = '#202020'; bg.beginPath(); bg.arc(x, y, rad, 0, 7); bg.fill(); if (r() < 0.3) { eg.fillStyle = 'rgba(190,255,90,0.85)'; eg.beginPath(); eg.arc(x, y, rad * 0.5, 0, 7); eg.fill(); } }
    for (let i = 0; i < 7; i++) { const y = r() * s; g.strokeStyle = 'rgba(30,14,40,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 6); g.stroke(); bg.strokeStyle = '#e0e0e0'; bg.lineWidth = 4; bg.beginPath(); bg.moveTo(0, y); for (let x = 0; x <= s; x += 32) bg.lineTo(x, y + Math.sin(x * 0.05 + i) * 6); bg.stroke(); }
    speckle(g, s, r, 2500, 0.1); speckle(bg, s, r, 3000, 0.3);
    return { map: ctex(c, true), bump: ctex(b), emis: ctex(e, true) };
  };
  M.texLattice = function () {
    const s = 512, c = cv(s), g = c.getContext('2d'), b = cv(s), bg = b.getContext('2d'), e = cv(s), eg = e.getContext('2d'), r = rng(37);
    g.fillStyle = '#ddd4bc'; g.fillRect(0, 0, s, s); bg.fillStyle = '#909090'; bg.fillRect(0, 0, s, s); eg.fillStyle = '#000'; eg.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,100,70' : '255,250,235'},${r() * 0.07})`; g.fillRect(r() * s, r() * s, 8 + r() * 40, 3 + r() * 10); }
    const L = (col, w, ecol) => (pts, close) => { [[g, col, w], [bg, '#202020', w + 1.5], [eg, ecol, Math.max(1.2, w - 1.5)]].forEach((q) => { if (!q[1]) return; q[0].strokeStyle = q[1]; q[0].lineWidth = q[2]; q[0].beginPath(); pts.forEach((p, i) => (i ? q[0].lineTo(p[0], p[1]) : q[0].moveTo(p[0], p[1]))); if (close) q[0].closePath(); q[0].stroke(); }); };
    const gold = L('#c8973a', 4, 'rgba(90,255,238,0.95)');
    for (let i = 0; i < 26; i++) { let x = Math.floor(r() * 16) * 32 + 16, y = Math.floor(r() * 16) * 32 + 16; const pts = [[x, y]]; for (let k = 0; k < 5; k++) { if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(r() * 3)); else y += (r() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(r() * 3)); pts.push([x, y]); } gold(pts); g.fillStyle = '#39e6d6'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); eg.fillStyle = 'rgba(120,255,240,1)'; eg.beginPath(); eg.arc(x, y, 5, 0, 7); eg.fill(); }
    for (let i = 0; i < 5; i++) { const cx = r() * s, cy = r() * s; for (let k = 1; k < 4; k++) { [[g, '#b98a34', 2.5], [eg, 'rgba(60,240,220,0.7)', 1.6], [bg, '#303030', 3.5]].forEach((q) => { q[0].strokeStyle = q[1]; q[0].lineWidth = q[2]; q[0].beginPath(); q[0].arc(cx, cy, k * 14, r() * 3, r() * 3 + 4); q[0].stroke(); }); } }
    for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(70,58,34,0.5)'; g.lineWidth = 2; g.strokeRect(6 + i * 4, 6 + i * 4, s - 12 - i * 8, s - 12 - i * 8); }
    speckle(g, s, r, 2500, 0.08); speckle(bg, s, r, 2500, 0.2);
    return { map: ctex(c, true), bump: ctex(b), emis: ctex(e, true) };
  };
  M.texGround = function (theme) {
    const s = 512, c = cv(s), g = c.getContext('2d'), r = rng(theme.name.length * 97 + 5 + (theme.ground[0] & 255));
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    g.fillStyle = hex(theme.ground[0]); g.fillRect(0, 0, s, s);
    for (let i = 0; i < 520; i++) { const x = r() * s, y = r() * s, rad = 8 + r() * 46, gr = g.createRadialGradient(x, y, 0, x, y, rad); const col = theme.ground[1 + Math.floor(r() * 2)]; const rr = (col >> 16) & 255, gg = (col >> 8) & 255, bb = col & 255; gr.addColorStop(0, `rgba(${rr},${gg},${bb},0.5)`); gr.addColorStop(1, `rgba(${rr},${gg},${bb},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    if (theme.name === 'karthaga') { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64 + 3, 0); g.lineTo(i * 64 + 3, s); g.moveTo(0, i * 64 + 3); g.lineTo(s, i * 64 + 3); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 60; i++) g.fillRect(r() * s, r() * s, 10 + r() * 40, 2); g.fillStyle = 'rgba(232,161,58,0.5)'; for (let i = 0; i < 6; i++) g.fillRect(r() * s, r() * s, 40, 6); }
    else if (theme.name === 'prismatic') { for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${140 + r() * 80},${120 + r() * 80},255,${0.04 + r() * 0.1})`; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 90); g.lineTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 90); g.fill(); } g.strokeStyle = 'rgba(190,170,255,0.12)'; for (let i = 0; i < 30; i++) { g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120); g.stroke(); } }
    else { g.strokeStyle = 'rgba(20,8,4,0.5)'; g.lineWidth = 1.6; for (let i = 0; i < 46; i++) { let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 44; y += (r() - 0.5) * 44; g.lineTo(x, y); } g.stroke(); } for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,190,120,${r() * 0.08})`; g.fillRect(r() * s, r() * s, 2 + r() * 4, 2 + r() * 4); } }
    speckle(g, s, r, 5000, 0.1); speckle(g, s, r, 3000, 0.16, true);
    return c;
  };
  M.spriteTex = function (kind) {
    const s = 64, c = cv(s), g = c.getContext('2d');
    if (kind === 'ring') { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); }
    else { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    return new T.CanvasTexture(c);
  };
  M.blobTex = function () { const s = 64, c = cv(s), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); return new T.CanvasTexture(c); };

  /* ------------------------------------------------------------ materials (shared per faction; only the team material is per commander) */
  N.TEAM_COLORS = N.TEAM_COLORS || [0x2aa8ff, 0xff3b30];
  M.TEAM = N.PLAYER_COLORS;
  const shared = {}, teamMats = [], matSets = {};
  const std = (o, tag) => { const m = M.fogify(new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, o))); m.userData.uvs = (o.uvs || 1.1); m.userData.tag = tag; return m; };
  function avgTone(map) { try { const c = cv(8), g = c.getContext('2d'); g.drawImage(map.image, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 256; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } return new T.Color(r / 64 / 255, gg / 64 / 255, b / 64 / 255).convertSRGBToLinear(); } catch (e) { return null; } }
  function sharedFor(fid) {
    if (shared[fid]) return shared[fid];
    let m;
    if (fid === 'vanguard') {
      const t = M.texVanguard();
      m = { hull: std({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, color: 0xc4ced8, roughness: 0.5, metalness: 0.55 }), hull2: std({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, color: 0x6c7884, roughness: 0.55, metalness: 0.6 }), trim: std({ color: 0xe0902f, roughness: 0.38, metalness: 0.65, map: t.map, bumpMap: t.bump, bumpScale: 0.6 }), dark: std({ color: 0x1b2026, roughness: 0.8, metalness: 0.3 }), glow: std({ color: 0xffb060, emissive: 0xff8a20, emissiveIntensity: 1.5 }), glass: std({ color: 0x0f2c3c, emissive: 0x2ad0ff, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.85 }) };
    } else if (fid === 'brood') {
      const t = M.texBrood();
      m = { hull: std({ map: t.map, bumpMap: t.bump, bumpScale: 2.2, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0.75, color: 0xc49ad6, roughness: 0.62, metalness: 0.05 }), hull2: std({ map: t.map, bumpMap: t.bump, bumpScale: 1.8, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0.45, color: 0x7c9c56, roughness: 0.68, metalness: 0.05 }), trim: std({ color: 0xece2bb, roughness: 0.42, metalness: 0.08, map: t.map, bumpMap: t.bump, bumpScale: 1.2 }), dark: std({ color: 0x2a1834, roughness: 0.9 }), glow: std({ color: 0xc8ff60, emissive: 0xa0ff30, emissiveIntensity: 1.7 }), glass: std({ color: 0x3d7a34, emissive: 0x66ff44, emissiveIntensity: 0.65, roughness: 0.15, transparent: true, opacity: 0.88 }), flesh: std({ color: 0xe0708e, roughness: 0.42, emissive: 0x6a1030, emissiveIntensity: 0.35, map: t.map, bumpMap: t.bump, bumpScale: 1.6 }) };
    } else {
      const t = M.texLattice();
      m = { hull: std({ map: t.map, bumpMap: t.bump, bumpScale: 0.7, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0xf3edd8, roughness: 0.3, metalness: 0.42 }), hull2: std({ map: t.map, bumpMap: t.bump, bumpScale: 0.6, emissiveMap: t.emis, emissive: 0xffffff, emissiveIntensity: 0.8, color: 0x9a8560, roughness: 0.36, metalness: 0.6 }), trim: std({ color: 0xe8c25a, roughness: 0.22, metalness: 0.95 }), dark: std({ color: 0x162024, roughness: 0.45, metalness: 0.55 }), glow: std({ color: 0x6affef, emissive: 0x20f0dc, emissiveIntensity: 1.7 }), glass: std({ color: 0x0d3a40, emissive: 0x30f0e0, emissiveIntensity: 0.5, roughness: 0.08, metalness: 0.7 }), crys: std({ color: 0x8ffcff, emissive: 0x28d6e8, emissiveIntensity: 0.9, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.82 }) };
    }
    // Pass-2 art correction: the textures used to repeat every ~0.9 world units (1.1 uv/unit), which engraved a tiny panel grid + speckle over every part and read as foil / static at close range.
    // Now one texture tile spans ~3.3 world units (broad plates / shell), bump is a fraction of what it was (seams and wear stay, noise goes), metal is toned down so lighting shapes the form.
    const UV = { vanguard: 0.3, brood: 0.26, lattice: 0.3 }[fid], BK = { vanguard: 0.36, brood: 0.28, lattice: 0.42 }[fid];
    Object.keys(m).forEach((k) => { const x = m[k]; if (!x.map) return; x.userData.uvs = UV; if (x.bumpMap) x.bumpScale *= BK; if (fid === 'vanguard') { x.roughness = Math.max(x.roughness, 0.6); x.metalness = Math.min(x.metalness, 0.32); } else if (fid === 'lattice') { x.roughness = Math.max(x.roughness, 0.44); x.metalness = Math.min(x.metalness, 0.3); } if (fid === 'brood' && x.emissiveMap) x.emissiveIntensity *= 0.5; });
    Object.keys(m).forEach((k) => { if (['glow', 'glass', 'crys', 'flesh'].indexOf(k) >= 0 || m[k].emissiveIntensity > 1.2) m[k].userData.noAO = k === 'glow' || k === 'crys' || k === 'glass'; });
    m.glow.userData.glow = true; if (m.crys) m.crys.userData.glow = true;
    Object.keys(m).forEach((k) => { if (m[k].map) m[k].userData.avg = avgTone(m[k].map); });
    return (shared[fid] = m);
  }
  M.mats = function (fid, owner) {
    const key = fid + owner; if (matSets[key]) return matSets[key];
    if (!teamMats[owner]) { const c = (N.PLAYER_COLORS || M.TEAM)[owner] || 0xffffff; const tm = std({ color: c, emissive: c, emissiveIntensity: 0.95, roughness: 0.4 }); tm.userData.noAO = true; tm.userData.team = true; teamMats[owner] = tm; }
    return (matSets[key] = Object.assign({}, sharedFor(fid), { team: teamMats[owner] }));
  };

  /* ------------------------------------------------------------ geometry kit */
  const geoCache = {};
  const gc = (key, mk) => geoCache[key] || (geoCache[key] = mk());
  const rboxG = (sx, sy, sz, r) => gc(`rb${sx.toFixed(3)},${sy.toFixed(3)},${sz.toFixed(3)},${r.toFixed(3)}`, () => {
    const g = new T.BoxGeometry(sx, sy, sz, 2, 2, 2), p = g.attributes.position, n = g.attributes.normal, hx = sx / 2, hy = sy / 2, hz = sz / 2, v = new T.Vector3(), q = new T.Vector3();
    r = Math.min(r, hx * 0.98, hy * 0.98, hz * 0.98);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)); q.set(Math.max(-hx + r, Math.min(hx - r, v.x)), Math.max(-hy + r, Math.min(hy - r, v.y)), Math.max(-hz + r, Math.min(hz - r, v.z)));
      const d = v.clone().sub(q); if (d.lengthSq() > 1e-9) { d.normalize(); n.setXYZ(i, d.x, d.y, d.z); v.copy(q).addScaledVector(d, r); p.setXYZ(i, v.x, v.y, v.z); }
    }
    return g;
  });
  const taperG = (tx, tz, sh) => gc(`tp${tx.toFixed(2)},${tz.toFixed(2)},${sh.toFixed(2)}`, () => {
    const g = new T.BoxGeometry(1, 1, 1, 1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * tx + sh, p.getY(i), p.getZ(i) * tz);
    g.computeVertexNormals(); return g;
  });
  const cylG = (rt, rb, seg) => gc(`cy${rt.toFixed(3)},${rb.toFixed(3)},${seg}`, () => new T.CylinderGeometry(rt, rb, 1, seg, 1));
  const sphG = gc('sph', () => new T.SphereGeometry(1, 16, 12));
  const domeG = gc('dome', () => new T.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2));
  const coneG = (seg) => gc('cone' + seg, () => new T.ConeGeometry(1, 1, seg, 1));
  const torusG = (t) => gc('tor' + t, () => new T.TorusGeometry(1, t, 8, 28));
  const crysG = (sides, waist) => gc(`cr${sides},${waist}`, () => { const g = new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(1, waist * 0.5), new T.Vector2(1, 1 - waist), new T.Vector2(0.001, 1)].map((p, i) => (i === 2 ? new T.Vector2(1, waist * 2.2 + 0.25) : p)).sort((a, b) => a.y - b.y), sides); const f = g.toNonIndexed(); f.computeVertexNormals(); return f; });
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _nm = new T.Matrix3(), _v = new T.Vector3();
  function merge(geos) {
    const ng = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0; ng.forEach((g) => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
    let o = 0;
    ng.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); if (g.attributes.color) col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }
  function Builder(y0) { this.items = []; this.y0 = y0 || 0; }
  Builder.prototype.add = function (geo, mat, sx, sy, sz, x, y, z, rx, ry, rz) {
    _p.set(x || 0, y || 0, z || 0); _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)); _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    const g = geo.clone(); g.applyMatrix4(_m);
    // bake ambient occlusion: parts near the ground / facing down darken; up-facing lightens (skipped for emissive materials)
    const P = g.attributes.position, Nn = g.attributes.normal, col = new Float32Array(P.count * 3);
    _nm.getNormalMatrix(_m);
    const ao = !(mat.userData && mat.userData.noAO);
    for (let i = 0; i < P.count; i++) {
      let c = 1;
      if (ao) { _v.set(Nn.getX(i), Nn.getY(i), Nn.getZ(i)).applyMatrix3(_nm).normalize(); const h = Math.max(0, P.getY(i) + this.y0); c = (0.56 + 0.44 * Math.min(1, Math.pow(h / 1.5, 0.75))) * (0.86 + 0.14 * Math.max(-1, Math.min(1, _v.y))); }
      col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = c;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    // box-projected UVs (no stretching regardless of part size)
    const uvs = (mat.userData && mat.userData.uvs) || 1, uv = new Float32Array(P.count * 2), nn = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i)), x2 = P.getX(i), y2 = P.getY(i), z2 = P.getZ(i);
      if (ay >= ax && ay >= az) { uv[i * 2] = x2 * uvs; uv[i * 2 + 1] = z2 * uvs; } else if (ax >= az) { uv[i * 2] = z2 * uvs; uv[i * 2 + 1] = y2 * uvs; } else { uv[i * 2] = x2 * uvs; uv[i * 2 + 1] = y2 * uvs; }
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    this.items.push({ g, mat }); return this;
  };
  const P_ = Builder.prototype;
  P_.rb = function (sx, sy, sz, x, y, z, mat, rx, ry, rz, r) { return this.add(rboxG(sx, sy, sz, r == null ? Math.min(sx, sy, sz) * 0.22 : r), mat, 1, 1, 1, x, y, z, rx, ry, rz); };
  P_.tp = function (sx, sy, sz, tx, tz, x, y, z, mat, rx, ry, rz, sh) { return this.add(taperG(tx, tz, sh || 0), mat, sx, sy, sz, x, y, z, rx, ry, rz); };
  P_.cy = function (rt, rb, h, x, y, z, mat, rx, ry, rz, seg) { return this.add(cylG(rt, rb, seg || 12), mat, 1, h, 1, x, y, z, rx, ry, rz); };
  P_.sp = function (sx, sy, sz, x, y, z, mat, rx, ry, rz) { return this.add(sphG, mat, sx, sy, sz, x, y, z, rx, ry, rz); };
  P_.dm = function (sx, sy, sz, x, y, z, mat, rx, ry, rz) { return this.add(domeG, mat, sx, sy, sz, x, y, z, rx, ry, rz); };
  P_.cn = function (r, h, x, y, z, mat, rx, ry, rz, seg) { return this.add(coneG(seg || 8), mat, r, h, r, x, y, z, rx, ry, rz); };
  P_.to = function (R, t, x, y, z, mat, rx, ry, rz) { return this.add(torusG(t), mat, R, R, R, x, y, z, rx, ry, rz); };
  P_.cr = function (r, h, x, y, z, mat, rx, ry, rz, sides) { return this.add(crysG(sides || 6, 0.18), mat, r, h, r, x, y, z, rx, ry, rz); };
  P_.tb = function (pts, rad, mat, seg, taper) {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), g = new T.TubeGeometry(curve, seg || 10, rad, 6, false);
    if (taper) { const p = g.attributes.position, per = 7; for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / per), t = ring / (seg || 10), c = curve.getPoint(Math.min(1, t)); const k = 1 - taper * t; p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k); } g.computeVertexNormals(); }
    return this.add(g, mat, 1, 1, 1, 0, 0, 0);
  };
  P_.emit = function (parent, shadow) {
    const by = new Map();
    this.items.forEach((it) => { if (!by.has(it.mat)) by.set(it.mat, []); by.get(it.mat).push(it.g); });
    by.forEach((list, mat) => { const mesh = new T.Mesh(merge(list), mat); mesh.castShadow = shadow !== false; mesh.receiveShadow = false; parent.add(mesh); });
    return parent;
  };
  const B = (y0) => new Builder(y0);
  function piv(parent, x, y, z, rig, data) { const g = new T.Group(); g.position.set(x, y, z); g.userData = Object.assign({ rig }, data || {}); parent.add(g); return g; }
  function grp(parent, name, layer) { const g = new T.Group(); if (name) g.name = name; if (layer) g.userData.layer = layer; parent.add(g); return g; }
  const muzzle = (parent, x, y, z) => { const o = new T.Object3D(); o.position.set(x, y, z); o.userData.rig = 'muzzle'; parent.add(o); return o; };
  const sign = [-1, 1];

  /* ================================================================ VANGUARD units (face +X, up +Y) */
  const UNIT = { vanguard: {}, brood: {}, lattice: {} };
  const legsV = (root, m, hip, gap, w, len, amp) => sign.forEach((s, i) => {
    const l = piv(root, 0, hip, s * gap, 'leg', { phase: i ? PI : 0, amp: amp || 0.75 });
    B(hip).rb(w, len * 0.55, w * 1.1, 0.02, -len * 0.27, 0, m.hull2, 0, 0, 0, 0.03).sp(w * 0.62, w * 0.62, w * 0.62, 0, -len * 0.5, 0, m.dark).emit(l);
    const k = piv(l, 0, -len * 0.5, 0, 'knee', { amp: 0.5 });
    B(hip).rb(w * 0.9, len * 0.5, w, 0, -len * 0.25, 0, m.hull, 0, 0, 0, 0.03).rb(w * 1.7, w * 0.6, w * 1.3, w * 0.35, -len * 0.52, 0, m.dark, 0, 0, 0, 0.05).rb(w * 1.1, w * 0.3, w * 1.1, 0, -len * 0.16, 0, m.trim, 0, 0, 0, 0.02).emit(k);
  });
  const soldierV = (root, m, o) => {
    legsV(root, m, 0.5, 0.13, 0.15, 0.5, 0.75);
    B().tp(0.36, 0.5, 0.46, 0.86, 1.08, 0, 0.78, 0, m.hull, 0, 0, 0, 0).rb(0.32, 0.16, 0.42, 0, 0.53, 0, m.hull2).rb(0.34, 0.05, 0.44, 0, 0.6, 0, m.team, 0, 0, 0, 0.02)
      .rb(0.2, 0.42, 0.32, -0.24, 0.8, 0, m.hull2).cy(0.015, 0.015, 0.45, -0.28, 1.2, 0.1, m.dark, 0, 0, 0, 5).rb(0.1, 0.32, 0.2, 0.19, 0.78, 0, m.dark, 0, 0, 0.1)
      .dm(0.14, 0.11, 0.14, 0, 0.99, 0.29, m.hull).dm(0.14, 0.11, 0.14, 0, 0.99, -0.29, m.hull).rb(0.17, 0.045, 0.2, 0, 1.0, 0.29, m.trim).rb(0.17, 0.045, 0.2, 0, 1.0, -0.29, m.trim)
      .sp(0.155, 0.16, 0.15, 0.02, 1.13, 0, m.hull).rb(0.11, 0.06, 0.2, 0.13, 1.14, 0, m.glass, 0, 0, 0, 0.02).rb(0.06, 0.1, 0.24, -0.04, 1.2, 0, m.hull2).emit(root);
    if (o.hat) B().dm(0.2, 0.12, 0.2, 0.02, 1.2, 0, m.trim).cy(0.22, 0.22, 0.03, 0.02, 1.2, 0, m.trim, 0, 0, 0, 14).emit(root);
    const armL = piv(root, 0, 0.94, -0.27, 'arm', { phase: PI, amp: 0.6 }); B(0.5).rb(0.11, 0.36, 0.11, 0.03, -0.17, 0, m.hull2, 0, 0, 0, 0.03).sp(0.09, 0.09, 0.09, 0.03, -0.36, 0, m.dark).emit(armL);
    const armR = piv(root, 0, 0.94, 0.27, 'arm', { phase: 0, amp: 0.15, aim: 1 });
    B(0.5).rb(0.12, 0.3, 0.12, 0.08, -0.13, 0, m.hull2, 0, 0, 0, 0.03).emit(armR);
    const gun = piv(armR, 0.14, -0.28, 0, 'gun');
    if (o.tool) { B(0.5).rb(0.3, 0.08, 0.08, 0.14, 0, 0, m.dark).cn(0.06, 0.16, 0.34, 0, 0, m.glow, 0, 0, -PI / 2, 6).rb(0.1, 0.14, 0.1, 0.02, -0.06, 0, m.trim).emit(gun); muzzle(gun, 0.42, 0, 0); }
    else if (o.tube) { B(0.5).cy(0.085, 0.085, 0.78, 0.3, 0.08, 0, m.dark, 0, 0, PI / 2, 10).cy(0.105, 0.105, 0.16, 0.05, 0.08, 0, m.trim, 0, 0, PI / 2, 10).cy(0.105, 0.105, 0.1, 0.62, 0.08, 0, m.trim, 0, 0, PI / 2, 10).cn(0.07, 0.12, 0.72, 0.08, 0, m.glow, 0, 0, -PI / 2, 6).emit(gun); muzzle(gun, 0.72, 0.08, 0); }
    else if (o.aa) { B(0.5).rb(0.32, 0.16, 0.2, 0.15, 0.1, 0, m.dark).cy(0.04, 0.04, 0.44, 0.32, 0.13, 0.06, m.trim, 0, 0, PI / 2, 8).cy(0.04, 0.04, 0.44, 0.32, 0.13, -0.06, m.trim, 0, 0, PI / 2, 8).emit(gun); muzzle(gun, 0.55, 0.13, 0); }
    else if (o.med) { B(0.5).rb(0.18, 0.1, 0.12, 0.1, 0, 0, m.glow).emit(gun); }
    else { B(0.5).rb(0.56, 0.09, 0.09, 0.22, 0, 0, m.dark).rb(0.16, 0.14, 0.11, 0.02, -0.02, 0, m.trim).cy(0.03, 0.03, 0.14, 0.56, 0, 0, m.dark, 0, 0, PI / 2, 6).emit(gun); muzzle(gun, 0.6, 0, 0); }
    if (o.aa) { B().rb(0.16, 0.42, 0.36, -0.24, 0.9, 0, m.dark).cy(0.045, 0.045, 0.36, -0.22, 1.14, 0.1, m.trim, 0, 0, -0.35, 8).cy(0.045, 0.045, 0.36, -0.22, 1.14, -0.1, m.trim, 0, 0, -0.35, 8).emit(root); }
    if (o.med) { B().rb(0.2, 0.36, 0.32, -0.24, 0.82, 0, m.hull).rb(0.02, 0.22, 0.07, -0.35, 0.84, 0, m.glow).rb(0.02, 0.07, 0.22, -0.35, 0.84, 0, m.glow).emit(root); const d = piv(root, 0, 1.55, 0, 'spin', { orbit: 0.4 }); B().sp(0.09, 0.07, 0.09, 0.42, 0, 0, m.glow).rb(0.14, 0.02, 0.14, 0.42, 0, 0, m.hull2).emit(d); }
  };
  UNIT.vanguard.worker = (r, m) => soldierV(r, m, { hat: 1, tool: 1 }); UNIT.vanguard.trooper = (r, m) => soldierV(r, m, {}); UNIT.vanguard.lancer = (r, m) => soldierV(r, m, { tube: 1 });
  UNIT.vanguard.skyhunter = (r, m) => soldierV(r, m, { aa: 1 }); UNIT.vanguard.support = (r, m) => soldierV(r, m, { med: 1 });
  UNIT.vanguard.raider = (r, m) => {
    B().tp(1.2, 0.3, 0.66, 0.86, 0.9, 0, 0.4, 0, m.hull, 0, 0, 0, -0.02).rb(0.52, 0.26, 0.54, -0.16, 0.64, 0, m.glass, 0, 0, 0, 0.09).rb(0.5, 0.05, 0.7, 0.4, 0.58, 0, m.team, 0, 0, 0, 0.02).tp(0.34, 0.16, 0.5, 0.6, 0.8, 0.62, 0.44, 0, m.hull2)
      .cy(0.02, 0.02, 0.7, -0.42, 0.78, 0.3, m.dark, PI / 2, 0, 0, 6).cy(0.02, 0.02, 0.7, -0.42, 0.78, -0.3, m.dark, PI / 2, 0, 0, 6).rb(0.06, 0.06, 0.66, -0.42, 0.98, 0, m.dark).cy(0.04, 0.05, 0.3, -0.62, 0.62, 0.2, m.dark, 0, 0, 0, 6).rb(0.16, 0.04, 0.5, 0.86, 0.34, 0, m.trim).emit(r);
    [[0.4, 0.36], [0.4, -0.36], [-0.4, 0.36], [-0.4, -0.36]].forEach((p) => { const w = piv(r, p[0], 0.23, p[1], 'spin', { axis: 'z', rate: 1 }); B(0.2).cy(0.23, 0.23, 0.16, 0, 0, 0, m.dark, PI / 2, 0, 0, 14).cy(0.13, 0.13, 0.19, 0, 0, 0, m.trim, PI / 2, 0, 0, 8).cy(0.05, 0.05, 0.21, 0, 0, 0, m.hull2, PI / 2, 0, 0, 6).emit(w); });
    const t = piv(r, -0.06, 0.82, 0, 'turret'); B(0.7).cy(0.16, 0.18, 0.1, 0, 0, 0, m.hull2, 0, 0, 0, 10).emit(t); const g = piv(t, 0.1, 0.1, 0, 'gun'); B(0.7).rb(0.46, 0.07, 0.07, 0.22, 0, 0, m.dark).cy(0.03, 0.03, 0.14, 0.5, 0, 0, m.trim, 0, 0, PI / 2, 6).emit(g); muzzle(g, 0.55, 0, 0);
  };
  const mechV = (r, m, k, heavy) => {
    const hip = 1.15 * k;
    sign.forEach((s, i) => { const l = piv(r, 0, hip, s * 0.44 * k, 'leg', { phase: i ? PI : 0, amp: 0.5 });
      B(hip).rb(0.34 * k, 0.72 * k, 0.3 * k, 0.1 * k, -0.34 * k, 0, m.hull2, 0, 0, -0.28, 0.05).sp(0.22 * k, 0.22 * k, 0.22 * k, 0.24 * k, -0.68 * k, 0, m.dark).cy(0.05 * k, 0.05 * k, 0.5 * k, -0.06 * k, -0.28 * k, 0.18 * k, m.trim, 0, 0, 0.3, 6).emit(l);
      const kn = piv(l, 0.24 * k, -0.68 * k, 0, 'knee', { amp: 0.9 }); B(hip).rb(0.3 * k, 0.72 * k, 0.26 * k, -0.06 * k, -0.3 * k, 0, m.hull, 0, 0, 0.28, 0.05).rb(0.62 * k, 0.16 * k, 0.46 * k, 0.12 * k, -0.7 * k, 0, m.dark, 0, 0, 0, 0.06).rb(0.44 * k, 0.05 * k, 0.5 * k, 0.15 * k, -0.62 * k, 0, m.trim, 0, 0, 0, 0.02).emit(kn); });
    const hull = piv(r, 0, 0, 0, 'hull');
    B().rb(0.9 * k, 0.34 * k, 0.9 * k, 0, 1.2 * k, 0, m.dark).tp(1.1 * k, 0.76 * k, 1.0 * k, 0.86, 0.9, 0, 1.72 * k, 0, m.hull, 0, 0, 0, -0.05 * k).rb(0.5 * k, 0.36 * k, 0.66 * k, 0.5 * k, 1.9 * k, 0, m.glass, 0, 0, -0.12, 0.08).rb(0.7 * k, 0.12 * k, 1.08 * k, 0, 1.42 * k, 0, m.team, 0, 0, 0, 0.03)
      .rb(0.42 * k, 0.56 * k, 1.0 * k, -0.55 * k, 1.8 * k, 0, m.hull2).cy(0.07 * k, 0.09 * k, 0.5 * k, -0.7 * k, 2.3 * k, 0.28 * k, m.dark, 0, 0, 0, 8).cy(0.07 * k, 0.09 * k, 0.5 * k, -0.7 * k, 2.3 * k, -0.28 * k, m.dark, 0, 0, 0, 8).cy(0.09 * k, 0.09 * k, 0.05 * k, -0.7 * k, 2.55 * k, 0.28 * k, m.glow, 0, 0, 0, 8)
      .tp(0.7 * k, 0.16 * k, 0.4 * k, 0.8, 0.8, 0, 2.2 * k, 0.38 * k, m.trim).tp(0.7 * k, 0.16 * k, 0.4 * k, 0.8, 0.8, 0, 2.2 * k, -0.38 * k, m.trim).emit(hull);
    const a = piv(hull, 0.15 * k, 1.75 * k, 0.66 * k, 'turret'); B(1.4).rb(0.34 * k, 0.34 * k, 0.34 * k, 0, 0, 0, m.hull2).emit(a);
    const g = piv(a, 0.1, 0, 0.05, 'gun'); B(1.4).cy(0.09 * k, 0.09 * k, 0.9 * k, 0.5 * k, 0, 0, m.dark, 0, 0, PI / 2, 10).cy(0.14 * k, 0.14 * k, 0.22 * k, 0.94 * k, 0, 0, m.trim, 0, 0, PI / 2, 10).cy(0.12 * k, 0.12 * k, 0.3 * k, 0.15 * k, 0, 0, m.hull, 0, 0, PI / 2, 10).emit(g); muzzle(g, 1.05 * k, 0, 0);
    if (heavy) { const g2 = piv(hull, 0.15 * k, 1.75 * k, -0.66 * k, 'turret'); B(1.4).rb(0.34 * k, 0.34 * k, 0.34 * k, 0, 0, 0, m.hull2).emit(g2); const gg = piv(g2, 0.1, 0, -0.05, 'gun'); B(1.4).cy(0.09 * k, 0.09 * k, 0.9 * k, 0.5 * k, 0, 0, m.dark, 0, 0, PI / 2, 10).cy(0.14 * k, 0.14 * k, 0.22 * k, 0.94 * k, 0, 0, m.trim, 0, 0, PI / 2, 10).emit(gg); muzzle(gg, 1.05 * k, 0, 0); B().dm(0.3, 0.2, 0.3, 0.1, 2.5 * k, 0, m.glass).cy(0.3, 0.3, 0.06, 0.1, 2.48 * k, 0, m.trim, 0, 0, 0, 12).emit(hull); }
    else { const b = piv(hull, 0.1 * k, 1.75 * k, -0.62 * k, 'arm', { amp: 0.1 }); B(1.4).rb(0.4 * k, 0.56 * k, 0.4 * k, 0, -0.12 * k, 0, m.hull2).rb(0.5 * k, 0.1 * k, 0.5 * k, 0, 0.14 * k, 0, m.trim).emit(b); }
  };
  UNIT.vanguard.walker = (r, m) => mechV(r, m, 1, false); UNIT.vanguard.heavy = (r, m) => mechV(r, m, 1.35, true);
  UNIT.vanguard.artillery = (r, m) => {
    sign.forEach((s) => { B().rb(1.4, 0.34, 0.34, 0, 0.25, s * 0.5, m.dark, 0, 0, 0, 0.1).cy(0.22, 0.22, 0.38, 0.6, 0.25, s * 0.5, m.hull2, PI / 2, 0, 0, 12).cy(0.22, 0.22, 0.38, -0.6, 0.25, s * 0.5, m.hull2, PI / 2, 0, 0, 12).cy(0.15, 0.15, 0.4, 0, 0.3, s * 0.5, m.trim, PI / 2, 0, 0, 10).emit(r); });
    B().tp(1.2, 0.36, 0.74, 0.86, 0.9, 0, 0.52, 0, m.hull).rb(0.5, 0.06, 0.76, 0.1, 0.74, 0, m.team).rb(0.5, 0.2, 0.3, -0.42, 0.72, 0, m.hull2).cy(0.02, 0.02, 0.6, -0.6, 1.05, 0.28, m.dark, 0, 0, 0, 5).emit(r);
    const t = piv(r, -0.15, 0.78, 0, 'turret'); B(0.9).tp(0.8, 0.4, 0.66, 0.85, 0.9, 0, 0.18, 0, m.hull2).cy(0.26, 0.28, 0.08, 0, 0.42, 0, m.trim, 0, 0, 0, 12).emit(t);
    const g = piv(t, 0.3, 0.3, 0, 'gun'); B(0.9).cy(0.12, 0.12, 1.8, 0.9, 0, 0, m.dark, 0, 0, PI / 2, 12).cy(0.19, 0.19, 0.6, 0.35, 0, 0, m.hull, 0, 0, PI / 2, 12).rb(0.34, 0.28, 0.28, 1.75, 0, 0, m.trim).rb(0.14, 0.36, 0.06, 1.75, 0, 0, m.dark).emit(g); muzzle(g, 1.85, 0, 0);
    sign.forEach((s) => B().rb(0.14, 0.5, 0.06, -0.72, 0.36, s * 0.4, m.hull2, 0.5 * s, 0, 0.1).rb(0.3, 0.06, 0.3, -0.75, 0.1, s * 0.66, m.dark).emit(r));
  };
  UNIT.vanguard.flyer = (r, m) => {
    B().tp(1.5, 0.42, 0.56, 0.6, 0.8, 0, 0.3, 0, m.hull, 0, 0, 0, 0.1).dm(0.36, 0.22, 0.28, 0.4, 0.5, 0, m.glass).tp(0.7, 0.05, 1.7, 0.7, 1, -0.06, 0.28, 0, m.hull2).rb(0.3, 0.05, 0.4, 0.22, 0.52, 0, m.team, 0, 0, 0, 0.02)
      .tp(0.4, 0.4, 0.06, 0.4, 1, -0.7, 0.62, 0, m.hull2).rb(0.5, 0.04, 0.9, -0.66, 0.36, 0, m.hull, 0, 0, 0, 0.02).emit(r);
    sign.forEach((s) => { B().cy(0.2, 0.22, 0.7, -0.15, 0.28, s * 0.86, m.dark, 0, 0, PI / 2, 12).cy(0.13, 0.2, 0.16, -0.55, 0.28, s * 0.86, m.hull2, 0, 0, PI / 2, 12).cy(0.11, 0.11, 0.05, -0.64, 0.28, s * 0.86, m.glow, 0, 0, PI / 2, 10).cy(0.05, 0.05, 0.4, 0.5, 0.22, s * 0.6, m.dark, 0, 0, PI / 2, 6).cy(0.05, 0.05, 0.4, 0.5, 0.12, s * 0.7, m.dark, 0, 0, PI / 2, 6).emit(r); const w = piv(r, -0.64, 0.28, s * 0.86, 'pulse', { amp: 0.25 }); B().cn(0.1, 0.5, -0.28, 0, 0, m.glow, 0, 0, PI / 2, 8).emit(w); });
    const g = piv(r, 0.6, 0.16, 0, 'gun'); B().cy(0.03, 0.03, 0.25, 0.1, 0, 0, m.dark, 0, 0, PI / 2, 6).emit(g); muzzle(g, 0.55, 0.16, 0.3); muzzle(g, 0.55, 0.16, -0.3);
    piv(r, 0, 0.3, 0, 'bob', { amp: 0.05 });
  };

  /* ================================================================ BROOD units (organic) */
  const legsBio = (root, m, n, x0, dx, w, hip, splay, len) => { for (let i = 0; i < n; i++) sign.forEach((s, j) => {
    const l = piv(root, x0 + i * dx, hip, s * splay, 'leg', { phase: (i + j) % 2 ? PI : 0, amp: 0.6, side: 1 });
    B(hip).tb([[0, 0, 0], [0.1, len * 0.25, s * 0.16], [0.16, -len * 0.1, s * 0.3], [0.1, -len * 0.7, s * 0.34], [0.14, -len, s * 0.36]], w, m.hull2, 8, 0.5).sp(w * 1.6, w * 1.6, w * 1.6, 0.14, -len, s * 0.36, m.trim).emit(l);
  }); };
  const bugInf = (root, m, o) => {
    const hip = 0.42;
    sign.forEach((s, i) => { const l = piv(root, 0.02, hip, s * 0.12, 'leg', { phase: i ? PI : 0, amp: 0.7 }); B(hip).tb([[0, 0, 0], [0.16, -0.18, 0], [-0.04, -0.32, 0], [0.06, -hip + 0.02, 0]], 0.055, m.hull2, 8, 0.4).sp(0.08, 0.08, 0.08, 0.06, -hip + 0.02, 0, m.trim).cn(0.05, 0.14, 0.14, -hip + 0.02, 0, m.trim, 0, 0, -PI / 2, 5).emit(l); });
    B().sp(0.27, 0.22, 0.24, 0, 0.64, 0, m.hull).sp(0.24, 0.2, 0.22, -0.2, 0.74, 0, m.hull2).sp(0.16, 0.14, 0.16, 0.2, 0.9, 0, m.hull).sp(0.06, 0.06, 0.06, 0.32, 0.94, 0.08, m.glow).sp(0.06, 0.06, 0.06, 0.32, 0.94, -0.08, m.glow)
      .rb(0.22, 0.05, 0.3, 0, 0.5, 0, m.team, 0, 0, 0, 0.02).cn(0.05, 0.22, 0.32, 0.84, 0.09, m.trim, 0, 0, -1.0, 5).cn(0.05, 0.22, 0.32, 0.84, -0.09, m.trim, 0, 0, -1.0, 5).emit(root);
    if (o.spines) for (let i = 0; i < 5; i++) B().cn(0.045, 0.34 - i * 0.02, -0.2 - i * 0.03, 0.92 + i * 0.02, (i - 2) * 0.09, m.trim, (i - 2) * 0.12, 0, 0.7, 5).emit(root);
    const armL = piv(root, 0.05, 0.78, -0.24, 'arm', { phase: PI, amp: 0.5 }); B(0.4).tb([[0, 0, 0], [0.08, -0.16, -0.02], [0.1, -0.34, 0]], 0.045, m.hull2, 6, 0.3).cn(0.06, 0.24, 0.12, -0.42, 0, m.trim, 0, 0, -0.2, 5).emit(armL);
    const armR = piv(root, 0.05, 0.78, 0.24, 'arm', { phase: 0, amp: 0.15, aim: 1 }); B(0.4).tb([[0, 0, 0], [0.08, -0.16, 0.02], [0.1, -0.3, 0]], 0.05, m.hull2, 6, 0.3).emit(armR);
    const gun = piv(armR, 0.14, -0.28, 0, 'gun');
    if (o.acid) { B(0.4).sp(0.16, 0.14, 0.14, 0.02, 0.02, 0, m.glass).tb([[0.1, 0, 0], [0.28, 0.08, 0], [0.46, 0.02, 0]], 0.045, m.trim, 8).emit(gun); muzzle(gun, 0.52, 0.02, 0); }
    else if (o.spore) { B(0.4).sp(0.2, 0.16, 0.16, 0.05, 0.08, 0, m.flesh).cn(0.1, 0.34, 0.3, 0.16, 0, m.trim, 0, 0, -PI / 2 + 0.5, 7).sp(0.07, 0.07, 0.07, 0.05, 0.22, 0, m.glow).emit(gun); muzzle(gun, 0.42, 0.24, 0); }
    else if (o.med) { B(0.4).sp(0.1, 0.1, 0.1, 0.1, 0, 0, m.glow).emit(gun); const d = piv(root, 0, 1.4, 0, 'spin', { orbit: 0.4 }); B().sp(0.09, 0.09, 0.09, 0.4, 0, 0, m.glow).emit(d); B().sp(0.14, 0.12, 0.14, 0, 1.3, 0, m.flesh).emit(root); }
    else if (o.tool) { B(0.4).cn(0.06, 0.32, 0.22, 0, 0, m.trim, 0, 0, -PI / 2, 5).cn(0.045, 0.24, 0.16, 0.06, 0.05, m.trim, 0, 0, -PI / 2, 5).emit(gun); muzzle(gun, 0.42, 0, 0); }
    else { B(0.4).cn(0.05, 0.42, 0.24, 0, 0, m.trim, 0, 0, -PI / 2, 5).sp(0.09, 0.08, 0.08, 0.04, 0, 0, m.hull).emit(gun); muzzle(gun, 0.46, 0, 0); }
  };
  UNIT.brood.worker = (r, m) => bugInf(r, m, { tool: 1 }); UNIT.brood.trooper = (r, m) => bugInf(r, m, { spines: 1 }); UNIT.brood.lancer = (r, m) => bugInf(r, m, { acid: 1, spines: 1 });
  UNIT.brood.skyhunter = (r, m) => bugInf(r, m, { spore: 1 }); UNIT.brood.support = (r, m) => bugInf(r, m, { med: 1 });
  UNIT.brood.raider = (r, m) => {
    legsBio(r, m, 3, -0.34, 0.34, 0.035, 0.36, 0.2, 0.36);
    B().sp(0.5, 0.2, 0.28, 0, 0.42, 0, m.hull).sp(0.34, 0.18, 0.22, -0.4, 0.42, 0, m.hull2).sp(0.2, 0.14, 0.16, 0.5, 0.44, 0, m.hull).sp(0.05, 0.05, 0.05, 0.62, 0.5, 0.08, m.glow).sp(0.05, 0.05, 0.05, 0.62, 0.5, -0.08, m.glow).rb(0.4, 0.04, 0.36, 0, 0.32, 0, m.team, 0, 0, 0, 0.02).emit(r);
    sign.forEach((s, i) => { const a = piv(r, 0.5, 0.4, s * 0.16, 'arm', { phase: i ? PI : 0, amp: 0.35 }); B(0.4).tb([[0, 0, 0], [0.16, 0.06, s * 0.1], [0.3, -0.04, s * 0.14]], 0.03, m.hull2, 6, 0.3).cn(0.05, 0.3, 0.36, -0.04, s * 0.15, m.trim, 0, 0, -1.4, 5).emit(a); });
    const g = piv(r, 0.5, 0.4, 0, 'gun'); muzzle(g, 0.4, 0, 0);
  };
  UNIT.brood.walker = (r, m) => bioBrute(r, m, 1, false); UNIT.brood.heavy = (r, m) => bioBrute(r, m, 1.35, true);
  function bioBrute(r, m, k, heavy) {
    legsBio(r, m, 2, -0.3 * k, 0.75 * k, 0.09 * k, 0.9 * k, 0.5 * k, 0.9 * k);
    const hull = piv(r, 0, 0, 0, 'hull');
    B().sp(0.9 * k, 0.55 * k, 0.72 * k, -0.05 * k, 1.05 * k, 0, m.hull).sp(0.62 * k, 0.42 * k, 0.6 * k, -0.6 * k, 1.12 * k, 0, m.hull2).sp(0.46 * k, 0.36 * k, 0.4 * k, 0.72 * k, 1.16 * k, 0, m.hull).rb(0.9 * k, 0.07 * k, 0.8 * k, 0, 0.7 * k, 0, m.team, 0, 0, 0, 0.03)
      .tp(0.6 * k, 0.3 * k, 0.72 * k, 0.6, 0.7, 0.05 * k, 1.45 * k, 0, m.trim, 0, 0, 0, 0).sp(0.09 * k, 0.09 * k, 0.09 * k, 1.05 * k, 1.28 * k, 0.16 * k, m.glow).sp(0.09 * k, 0.09 * k, 0.09 * k, 1.05 * k, 1.28 * k, -0.16 * k, m.glow).emit(hull);
    for (let i = 0; i < (heavy ? 7 : 5); i++) B().cn(0.09 * k, 0.6 * k - i * 0.04 * k, (-0.5 + i * 0.18) * k, 1.5 * k, (i % 2 ? 0.16 : -0.16) * k, m.trim, (i % 2 ? 0.2 : -0.2), 0, 0.25, 6).emit(hull);
    if (heavy) { B().sp(0.4 * k, 0.32 * k, 0.4 * k, 0.9 * k, 1.05 * k, 0, m.flesh).sp(0.22 * k, 0.2 * k, 0.22 * k, 1.12 * k, 1.05 * k, 0, m.glow).emit(hull); const g = piv(hull, 0.9 * k, 1.05 * k, 0, 'gun'); B().tb([[0, 0, 0], [0.3 * k, 0.05, 0], [0.6 * k, 0, 0]], 0.14 * k, m.trim, 8).emit(g); muzzle(g, 0.6 * k, 0, 0); }
    sign.forEach((s, i) => { const a = piv(hull, 0.6 * k, 1.2 * k, s * 0.5 * k, 'arm', { phase: i ? PI : 0, amp: 0.3 }); B(1).tb([[0, 0, 0], [0.3 * k, 0.1, s * 0.1], [0.55 * k, -0.15 * k, s * 0.14]], 0.09 * k, m.hull2, 8, 0.4).cn(0.12 * k, 0.75 * k, 0.75 * k, -0.2 * k, s * 0.14, m.trim, 0, 0, -1.3, 6).cn(0.08 * k, 0.5 * k, 0.6 * k, -0.4 * k, s * 0.14, m.trim, 0, 0, -1.0, 6).emit(a); });
    if (!heavy) { const g = piv(hull, 0.9 * k, 1.1 * k, 0, 'gun'); muzzle(g, 0.9 * k, 0, 0); }
  }
  UNIT.brood.artillery = (r, m) => {
    legsBio(r, m, 2, -0.3, 0.6, 0.07, 0.6, 0.42, 0.6);
    B().sp(0.62, 0.42, 0.52, -0.05, 0.85, 0, m.flesh).sp(0.36, 0.28, 0.34, -0.4, 0.92, 0, m.hull2).sp(0.2, 0.18, 0.2, 0.5, 0.86, 0, m.hull).rb(0.6, 0.05, 0.6, 0, 0.6, 0, m.team, 0, 0, 0, 0.02).sp(0.2, 0.2, 0.2, -0.05, 0.9, 0, m.glow).emit(r);
    const t = piv(r, 0.1, 1.2, 0, 'turret'); B().sp(0.18, 0.12, 0.18, 0, 0, 0, m.hull2).emit(t); const g = piv(t, 0.06, 0.06, 0, 'gun'); B().tb([[0, 0, 0], [0.4, 0.15, 0], [0.9, 0.45, 0]], 0.13, m.trim, 10, 0.25).cn(0.16, 0.3, 0.98, 0.5, 0, m.hull2, 0, 0, -1.1, 7).emit(g); muzzle(g, 0.95, 0.46, 0);
  };
  UNIT.brood.flyer = (r, m) => {
    B().sp(0.7, 0.18, 0.2, 0, 0.3, 0, m.hull).sp(0.3, 0.14, 0.16, 0.6, 0.34, 0, m.hull2).sp(0.06, 0.06, 0.06, 0.82, 0.38, 0.06, m.glow).sp(0.06, 0.06, 0.06, 0.82, 0.38, -0.06, m.glow).cn(0.05, 0.4, 0.55, 0.5, 0, m.trim, 0, 0, -0.6, 5).rb(0.4, 0.04, 0.3, 0, 0.18, 0, m.team, 0, 0, 0, 0.02)
      .tb([[-0.6, 0.3, 0], [-1.0, 0.3, 0.05], [-1.35, 0.4, 0.1]], 0.05, m.hull2, 8, 0.7).cn(0.06, 0.22, -1.4, 0.4, 0.1, m.trim, 0, 0, PI / 2, 5).emit(r);
    sign.forEach((s) => { const w = piv(r, 0.05, 0.38, s * 0.16, 'wing', { side: s }); B().tb([[0, 0, 0], [0.1, 0.1, s * 0.6], [0.25, 0.0, s * 1.25]], 0.035, m.trim, 8, 0.4).tb([[0, 0, 0], [-0.5, -0.03, s * 0.55], [-0.75, -0.1, s * 1.15]], 0.03, m.trim, 8, 0.4).tp(0.8, 0.02, 1.2, 0.8, 0.5, -0.22, -0.02, s * 0.62, m.flesh, 0, 0, 0, 0).emit(w); });
    const g = piv(r, 0.6, 0.3, 0, 'gun'); muzzle(g, 0.4, 0, 0); piv(r, 0, 0.3, 0, 'bob', { amp: 0.06 });
  };

  /* ================================================================ LATTICE units (floating crystalline machines) */
  const halo = (root, m, y, R, spd) => { const d = piv(root, 0, y, 0, 'spin', { rate: spd || 0.6 }); B().to(R, 0.05, 0, 0, 0, m.trim, PI / 2, 0, 0).cr(0.05, 0.18, R, 0, 0, m.crys, 0, 0, 0, 4).cr(0.05, 0.18, -R, 0, 0, m.crys, 0, 0, PI, 4).emit(d); };
  const sentinelL = (root, m, o) => {
    const b = piv(root, 0, 0, 0, 'bob', { amp: 0.05 });
    B().tp(0.34, 0.5, 0.36, 0.8, 1.05, 0, 0.78, 0, m.hull).rb(0.3, 0.13, 0.34, 0, 0.5, 0, m.hull2, 0, 0, 0, 0.04).sp(0.07, 0.07, 0.07, 0.15, 0.78, 0, m.glow).rb(0.36, 0.04, 0.4, 0, 0.58, 0, m.team, 0, 0, 0, 0.02)
      .cr(0.12, 0.28, 0, 1.03, 0, m.hull, 0, 0, 0, 5).rb(0.09, 0.05, 0.16, 0.08, 1.14, 0, m.glow).rb(0.14, 0.4, 0.18, -0.24, 0.8, 0, m.hull2).cr(0.06, 0.34, -0.28, 0.9, 0, m.crys, 0, 0, 0.25, 5).emit(b);
    sign.forEach((s, i) => { const l = piv(root, 0, 0.42, s * 0.11, 'leg', { phase: i ? PI : 0, amp: 0.45 }); B(0.4).cr(0.07, 0.4, 0, -0.4, 0, m.hull2, 0, 0, PI, 5).rb(0.1, 0.1, 0.1, 0, 0.02, 0, m.trim, 0, 0, 0, 0.03).emit(l); });
    const armL = piv(root, 0, 0.94, -0.25, 'arm', { phase: PI, amp: 0.4 }); B(0.5).rb(0.09, 0.28, 0.09, 0.02, -0.14, 0, m.hull2, 0, 0, 0, 0.03).sp(0.07, 0.07, 0.07, 0.02, -0.3, 0, m.glow).emit(armL);
    const armR = piv(root, 0, 0.94, 0.25, 'arm', { phase: 0, amp: 0.15, aim: 1 }); B(0.5).rb(0.1, 0.26, 0.1, 0.06, -0.12, 0, m.hull2, 0, 0, 0, 0.03).emit(armR);
    const gun = piv(armR, 0.14, -0.26, 0, 'gun');
    if (o.lance) { B(0.5).cy(0.03, 0.05, 1.0, 0.4, 0.1, 0, m.trim, 0, 0, PI / 2, 8).cr(0.08, 0.38, 0.96, 0.1, 0, m.crys, 0, 0, -PI / 2, 6).to(0.1, 0.03, 0.2, 0.1, 0, m.glow, 0, PI / 2, 0).emit(gun); muzzle(gun, 1.25, 0.1, 0); }
    else if (o.aa) { B(0.5).cy(0.06, 0.07, 0.3, 0.1, 0.12, 0, m.trim, 0, 0, PI / 2, 8).to(0.1, 0.025, 0.3, 0.12, 0, m.glow, 0, PI / 2, 0).to(0.09, 0.025, 0.4, 0.12, 0, m.glow, 0, PI / 2, 0).cr(0.05, 0.3, 0.55, 0.12, 0, m.crys, 0, 0, -PI / 2, 5).emit(gun); muzzle(gun, 0.7, 0.12, 0); halo(root, m, 1.5, 0.22, 1); }
    else if (o.med) { B(0.5).sp(0.1, 0.1, 0.1, 0.1, 0, 0, m.glow).emit(gun); halo(root, m, 1.45, 0.3, 1.4); }
    else if (o.tool) { B(0.5).rb(0.24, 0.07, 0.07, 0.14, 0, 0, m.hull2).cr(0.05, 0.18, 0.3, 0, 0, m.crys, 0, 0, -PI / 2, 4).emit(gun); muzzle(gun, 0.4, 0, 0); }
    else { B(0.5).rb(0.46, 0.08, 0.08, 0.2, 0, 0, m.hull2).cr(0.04, 0.22, 0.5, 0, 0, m.crys, 0, 0, -PI / 2, 4).emit(gun); muzzle(gun, 0.6, 0, 0); }
  };
  UNIT.lattice.worker = (r, m) => sentinelL(r, m, { tool: 1 }); UNIT.lattice.trooper = (r, m) => sentinelL(r, m, {}); UNIT.lattice.lancer = (r, m) => sentinelL(r, m, { lance: 1 });
  UNIT.lattice.skyhunter = (r, m) => sentinelL(r, m, { aa: 1 }); UNIT.lattice.support = (r, m) => sentinelL(r, m, { med: 1 });
  UNIT.lattice.raider = (r, m) => {
    piv(r, 0, 0.3, 0, 'bob', { amp: 0.05 });
    B().tp(1.3, 0.24, 0.5, 0.3, 0.7, 0, 0.36, 0, m.hull, 0, 0, 0, 0.12).cr(0.2, 0.5, 0.05, 0.44, 0, m.crys, 0, 0, -PI / 2, 5).rb(0.7, 0.04, 0.5, -0.05, 0.3, 0, m.team, 0, 0, 0, 0.02).tp(0.6, 0.05, 0.9, 0.6, 1, -0.4, 0.38, 0, m.hull2)
      .tp(0.3, 0.3, 0.05, 0.4, 1, -0.55, 0.56, 0.2, m.trim).tp(0.3, 0.3, 0.05, 0.4, 1, -0.55, 0.56, -0.2, m.trim).rb(0.5, 0.05, 0.05, 0.1, 0.32, 0.28, m.glow).rb(0.5, 0.05, 0.05, 0.1, 0.32, -0.28, m.glow).emit(r);
    const g = piv(r, 0.5, 0.42, 0, 'gun'); B().cr(0.04, 0.2, 0.06, 0, 0, m.crys, 0, 0, -PI / 2, 4).emit(g); muzzle(g, 0.34, 0, 0);
  };
  UNIT.lattice.walker = (r, m) => hoverL(r, m, 1, false); UNIT.lattice.heavy = (r, m) => hoverL(r, m, 1.5, true);
  function hoverL(r, m, k, heavy) {
    piv(r, 0, 0.3 * k, 0, 'bob', { amp: 0.06 });
    if (heavy) { B().rb(1.0 * k, 2.1 * k, 0.6 * k, 0, 1.55 * k, 0, m.hull, 0, 0, 0, 0.1).rb(1.05 * k, 0.1 * k, 0.66 * k, 0, 0.55 * k, 0, m.trim).rb(1.05 * k, 0.1 * k, 0.66 * k, 0, 2.6 * k, 0, m.trim).rb(0.7 * k, 0.05 * k, 0.64 * k, 0.05, 1.2 * k, 0, m.team).emit(r); B().rb(0.06 * k, 1.6 * k, 0.62 * k, 0.5 * k, 1.55 * k, 0, m.glow).emit(r); }
    else B().tp(1.2 * k, 0.4 * k, 0.9 * k, 0.75, 0.8, 0, 0.62 * k, 0, m.hull, 0, 0, 0, 0.06).rb(0.4 * k, 0.28 * k, 0.5 * k, 0.4 * k, 0.9 * k, 0, m.hull2).cr(0.14 * k, 0.5 * k, 0.5 * k, 0.9 * k, 0, m.crys, 0, 0, -PI / 2, 6).rb(0.7 * k, 0.06 * k, 0.94 * k, -0.05, 0.42 * k, 0, m.team, 0, 0, 0, 0.02).rb(0.5 * k, 0.24 * k, 0.5 * k, -0.42 * k, 0.9 * k, 0, m.dark).emit(r);
    const rn = piv(r, 0, 0.42 * k, 0, 'spin', { rate: 0.7 }); B().to(0.62 * k, 0.05 * k, 0, 0, 0, m.trim, PI / 2, 0, 0).cr(0.06 * k, 0.22 * k, 0.62 * k, 0, 0, m.crys, 0, 0, 0, 4).cr(0.06 * k, 0.22 * k, -0.62 * k, 0, 0, m.crys, 0, 0, PI, 4).cr(0.06 * k, 0.22 * k, 0, 0, 0.62 * k, m.crys, PI / 2, 0, 0, 4).emit(rn);
    if (heavy) { for (let i = 0; i < 3; i++) { const o = piv(r, 0, 1.6 * k, 0, 'spin', { rate: 0.6 + i * 0.25, orbit: 1 }); B().cr(0.12, 0.42, 0.9 * k, (i - 1) * 0.6, 0, m.crys, 0, 0, 0, 5).emit(o); } }
    const g = piv(r, 0.45 * k, (heavy ? 1.7 : 0.95) * k, 0, 'gun'); B().cy(0.05 * k, 0.07 * k, 0.6 * k, 0.3 * k, 0, 0, m.trim, 0, 0, PI / 2, 8).cr(0.07 * k, 0.3 * k, 0.65 * k, 0, 0, m.crys, 0, 0, -PI / 2, 5).emit(g); muzzle(g, 0.95 * k, 0, 0);
  }
  UNIT.lattice.artillery = (r, m) => {
    piv(r, 0, 0.35, 0, 'bob', { amp: 0.06 });
    B().tp(0.9, 0.3, 0.7, 0.7, 0.8, 0, 0.5, 0, m.hull).rb(0.5, 0.05, 0.72, 0, 0.36, 0, m.team, 0, 0, 0, 0.02).rb(0.4, 0.24, 0.4, -0.22, 0.75, 0, m.hull2).emit(r);
    const t = piv(r, 0, 0.75, 0, 'turret'); B(0.9).cr(0.24, 0.9, 0, 0, 0, m.crys, 0, 0, 0, 6).to(0.32, 0.04, 0, 0.3, 0, m.trim, PI / 2, 0, 0).to(0.4, 0.03, 0, 0.6, 0, m.glow, PI / 2, 0, 0).emit(t);
    const g = piv(t, 0.25, 0.5, 0, 'gun'); B(1).cy(0.06, 0.09, 0.9, 0.5, 0, 0, m.trim, 0, 0, PI / 2, 8).to(0.16, 0.035, 0.95, 0, 0, m.glow, 0, PI / 2, 0).emit(g); muzzle(g, 1.0, 0, 0);
    halo(r, m, 0.8, 0.7, 0.5);
  };
  UNIT.lattice.flyer = (r, m) => {
    piv(r, 0, 0.3, 0, 'bob', { amp: 0.06 });
    B().to(0.55, 0.11, 0, 0.3, 0, m.hull, PI / 2, 0, 0).to(0.42, 0.035, 0, 0.3, 0, m.trim, PI / 2, 0, 0).cr(0.17, 0.5, 0, 0.05, 0, m.crys, 0, 0, 0, 6).rb(0.3, 0.04, 0.3, 0, 0.14, 0, m.team, 0, 0, 0, 0.02).emit(r);
    const rn = piv(r, 0, 0.3, 0, 'spin', { rate: 1.2 }); B().cr(0.07, 0.3, 0.7, 0, 0, m.crys, 0, 0, -PI / 2, 4).cr(0.07, 0.3, -0.35, 0, 0.6, m.crys, 0, 2.1, -PI / 2, 4).cr(0.07, 0.3, -0.35, 0, -0.6, m.crys, 0, -2.1, -PI / 2, 4).emit(rn);
    const g = piv(r, 0.55, 0.3, 0, 'gun'); muzzle(g, 0.3, 0, 0);
  };

  /* ================================================================ structures */
  const BLD = {};
  const slab = (g, m, s, mat) => { B().rb(s * 0.98, 0.26, s * 0.98, 0, 0.13, 0, mat || m.dark, 0, 0, 0, 0.08).emit(g); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach((c) => B().rb(0.28, 0.3, 0.28, c[0] * s * 0.44, 0.32, c[1] * s * 0.44, m.team, 0, 0, 0, 0.05).emit(g)); };
  const tNode = (parent, x, y, z) => { const t = piv(parent, x, y, z, 'turret'); const g = piv(t, 0.1, 0.1, 0, 'gun'); return { t, g }; };
  const L3 = (root) => [grp(root, 'L1', 1), grp(root, 'L2', 2), grp(root, 'L3', 3)];
  BLD.vanguard = (m, role, s) => {
    const root = new T.Group(), [a, b, c] = L3(root); slab(a, m, s);
    const h = s * 0.42;
    switch (role) {
      case 'hq':
        B().tp(s * 0.72, 1.0, s * 0.72, 0.9, 0.9, 0, 0.8, 0, m.hull).rb(s * 0.78, 0.16, s * 0.78, 0, 0.32, 0, m.hull2).emit(a);
        B().tp(s * 0.5, 1.1, s * 0.5, 0.78, 0.78, 0, 1.85, 0, m.hull2).rb(s * 0.54, 0.14, s * 0.54, 0, 1.3, 0, m.team).rb(s * 0.4, 0.4, 0.06, 0, 1.9, s * 0.26, m.glass).rb(0.06, 0.4, s * 0.4, s * 0.26, 1.9, 0, m.glass).emit(b);
        B().cy(0.05, 0.05, 1.2, 0, 3.25, 0, m.dark, 0, 0, 0, 6).dm(0.6, 0.3, 0.6, s * 0.16, 2.55, s * 0.16, m.hull, PI, 0, 0.5).rb(s * 0.3, 0.16, s * 0.3, 0, 2.5, 0, m.trim).cy(0.09, 0.09, 0.05, 0, 3.85, 0, m.glow, 0, 0, 0, 6).emit(c);
        [[1, 1], [-1, -1]].forEach((q) => B().cy(0.13, 0.15, 0.7, q[0] * s * 0.36, 0.8, q[1] * s * 0.36, m.dark, 0, 0, 0, 8).cy(0.15, 0.15, 0.08, q[0] * s * 0.36, 1.18, q[1] * s * 0.36, m.glow, 0, 0, 0, 8).emit(b));
        const sp = piv(c, s * 0.16, 2.9, s * 0.16, 'spin', { rate: 0.8 }); B().rb(0.6, 0.04, 0.04, 0, 0, 0, m.trim).emit(sp); break;
      case 'supply':
        B().rb(s * 0.6, 0.7, s * 0.86, -s * 0.12, 0.62, 0, m.hull, 0, 0, 0, 0.06).rb(s * 0.6, 0.06, s * 0.9, -s * 0.12, 0.98, 0, m.team).emit(a);
        B().rb(s * 0.5, 0.6, s * 0.8, s * 0.16, 1.22, 0, m.hull2, 0, 0, 0, 0.06).rb(s * 0.5, 0.05, s * 0.84, s * 0.16, 1.55, 0, m.trim).emit(b);
        B().cy(0.08, 0.08, 0.4, -s * 0.2, 1.2, s * 0.2, m.dark, 0, 0, 0, 6).cy(0.14, 0.14, 0.05, -s * 0.2, 1.42, s * 0.2, m.glow, 0, 0, 0, 8).emit(c); break;
      case 'dropoff':
        B().cy(s * 0.22, s * 0.25, 1.4, -s * 0.2, 0.9, -s * 0.16, m.hull, 0, 0, 0, 16).cy(s * 0.24, s * 0.24, 0.1, -s * 0.2, 1.62, -s * 0.16, m.trim, 0, 0, 0, 16).cy(s * 0.2, s * 0.22, 1.1, s * 0.22, 0.75, s * 0.18, m.hull2, 0, 0, 0, 16).emit(a);
        B().tb([[-s * 0.2, 1.4, -s * 0.16], [0, 1.9, 0], [s * 0.22, 1.3, s * 0.18]], 0.09, m.dark, 12).cy(s * 0.1, s * 0.13, 0.9, s * 0.42, 0.6, -s * 0.3, m.dark, 0, 0, 0, 10).sp(0.35, 0.16, 0.35, s * 0.22, 1.32, s * 0.18, m.glow).emit(b);
        B().cy(0.08, 0.1, 1.5, s * 0.42, 1.5, -s * 0.3, m.dark, 0, 0, 0, 8).cy(0.13, 0.13, 0.05, s * 0.42, 2.28, -s * 0.3, m.glow, 0, 0, 0, 8).emit(c); break;
      case 'barracks':
        B().rb(s * 0.9, 0.9, s * 0.62, 0, 0.7, 0, m.hull, 0, 0, 0, 0.08).rb(s * 0.5, 0.6, 0.06, s * 0.1, 0.55, s * 0.32, m.glow).emit(a);
        B().tp(s * 0.94, 0.5, s * 0.68, 1, 0.5, 0, 1.4, 0, m.hull2).rb(s * 0.96, 0.05, s * 0.1, 0, 1.16, s * 0.32, m.team).emit(b);
        B().cy(0.03, 0.03, 1.1, -s * 0.36, 2.2, -s * 0.2, m.dark, 0, 0, 0, 5).rb(0.4, 0.26, 0.03, -s * 0.36 + 0.22, 2.55, -s * 0.2, m.team).rb(0.5, 0.15, 0.5, s * 0.3, 1.8, -s * 0.16, m.trim).emit(c); break;
      case 'factory':
        B().rb(s * 0.9, 1.0, s * 0.76, 0, 0.78, 0, m.hull, 0, 0, 0, 0.1).rb(s * 0.5, 0.7, 0.06, 0, 0.6, s * 0.38, m.dark).rb(s * 0.36, 0.06, 0.07, 0, 0.98, s * 0.38, m.glow).emit(a);
        for (let i = 0; i < 3; i++) B().tp(s * 0.3, 0.6, s * 0.76, 0.2, 1, (i - 1) * s * 0.3, 1.6, 0, m.hull2, 0, 0, 0, 0.2).emit(b);
        B().cy(0.14, 0.18, 1.4, s * 0.34, 2.2, -s * 0.28, m.dark, 0, 0, 0, 10).cy(0.18, 0.18, 0.06, s * 0.34, 2.9, -s * 0.28, m.glow, 0, 0, 0, 10).rb(s * 0.8, 0.12, 0.14, 0, 2.3, s * 0.3, m.trim).emit(c);
        const cr = piv(c, 0, 2.3, s * 0.3, 'spin', { rate: 0.3, axis: 'y' }); B().rb(0.06, 0.5, 0.06, 0, -0.25, 0, m.dark).emit(cr); break;
      case 'airfield':
        B().rb(s * 0.96, 0.08, s * 0.7, 0, 0.3, s * 0.06, m.hull2, 0, 0, 0, 0.02).rb(s * 0.8, 0.04, 0.12, 0, 0.36, s * 0.06, m.glow).rb(s * 0.32, 0.9, s * 0.28, -s * 0.3, 0.75, -s * 0.28, m.hull).emit(a);
        B().rb(s * 0.36, 0.34, s * 0.32, -s * 0.3, 1.36, -s * 0.28, m.glass).cy(0.04, 0.04, 0.9, -s * 0.3, 2.0, -s * 0.28, m.dark, 0, 0, 0, 5).emit(b);
        const rd = piv(c, -s * 0.3, 1.7, -s * 0.28, 'spin', { rate: 1.5 }); B().rb(0.5, 0.04, 0.05, 0, 0, 0, m.trim).emit(rd); break;
      case 'lab':
        B().rb(s * 0.78, 0.7, s * 0.78, 0, 0.62, 0, m.hull, 0, 0, 0, 0.1).emit(a);
        B().dm(s * 0.34, 0.45, s * 0.34, 0, 0.98, 0, m.glass).cy(s * 0.36, s * 0.36, 0.08, 0, 0.98, 0, m.trim, 0, 0, 0, 16).rb(s * 0.8, 0.05, s * 0.8, 0, 0.98, 0, m.team, 0, 0, 0, 0.02).emit(b);
        B().cy(0.03, 0.03, 0.9, s * 0.3, 1.6, s * 0.3, m.dark, 0, 0, 0, 5).emit(c); const dsh = piv(c, -s * 0.28, 1.2, -s * 0.28, 'spin', { rate: 0.5 }); B().dm(0.4, 0.2, 0.4, 0, 0, 0, m.hull2, PI * 0.8, 0, 0).cy(0.03, 0.03, 0.3, 0, 0.1, 0, m.trim, 0, 0, 0, 5).emit(dsh); break;
      case 'turret': case 'aaturret': {
        B().cy(s * 0.34, s * 0.4, 0.5, 0, 0.5, 0, m.hull2, 0, 0, 0, 14).cy(s * 0.36, s * 0.36, 0.06, 0, 0.78, 0, m.trim, 0, 0, 0, 14).emit(a);
        const tn = tNode(b, 0, 1.1, 0); B(1).tp(s * 0.56, 0.44, s * 0.56, 0.86, 0.9, 0, 0.1, 0, m.hull).rb(s * 0.3, 0.1, s * 0.6, 0, 0.36, 0, m.team).emit(tn.t);
        if (role === 'turret') { B(1).cy(0.09, 0.09, 1.0, 0.6, 0, 0, m.dark, 0, 0, PI / 2, 10).cy(0.14, 0.14, 0.3, 0.2, 0, 0, m.trim, 0, 0, PI / 2, 10).emit(tn.g); muzzle(tn.g, 1.15, 0, 0); }
        else { B(1).rb(0.4, 0.3, 0.5, 0.2, 0, 0, m.dark).cy(0.045, 0.045, 0.7, 0.55, 0.1, 0.14, m.trim, 0, 0, PI / 2, 8).cy(0.045, 0.045, 0.7, 0.55, 0.1, -0.14, m.trim, 0, 0, PI / 2, 8).cy(0.045, 0.045, 0.7, 0.55, -0.1, 0.14, m.trim, 0, 0, PI / 2, 8).cy(0.045, 0.045, 0.7, 0.55, -0.1, -0.14, m.trim, 0, 0, PI / 2, 8).emit(tn.g); muzzle(tn.g, 0.9, 0, 0); }
        break; }
      default: B().rb(s * 0.8, 1, s * 0.8, 0, 0.7, 0, m.hull).emit(a);
    }
    return root;
  };
  BLD.brood = (m, role, s) => {
    const root = new T.Group(), [a, b, c] = L3(root);
    B().sp(s * 0.5, 0.28, s * 0.5, 0, 0.1, 0, m.hull2).sp(s * 0.42, 0.14, s * 0.42, 0, 0.2, 0, m.dark).emit(a);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach((q, i) => B().cn(0.14, 0.6 + (i % 2) * 0.2, q[0] * s * 0.44, 0.4, q[1] * s * 0.44, m.trim, q[1] * 0.2, 0, -q[0] * 0.2, 6).emit(a));
    const ribs = (parent, R, y, n) => { for (let i = 0; i < n; i++) { const an = (i / n) * PI * 2; B().tb([[Math.cos(an) * R, y - 0.6, Math.sin(an) * R], [Math.cos(an) * R * 0.75, y + 0.2, Math.sin(an) * R * 0.75], [Math.cos(an) * R * 0.3, y + 0.6, Math.sin(an) * R * 0.3]], 0.07, m.trim, 8, 0.4).emit(parent); } };
    switch (role) {
      case 'hq':
        B().sp(s * 0.42, 0.9, s * 0.42, 0, 0.95, 0, m.hull).emit(a); B().sp(s * 0.3, 0.8, s * 0.3, 0, 1.9, 0, m.hull2).sp(s * 0.16, 0.5, s * 0.16, 0, 2.6, 0, m.flesh).emit(b); ribs(b, s * 0.4, 1.4, 8);
        const pu = piv(c, 0, 2.65, 0, 'pulse', { amp: 0.12 }); B().sp(0.5, 0.5, 0.5, 0, 0, 0, m.glow).sp(0.7, 0.7, 0.7, 0, 0, 0, m.glass).emit(pu); B().rb(s * 0.6, 0.06, s * 0.6, 0, 0.38, 0, m.team, 0, 0, 0, 0.02).emit(c);
        for (let i = 0; i < 5; i++) B().tb([[Math.cos(i * 1.26) * s * 0.4, 0.4, Math.sin(i * 1.26) * s * 0.4], [Math.cos(i * 1.26) * s * 0.7, 1.4, Math.sin(i * 1.26) * s * 0.6], [Math.cos(i * 1.26) * s * 0.9, 0.3, Math.sin(i * 1.26) * s * 0.8]], 0.08, m.hull2, 10, 0.6).emit(c); break;
      case 'supply':
        B().sp(s * 0.32, 0.55, s * 0.32, -s * 0.16, 0.6, 0, m.flesh).sp(s * 0.26, 0.5, s * 0.26, s * 0.2, 0.5, s * 0.1, m.hull).emit(a); B().sp(0.12, 0.12, 0.12, -s * 0.16, 1.2, 0, m.glow).emit(b); ribs(b, s * 0.3, 0.9, 5); B().cn(0.1, 0.5, s * 0.3, 0.9, -s * 0.2, m.trim, 0, 0, -0.3, 5).emit(c); break;
      case 'dropoff':
        B().sp(s * 0.36, 0.5, s * 0.36, 0, 0.5, 0, m.hull2).to(s * 0.3, 0.1, 0, 0.9, 0, m.trim, PI / 2, 0, 0).sp(s * 0.22, 0.14, s * 0.22, 0, 0.95, 0, m.glow).emit(a); B().tb([[s * 0.3, 0.6, 0], [s * 0.5, 1.2, s * 0.2], [s * 0.4, 1.8, s * 0.1]], 0.12, m.hull, 10, 0.5).emit(b); ribs(c, s * 0.3, 1.2, 6); break;
      case 'barracks':
        B().sp(s * 0.5, 0.7, s * 0.4, 0, 0.7, 0, m.hull).sp(s * 0.12, 0.3, s * 0.16, s * 0.3, 0.55, s * 0.28, m.dark).emit(a); B().sp(s * 0.36, 0.5, s * 0.3, -s * 0.06, 1.25, 0, m.hull2).sp(0.1, 0.1, 0.1, s * 0.34, 0.55, s * 0.32, m.glow).emit(b); ribs(b, s * 0.34, 1.2, 6);
        for (let i = 0; i < 4; i++) B().cn(0.1, 0.7, (i - 1.5) * s * 0.2, 1.75, 0, m.trim, 0, 0, (i - 1.5) * 0.12, 6).emit(c); break;
      case 'factory':
        B().sp(s * 0.5, 0.9, s * 0.46, 0, 0.85, 0, m.hull).sp(s * 0.14, 0.4, s * 0.16, s * 0.4, 0.6, 0, m.dark).emit(a); B().sp(s * 0.36, 0.7, s * 0.36, -s * 0.06, 1.6, 0, m.hull2).sp(0.16, 0.16, 0.16, s * 0.42, 0.7, 0, m.glow).emit(b); ribs(b, s * 0.4, 1.6, 8);
        for (let i = 0; i < 6; i++) B().cn(0.09, 0.9, Math.cos(i * 1.05) * s * 0.3, 2.3, Math.sin(i * 1.05) * s * 0.3, m.trim, 0, 0, 0.15, 6).emit(c); B().sp(0.3, 0.3, 0.3, 0, 2.2, 0, m.flesh).emit(c); break;
      case 'airfield':
        B().sp(s * 0.46, 0.22, s * 0.46, 0, 0.35, 0, m.hull2).emit(a); B().tb([[-s * 0.3, 0.3, -s * 0.2], [-s * 0.34, 1.6, -s * 0.2], [-s * 0.1, 2.6, 0]], 0.2, m.hull, 12, 0.6).tb([[s * 0.3, 0.3, s * 0.2], [s * 0.34, 1.4, s * 0.2], [s * 0.1, 2.3, 0]], 0.18, m.hull2, 12, 0.6).emit(b); B().sp(0.3, 0.16, 0.3, -s * 0.1, 2.7, 0, m.flesh).cn(0.3, 0.5, 0, 0.4, 0, m.trim, 0, 0, 0, 5).emit(c); break;
      case 'lab':
        B().sp(s * 0.4, 0.5, s * 0.4, 0, 0.55, 0, m.hull).emit(a); B().sp(s * 0.28, 0.9, s * 0.28, 0, 1.3, 0, m.hull2).emit(b); B().cr(0.25, 1.4, 0, 1.6, 0, m.glass, 0, 0, 0, 5).cn(0.1, 0.5, s * 0.3, 0.9, s * 0.1, m.trim, 0, 0, -0.3, 5).emit(c); const sp2 = piv(c, 0, 2.6, 0, 'spin', { rate: 0.7 }); B().sp(0.12, 0.12, 0.12, 0.5, 0, 0, m.glow).sp(0.12, 0.12, 0.12, -0.5, 0, 0, m.glow).emit(sp2); break;
      case 'turret': case 'aaturret': {
        B().cn(s * 0.4, 0.9, 0, 0.55, 0, m.hull2, 0, 0, 0, 8).emit(a); const tn = tNode(b, 0, 1.1, 0); B(1).sp(0.3, 0.25, 0.3, 0, 0, 0, m.hull).emit(tn.t);
        if (role === 'turret') { B(1).tb([[0, 0, 0], [0.4, 0.05, 0], [0.9, 0, 0]], 0.1, m.trim, 8, 0.4).emit(tn.g); muzzle(tn.g, 0.95, 0, 0); }
        else { B(1).sp(0.22, 0.2, 0.2, 0.15, 0.1, 0, m.flesh).tb([[0.1, 0.1, 0.1], [0.4, 0.3, 0.1], [0.7, 0.6, 0.1]], 0.08, m.trim, 8, 0.3).tb([[0.1, 0.1, -0.1], [0.4, 0.3, -0.1], [0.7, 0.6, -0.1]], 0.08, m.trim, 8, 0.3).emit(tn.g); muzzle(tn.g, 0.7, 0.6, 0); }
        break; }
      default: B().sp(s * 0.4, 0.8, s * 0.4, 0, 0.7, 0, m.hull).emit(a);
    }
    return root;
  };
  BLD.lattice = (m, role, s) => {
    const root = new T.Group(), [a, b, c] = L3(root);
    B().rb(s * 0.96, 0.24, s * 0.96, 0, 0.12, 0, m.hull2, 0, 0, 0, 0.1).rb(s * 0.8, 0.08, s * 0.8, 0, 0.27, 0, m.trim, 0, 0, 0, 0.03).emit(a);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach((q) => B().cr(0.12, 0.6, q[0] * s * 0.44, 0.3, q[1] * s * 0.44, m.crys, 0, 0, 0, 4).rb(0.2, 0.08, 0.2, q[0] * s * 0.44, 0.3, q[1] * s * 0.44, m.team).emit(a));
    const floaters = (parent, R, y, n, rate) => { const d = piv(parent, 0, y, 0, 'spin', { rate: rate || 0.5 }); for (let i = 0; i < n; i++) { const an = (i / n) * PI * 2; B().cr(0.1, 0.42, Math.cos(an) * R, 0, Math.sin(an) * R, m.crys, 0, 0, 0, 5).emit(d); } B().to(R, 0.03, 0, 0, 0, m.trim, PI / 2, 0, 0).emit(d); };
    switch (role) {
      case 'hq':
        B().tp(s * 0.62, 1.2, s * 0.62, 0.7, 0.7, 0, 0.9, 0, m.hull, 0, 0, 0, 0).rb(s * 0.68, 0.14, s * 0.68, 0, 0.34, 0, m.team).emit(a);
        B().tp(s * 0.4, 1.4, s * 0.4, 0.5, 0.5, 0, 2.1, 0, m.hull2).rb(s * 0.44, 0.1, s * 0.44, 0, 1.55, 0, m.trim).emit(b);
        B().cr(0.5, 2.2, 0, 3.0, 0, m.crys, 0, 0, 0, 6).emit(c); floaters(c, s * 0.42, 3.2, 6, 0.4); const pu = piv(c, 0, 3.4, 0, 'pulse', { amp: 0.1 }); B().sp(0.3, 0.3, 0.3, 0, 0, 0, m.glow).emit(pu); break;
      case 'supply':
        B().cr(0.28, 1.6, -s * 0.14, 0.3, 0, m.hull, 0, 0, 0, 6).cr(0.22, 1.2, s * 0.2, 0.3, s * 0.1, m.hull2, 0, 0, 0, 6).emit(a); B().cr(0.14, 0.9, -s * 0.14, 1.5, 0, m.crys, 0, 0, 0, 5).rb(0.4, 0.06, 0.4, -s * 0.14, 0.9, 0, m.trim).emit(b); floaters(c, s * 0.3, 1.7, 3, 0.7); break;
      case 'dropoff':
        B().cy(s * 0.2, s * 0.3, 0.9, 0, 0.7, 0, m.hull, 0, 0, 0, 8).to(s * 0.28, 0.06, 0, 1.2, 0, m.trim, PI / 2, 0, 0).emit(a); B().cr(0.3, 1.5, 0, 1.3, 0, m.crys, 0, 0, 0, 6).emit(b); floaters(c, s * 0.36, 1.9, 4, 0.9); break;
      case 'barracks':
        B().rb(s * 0.78, 0.5, s * 0.6, 0, 0.55, 0, m.hull, 0, 0, 0, 0.1).emit(a); B().tp(s * 0.62, 0.7, s * 0.5, 0.6, 0.7, 0, 1.15, 0, m.hull2).rb(s * 0.2, 0.5, 0.05, 0, 0.6, s * 0.31, m.glow).emit(b); B().cr(0.2, 1.1, 0, 1.9, 0, m.crys, 0, 0, 0, 5).emit(c); floaters(c, s * 0.34, 2.1, 3, 0.8); break;
      case 'factory':
        B().rb(s * 0.86, 0.7, s * 0.7, 0, 0.7, 0, m.hull, 0, 0, 0, 0.1).emit(a); B().tp(s * 0.7, 0.8, s * 0.6, 0.7, 0.7, 0, 1.4, 0, m.hull2).to(s * 0.22, 0.06, 0, 1.85, 0, m.glow, PI / 2, 0, 0).emit(b);
        B().cr(0.3, 1.5, 0, 2.2, 0, m.crys, 0, 0, 0, 6).emit(c); floaters(c, s * 0.4, 2.6, 5, 0.5); const r2 = piv(c, 0, 1.9, 0, 'spin', { rate: 1 }); B().to(s * 0.3, 0.05, 0, 0, 0, m.trim, PI / 2, 0, 0).emit(r2); break;
      case 'airfield':
        B().rb(s * 0.9, 0.1, s * 0.9, 0, 0.32, 0, m.hull, 0, 0, 0, 0.05).to(s * 0.32, 0.05, 0, 0.4, 0, m.glow, PI / 2, 0, 0).emit(a); B().cr(0.1, 1.4, s * 0.38, 0.4, s * 0.38, m.crys, 0, 0, 0, 4).cr(0.1, 1.4, -s * 0.38, 0.4, -s * 0.38, m.crys, 0, 0, 0, 4).emit(b); floaters(c, s * 0.3, 1.8, 3, 1.1); break;
      case 'lab':
        B().rb(s * 0.6, 0.5, s * 0.6, 0, 0.5, 0, m.hull, 0, 0, 0, 0.1).emit(a); B().cr(0.32, 1.6, 0, 1.0, 0, m.crys, 0, 0, 0, 6).emit(b); B().to(s * 0.3, 0.05, 0, 1.5, 0, m.trim, PI / 2, 0.3, 0).emit(b); floaters(c, s * 0.34, 2.2, 5, 0.6); break;
      case 'turret': case 'aaturret': {
        B().cy(s * 0.3, s * 0.36, 0.6, 0, 0.55, 0, m.hull2, 0, 0, 0, 10).emit(a); const tn = tNode(b, 0, 1.1, 0); B(1).sp(0.3, 0.22, 0.3, 0, 0, 0, m.hull).emit(tn.t);
        if (role === 'turret') { B(1).cy(0.05, 0.07, 0.8, 0.4, 0, 0, m.trim, 0, 0, PI / 2, 8).cr(0.08, 0.4, 0.8, 0, 0, m.crys, 0, 0, -PI / 2, 5).emit(tn.g); muzzle(tn.g, 1.2, 0, 0); }
        else { B(1).to(0.2, 0.04, 0.3, 0, 0, m.glow, 0, PI / 2, 0).to(0.16, 0.04, 0.5, 0, 0, m.glow, 0, PI / 2, 0).cr(0.06, 0.6, 0.6, 0, 0, m.crys, 0, 0, -PI / 2, 5).emit(tn.g); muzzle(tn.g, 1.0, 0, 0); }
        break; }
      default: B().rb(s * 0.8, 1, s * 0.8, 0, 0.7, 0, m.hull).emit(a);
    }
    return root;
  };

  /* ================================================================ finishing: rig discovery, baked LOD */
  const tplCache = {}, lodMats = {};
  function lodMat(fid, kind) {
    const key = fid + kind; if (lodMats[key]) return lodMats[key];
    const mat = kind === 'glow' ? M.fogify(new T.MeshBasicMaterial({ vertexColors: true })) : M.fogify(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }));
    return (lodMats[key] = mat);
  }
  function bakeLOD(root, fid, owner) {
    root.updateMatrixWorld(true);
    const m = M.mats(fid, owner), buckets = { body: [], glow: [], team: [] };
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const mat = o.material, col = g.attributes.color, c = new T.Color(mat.userData.team ? 0xffffff : (mat.userData.glow ? mat.emissive : mat.color)); if (mat.userData.avg && !mat.userData.glow) c.multiply(mat.userData.avg);
      if (!mat.userData.team) for (let i = 0; i < col.count; i++) col.setXYZ(i, Math.min(1, col.getX(i) * c.r * (mat.userData.glow ? 1 : 1.1)), Math.min(1, col.getY(i) * c.g * (mat.userData.glow ? 1 : 1.1)), Math.min(1, col.getZ(i) * c.b * (mat.userData.glow ? 1 : 1.1)));
      (mat.userData.team ? buckets.team : mat.userData.glow ? buckets.glow : buckets.body).push(g);
    });
    const lod = new T.Group(); lod.name = 'lod'; lod.visible = false;
    [['body', lodMat(fid, 'body')], ['glow', lodMat(fid, 'glow')], ['team', m.team]].forEach((p) => { const list = buckets[p[0]]; if (!list.length) return; const mesh = new T.Mesh(merge(list), p[1]); mesh.castShadow = false; lod.add(mesh); });
    return lod;
  }
  function finish(root) {
    const rig = { legs: [], knees: [], arms: [], guns: [], turrets: [], muzzles: [], spins: [], wings: [], bobs: [], pulses: [], layers: [], hulls: [] };
    (root.userData.full || root).traverse((o) => {
      const r = o.userData && o.userData.rig;
      if (r === 'leg') rig.legs.push(o); else if (r === 'knee') rig.knees.push(o); else if (r === 'arm') rig.arms.push(o); else if (r === 'gun') rig.guns.push(o); else if (r === 'turret') rig.turrets.push(o);
      else if (r === 'muzzle') rig.muzzles.push(o); else if (r === 'spin') rig.spins.push(o); else if (r === 'wing') rig.wings.push(o); else if (r === 'bob') rig.bobs.push(o); else if (r === 'pulse') rig.pulses.push(o); else if (r === 'hull') rig.hulls.push(o);
      if (o.userData && o.userData.layer) rig.layers.push(o);
    });
    rig.guns.forEach((g) => { g.userData.rest = g.position.x; });
    root.userData.rigData = rig;
    return root;
  }
  M.makeUnit = function (fid, role, owner) {
    const key = 'u' + fid + role + owner;
    if (!tplCache[key]) {
      const m = M.mats(fid, owner), full = new T.Group(); full.name = 'full';
      UNIT[fid][role](full, m);
      const root = new T.Group(); root.add(full); root.add(bakeLOD(full, fid, owner));
      root.scale.setScalar(N.unitDef(fid, role).inf ? 1.3 : role === 'flyer' ? 1.1 : 1.15); // readability at RTS camera distance
      tplCache[key] = root;
    }
    const c = tplCache[key].clone(true); c.userData.full = c.getObjectByName('full'); c.userData.lod = c.getObjectByName('lod');
    return finish(c);
  };
  M.makeBuilding = function (fid, role, owner, size) {
    const key = 'b' + fid + role + owner;
    if (!tplCache[key]) {
      const full = BLD[fid](M.mats(fid, owner), role, size); full.name = 'full';
      const root = new T.Group(); root.add(full); root.add(bakeLOD(full, fid, owner));
      tplCache[key] = root;
    }
    const c = tplCache[key].clone(true); c.userData.full = c.getObjectByName('full'); c.userData.lod = c.getObjectByName('lod');
    return finish(c);
  };

  /* ================================================================ strategic sites, deposits, landmarks */
  const siteMats = {};
  function siteMat(name, o) { return siteMats[name] || (siteMats[name] = std(o)); }
  M.siteTeamMats = []; // per-site material clones are made by the renderer (colour follows ownership)
  M.makeSite = function (kind, teamMat) {
    const root = new T.Group(), a = grp(root, 'L1', 1);
    const stone = siteMat('stone', { color: 0xbcb6c4, roughness: 0.62, metalness: 0.25, map: sharedFor('vanguard').hull.map, bumpMap: sharedFor('vanguard').hull.bumpMap, bumpScale: 1.2 }), dark = siteMat('sdark', { color: 0x23262e, roughness: 0.6, metalness: 0.5 }), gold = siteMat('gold', { color: 0xe6c060, roughness: 0.25, metalness: 0.9 });
    const glow = siteMat('sglow', { color: 0xbfefff, emissive: 0x66d9ff, emissiveIntensity: 1.5 }); glow.userData.noAO = true;
    B().to(3.0, 0.16, 0, 0.14, 0, stone, PI / 2, 0, 0).cy(2.5, 2.7, 0.3, 0, 0.15, 0, dark, 0, 0, 0, 24).emit(a);
    for (let i = 0; i < 8; i++) { const an = (i / 8) * PI * 2; B().rb(0.5, 0.18, 0.7, Math.cos(an) * 2.65, 0.32, Math.sin(an) * 2.65, gold, 0, -an, 0, 0.05).emit(a); }
    B().rb(4.4, 0.06, 0.4, 0, 0.32, 0, teamMat, 0, 0, 0, 0.02).rb(0.4, 0.06, 4.4, 0, 0.32, 0, teamMat, 0, 0, 0, 0.02).emit(a);
    if (kind === 'radar') {
      B().tp(1.0, 4.4, 1.0, 0.35, 0.35, 0, 2.4, 0, stone).rb(1.3, 0.3, 1.3, 0, 0.55, 0, dark).rb(0.8, 0.18, 0.8, 0, 4.7, 0, gold).emit(a);
      const dish = piv(root, 0, 4.9, 0, 'spin', { rate: 0.5 }); B().dm(1.5, 0.75, 1.5, 0, 0, 0, stone, -1.0, 0, 0).cy(0.05, 0.05, 1.0, 0, 0.5, 0, gold, -1.0, 0, 0, 6).sp(0.12, 0.12, 0.12, 0, 0.98, -0.45, glow).emit(dish);
      const sc = piv(root, 0, 5.6, 0, 'pulse', { amp: 0.12 }); B().sp(0.18, 0.18, 0.18, 0, 0, 0, glow).emit(sc);
    } else if (kind === 'foundry') {
      B().rb(2.6, 1.2, 2.2, 0, 0.95, 0, stone, 0, 0, 0, 0.12).rb(2.0, 0.4, 1.8, 0, 1.75, 0, dark).cy(0.24, 0.3, 2.0, -0.9, 2.5, -0.6, dark, 0, 0, 0, 10).cy(0.3, 0.3, 0.08, -0.9, 3.52, -0.6, glow, 0, 0, 0, 10).rb(2.2, 0.16, 0.16, 0, 3.0, 0.9, gold).rb(0.16, 1.2, 0.16, 1.1, 2.4, 0.9, gold).rb(0.16, 1.2, 0.16, -1.1, 2.4, 0.9, gold).sp(0.9, 0.16, 0.7, 0.3, 1.94, 0, glow).emit(a);
      const arm = piv(root, 0, 3.0, 0.9, 'spin', { rate: 0.4 }); B().rb(0.1, 1.3, 0.1, 0, -0.65, 0, dark).rb(0.5, 0.2, 0.3, 0, -1.3, 0, gold).emit(arm);
      const sc = piv(root, 0.3, 2.1, 0, 'pulse', { amp: 0.08 }); B().sp(0.6, 0.1, 0.5, 0, 0, 0, glow).emit(sc);
    } else {
      B().to(2.0, 0.22, 0, 2.3, 0, stone, 0, 0, 0).to(1.5, 0.12, 0, 2.3, 0, gold, 0, 0, 0).rb(0.5, 2.6, 0.7, -2.0, 1.4, 0, stone, 0, 0, 0, 0.1).rb(0.5, 2.6, 0.7, 2.0, 1.4, 0, stone, 0, 0, 0, 0.1).rb(0.8, 0.4, 1.0, 0, 0.5, 0, dark).emit(a);
      const core = piv(root, 0, 2.3, 0, 'pulse', { amp: 0.15 }); B().cr(0.5, 1.4, 0, -0.7, 0, glow, 0, 0, 0, 6).emit(core);
      const r1 = piv(root, 0, 2.3, 0, 'spin', { rate: 0.9, axis: 'z' }); B().to(1.2, 0.05, 0, 0, 0, gold, 0, 0, 0).cr(0.1, 0.4, 1.2, 0, 0, glow, 0, 0, -PI / 2, 4).cr(0.1, 0.4, -1.2, 0, 0, glow, 0, 0, PI / 2, 4).emit(r1);
    }
    root.userData.rigData = { legs: [], knees: [], arms: [], guns: [], turrets: [], muzzles: [], spins: [], wings: [], bobs: [], pulses: [], layers: [], hulls: [] };
    root.traverse((o) => { const r = o.userData && o.userData.rig; if (r === 'spin') root.userData.rigData.spins.push(o); else if (r === 'pulse') root.userData.rigData.pulses.push(o); });
    return root;
  };
  M.makeDeposit = function (amountFrac) {
    const g = new T.Group(), rock = siteMat('drock', { color: 0x4b4a55, roughness: 0.9, metalness: 0.1 }), cry = siteMat('dcry', { color: 0x7fe8ff, emissive: 0x1a9fd0, emissiveIntensity: 1.25, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.93 });
    cry.userData.noAO = true;
    const b = B(); [[0, 0, 1.3], [0.5, 0.3, 0.9], [-0.5, 0.4, 0.8], [0.1, -0.5, 0.7], [-0.4, -0.3, 0.6]].forEach((p, i) => b.cr(0.34 - i * 0.03, p[2] * 1.5, p[0], 0, p[1], cry, (i % 2 ? 0.2 : -0.2), i, (i - 2) * 0.18, 5));
    for (let i = 0; i < 6; i++) b.sp(0.34, 0.2, 0.3, Math.cos(i * 1.05) * 0.9, 0.08, Math.sin(i * 1.05) * 0.9, rock, i, i * 2, 0);
    b.emit(g); return g;
  };
  M.landmark = function (kind, rnd) {
    const g = new T.Group(), th = kind, stone = siteMat('lstone', { color: 0xa9a2c0, roughness: 0.75, metalness: 0.1, map: sharedFor('lattice').hull.map, bumpMap: sharedFor('lattice').hull.bumpMap, bumpScale: 1, uvs: 0.5 }), metal = siteMat('lmetal', { color: 0x8a939c, roughness: 0.6, metalness: 0.6, map: sharedFor('vanguard').hull.map, bumpMap: sharedFor('vanguard').hull.bumpMap, bumpScale: 1, uvs: 0.4 }), rockm = siteMat('lrock', { color: 0x8a7468, roughness: 0.95, metalness: 0.02 }), crys = siteMat('lcrys', { color: 0xb8a4ff, emissive: 0x6a4bff, emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.9 }); crys.userData.noAO = true;
    const b = B();
    if (th === 'arch') { b.rb(0.9, 3.6, 0.9, -1.6, 1.8, 0, stone, 0, 0, 0.04, 0.1).rb(0.9, 2.4, 0.9, 1.6, 1.2, 0, stone, 0, 0, -0.05, 0.1).rb(3.6, 0.7, 0.9, -0.2, 3.6, 0, stone, 0, 0, 0.12, 0.1).rb(0.6, 0.3, 0.6, 1.9, 0.15, 1.0, stone, 0.3, 0.5, 0, 0.08); }
    else if (th === 'obelisk') { b.tp(0.9, 4.6, 0.9, 0.5, 0.5, 0, 2.3, 0, stone, 0, 0, 0.05).cn(0.62, 0.9, 0, 4.9, 0, stone, 0, 0.8, 0, 4).rb(1.4, 0.3, 1.4, 0, 0.15, 0, stone).rb(0.5, 0.3, 0.5, 1.2, 0.15, 0.6, stone, 0, 0.6, 0); }
    else if (th === 'hullrib') { for (let i = 0; i < 5; i++) b.rb(0.3, 3.4 - Math.abs(i - 2) * 0.5, 0.3, i * 1.0 - 2, 1.6, 0, metal, 0, 0, (i - 2) * 0.08, 0.06); b.rb(5.4, 0.25, 0.3, 0, 3.4, 0, metal).rb(5.4, 0.2, 0.3, 0, 0.6, 0, metal).tb([[-2.3, 3.2, 0.2], [0, 2.4, 0.9], [2.2, 3.0, 0.3]], 0.12, metal, 10); }
    else if (th === 'spire') { for (let i = 0; i < 6; i++) b.cr(0.5 - i * 0.05, 2.2 + rnd() * 2.6, Math.cos(i * 1.2) * 0.9, 0, Math.sin(i * 1.2) * 0.9, crys, (rnd() - 0.5) * 0.4, i, (rnd() - 0.5) * 0.4, 5); b.sp(1.2, 0.35, 1.2, 0, 0.1, 0, rockm); }
    else { for (let i = 0; i < 7; i++) b.sp(0.7 + rnd() * 0.7, 0.5 + rnd() * 0.9, 0.7 + rnd() * 0.6, (rnd() - 0.5) * 2.2, 0.3, (rnd() - 0.5) * 2.2, rockm, rnd(), rnd() * 3, rnd()); b.cn(0.3, 1.6, 0.2, 1.0, 0, rockm, 0.1, 0, 0.1, 5); }
    b.emit(g); return g;
  };
  M.depositMat = null;
  M.makeDepositMat = () => siteMat('dcry', { color: 0x7fe8ff, emissive: 0x1a9fd0, emissiveIntensity: 1.25, roughness: 0.08, transparent: true, opacity: 0.93 });
  M.G = { box: new T.BoxGeometry(1, 1, 1), sph: sphG, oct: new T.OctahedronGeometry(1, 0) };
  M.kit = { B, piv, grp, std, merge, sharedFor };
})();
