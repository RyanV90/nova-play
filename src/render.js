/* Tin Soldiers: Nova - Three.js renderer: terrain, props, entity views, effects (pooled), camera, fog of war, minimap. */
(function () {
  'use strict';
  const N = (globalThis.NOVA = globalThis.NOVA || {});
  const T = globalThis.THREE;
  if (!T) return;
  const M = N.Models;
  const PI = Math.PI;

  const QUALITY = {
    low: { pr: 0.75, shadow: 0, particles: 260, tracers: 32, fx: 30, full: 14, label: 'Low' },
    medium: { pr: 1, shadow: 1024, particles: 700, tracers: 64, fx: 70, full: 44, label: 'Medium' },
    high: { pr: 1.5, shadow: 2048, particles: 1500, tracers: 128, fx: 140, full: 110, label: 'High' },
  };  N.QUALITY = QUALITY;

  /* ------------------------------------------------------------ particle system (one draw call each) */
  function PSys(max, additive) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('col', new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    g.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1).setUsage(T.DynamicDrawUsage));
    this.uScale = { value: 800 };
    const mat = new T.ShaderMaterial({
      uniforms: { uScale: this.uScale }, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
      vertexShader: 'attribute vec3 col; attribute float size; attribute float alpha; uniform float uScale; varying vec3 vc; varying float va; void main(){ vc=col; va=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0,size*uScale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vc; varying float va; void main(){ float d=length(gl_PointCoord-vec2(0.5))*2.0; float a=clamp(1.0-d,0.0,1.0); a=a*a*(3.0-2.0*a); gl_FragColor=vec4(vc*(' + (additive ? 'va' : '1.0') + '), va*a); }',
    });
    this.points = new T.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5;
    this.geo = g; this.active = 0;
    for (let k = 0; k < max; k++) this.pos[k * 3 + 1] = -999;
  }
  PSys.prototype.spawn = function (x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z; this.v[k * 3] = vx; this.v[k * 3 + 1] = vy; this.v[k * 3 + 2] = vz;
    this.life[k] = life; this.maxLife[k] = life; this.s0[k] = s0; this.s1[k] = s1; this.a0[k] = a; this.grav[k] = grav || 0; this.drag[k] = drag || 0;
    this.col[k * 3] = r; this.col[k * 3 + 1] = g; this.col[k * 3 + 2] = b; this.size[k] = s0; this.alpha[k] = a;
  };
  PSys.prototype.update = function (dt) {
    let act = 0;
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; this.pos[k * 3 + 1] = -999; } continue; }
      act++;
      this.life[k] -= dt; const t = 1 - Math.max(0, this.life[k]) / this.maxLife[k];
      const dr = 1 - Math.min(1, this.drag[k] * dt);
      this.v[k * 3] *= dr; this.v[k * 3 + 2] *= dr; this.v[k * 3 + 1] = this.v[k * 3 + 1] * dr - this.grav[k] * dt;
      this.pos[k * 3] += this.v[k * 3] * dt; this.pos[k * 3 + 1] += this.v[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.v[k * 3 + 2] * dt;
      this.size[k] = this.s0[k] + (this.s1[k] - this.s0[k]) * t; this.alpha[k] = this.a0[k] * (1 - t) * (t < 0.1 ? t * 10 : 1);
    }
    this.active = act;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.col.needsUpdate = true; this.geo.attributes.size.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  };

  const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const KIND_COL = { bullet: 0xffe6a0, spine: 0xd6ff70, claw: 0xffb0d0, cannon: 0xffc070, shell: 0xffa050, rocket: 0xffd090, energy: 0x7ff6ff, beam: 0x80fff0, lance: 0xffe680, plasma: 0xb8a0ff, acid: 0xb0ff50, spore: 0xd0ff60, arc: 0x9ad8ff };

  /* ------------------------------------------------------------ renderer */
  N.Renderer = function (canvas, overlayCanvas) {
    const R = this;
    R.canvas = canvas; R.q = QUALITY.medium; R.qname = 'medium';
    R.gl = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    R.gl.shadowMap.enabled = true; R.gl.shadowMap.type = T.PCFSoftShadowMap;
    R.gl.outputEncoding = T.sRGBEncoding; R.gl.toneMapping = T.ACESFilmicToneMapping; R.gl.toneMappingExposure = 1.08;
    R.scene = new T.Scene();
    R.camera = new T.PerspectiveCamera(48, 1, 0.5, 400);
    R.cam = { tx: 48, tz: 48, yaw: 0.8, pitch: 0.95, dist: 24, vtx: 48, vtz: 48 };
    R.views = new Map(); R.dying = []; R.projs = []; R.tracers = []; R.rings = []; R.shields = []; R.pings = [];
    R.stats = { frames: 0, ms: [], dts: [], calls: 0, tris: 0, views: 0, particles: 0 };
    R.raycaster = new T.Raycaster();
    R.hemi = new T.HemisphereLight(0xaab8ff, 0x3a2a20, 0.85); R.sun = new T.DirectionalLight(0xffffff, 1.15);
    R.sun.castShadow = true; R.sun.shadow.camera.left = -42; R.sun.shadow.camera.right = 42; R.sun.shadow.camera.top = 42; R.sun.shadow.camera.bottom = -42; R.sun.shadow.camera.near = 1; R.sun.shadow.camera.far = 160; R.sun.shadow.bias = -0.0006;
    R.fill = new T.DirectionalLight(0x8fb4ff, 0.32); R.scene.add(R.hemi, R.sun, R.sun.target, R.fill);
    R.world = new T.Group(); R.scene.add(R.world);
    R.fxLayer = new T.Group(); R.scene.add(R.fxLayer);
    // shared fx assets
    R.glow = new PSys(QUALITY.high.particles, true); R.smoke = new PSys(QUALITY.high.particles, false);
    R.scene.add(R.glow.points, R.smoke.points);
    R.tracerGeo = new T.BoxGeometry(1, 1, 1); R.ringGeo = new T.RingGeometry(0.86, 1, 40); R.ringGeo.rotateX(-PI / 2);
    R.discGeo = new T.CircleGeometry(1, 28); R.discGeo.rotateX(-PI / 2);
    R.sphGeo = new T.SphereGeometry(1, 14, 10);
    R.addMat = (c, o) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o == null ? 1 : o, blending: T.AdditiveBlending, depthWrite: false });
    R.sel = { own: R.addMat(0x5dff8a, 0.9), enemy: R.addMat(0xff5040, 0.9), hover: R.addMat(0xffffff, 0.55), team: [R.addMat(M.TEAM[0], 0.45), R.addMat(M.TEAM[1], 0.45)] };
    R.ringPool = []; R.ringUsed = 0;
    R.fogData = null;
    R.resize();
    R.setQuality('medium');
  };
  const RP = N.Renderer.prototype;

  RP.setQuality = function (q) {
    if (!QUALITY[q]) q = 'medium';
    this.qname = q; this.q = QUALITY[q];
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.sun.castShadow = this.q.shadow > 0;
    this.shadowUnits = q === 'high'; // Medium: terrain/props/structures cast shadows, units do not (draw-call budget)
    this.views.forEach((v) => { if (v.e.kind === 'unit' && v.obj.userData.full) v.obj.userData.full.traverse((o) => { if (o.isMesh) o.castShadow = this.shadowUnits; }); });
    if (this.q.shadow) { this.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.resize();
  };
  RP.resize = function () {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    const s = (h * this.gl.getPixelRatio()) / (2 * Math.tan((this.camera.fov * PI) / 360));
    this.glow.uScale.value = s; this.smoke.uScale.value = s;
  };

  /* ------------------------------------------------------------ world load */
  RP.disposeWorld = function () {
    this.sky = null; this.siteViews = []; this.blob = null; this.rings = null;
    // GPU buffers of every removed view are released (dispose is reversible: shared model geometries are simply re-uploaded when the next match uses them) - match resets used to grow the geometry count
    this.views.forEach((v) => { if (v.obj.parent) v.obj.parent.remove(v.obj); v.obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); });
    this.views.clear(); this.dying.length = 0; this.projs.forEach((p) => this.fxLayer.remove(p.mesh)); this.projs.length = 0;
    this.tracers.forEach((t) => this.fxLayer.remove(t.mesh)); this.tracers.length = 0;
    this.shields.forEach((s) => this.fxLayer.remove(s.mesh)); this.shields.length = 0;
    this.pings.forEach((s) => this.fxLayer.remove(s.mesh)); this.pings.length = 0;
    this.ringPool.forEach((r) => this.fxLayer.remove(r)); this.ringPool.length = 0;
    for (let k = this.world.children.length - 1; k >= 0; k--) {
      const c = this.world.children[k]; this.world.remove(c);
      c.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); if (o.material && o.userData.own) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    }
    for (const ps of [this.glow, this.smoke]) { ps.life.fill(0); ps.alpha.fill(0); }
    if (this.fogTex) { this.fogTex.dispose(); this.fogTex = null; }
    if (this.miniBase) this.miniBase = null;
    // Per-world textures/materials that sit on meshes flagged "shared" (their geometry is shared, their material is not) are released here, exactly once each.
    // Never put shared caches in this set: faction materials (M.kit.sharedFor), M._propTex and the ring geometries live for the whole session.
    if (this.worldRes) { this.worldRes.forEach((r) => r.dispose()); this.worldRes.clear(); }
  };

  const own = (o) => { o.userData.own = true; return o; };
  RP.trackWorldRes = function (r) { (this.worldRes = this.worldRes || new Set()).add(r); return r; };

  RP.initDecals = function () {
    const MAX = 900, pg = this.trackWorldRes(new T.PlaneGeometry(1, 1)); pg.rotateX(-PI / 2);
    const blobMat = this.trackWorldRes(M.fogify(own(new T.MeshBasicMaterial({ map: this.trackWorldRes(M.blobTex()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }))));
    this.blob = new T.InstancedMesh(pg, blobMat, MAX); this.blob.frustumCulled = false; this.blob.renderOrder = 2; this.blob.userData.shared = true; this.world.add(this.blob);
    const rg = this.trackWorldRes(new T.RingGeometry(0.8, 1, 32)); rg.rotateX(-PI / 2); // (R.ringGeo, by contrast, is created once per renderer and never tracked)
    const ringMat = M.fogify(own(new T.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })));
    this.rings = new T.InstancedMesh(rg, ringMat, MAX); this.rings.setColorAt(0, new T.Color(1, 1, 1)); this.rings.frustumCulled = false; this.rings.renderOrder = 3; this.rings.userData.shared = true; this.world.add(this.rings);
    this._dummy = new T.Object3D(); this._col = new T.Color();
  };

  RP.loadWorld = function (W, pid) {
    this.disposeWorld();
    this.W = W; this.pid = pid; const map = W.map, th = map.theme;
    const R = this, hexc = (n) => new T.Color(n);
    const big = Math.max(map.w, map.h);
    this.scene.background = hexc(th.fog).multiplyScalar(0.7); this.scene.fog = new T.FogExp2(th.fog, 0.0058 * (96 / Math.max(96, big * 0.85)));
    this.hemi.color.set(th.sun).lerp(new T.Color(0x9fb4ff), 0.5); this.hemi.groundColor.set(th.amb); this.sun.color.set(th.sun);
    // fog-of-war texture
    this.fogData = new Uint8Array(map.w * map.h * 4);
    this.fogTex = new T.DataTexture(this.fogData, map.w, map.h, T.RGBAFormat); this.fogTex.magFilter = T.LinearFilter; this.fogTex.minFilter = T.LinearFilter; this.fogTex.needsUpdate = true;
    M.FOGU.uFogTex.value = this.fogTex; M.FOGU.uFogSize.value.set(map.w, map.h); M.FOGU.uFogOn.value = 1;
    this.fogTick = -1;
    // terrain: height, biome blend, slope darkening, ambient occlusion beside blockers, slow-zone tint
    const gw = map.w + 1, gh = map.h + 1, pos = new Float32Array(gw * gh * 3), col = new Float32Array(gw * gh * 3), uv = new Float32Array(gw * gh * 2), idx = [];
    const rnd = N.mulberry32(W.seed ^ 0x51ed), c1 = hexc(th.ground[0]), c2 = hexc(th.ground[1]), c3 = hexc(th.ground[2]);
    const noise = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.31 + Math.cos(z * 0.23) * 2) * Math.cos(z * 0.27 + Math.sin(x * 0.17));
    const H = (i, j) => N.groundHeight(map, i, j);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i; const hh = H(i, j); pos[k * 3] = i; pos[k * 3 + 1] = hh; pos[k * 3 + 2] = j; uv[k * 2] = i / 7; uv[k * 2 + 1] = j / 7;
      const n = noise(i, j), c = c1.clone().lerp(c2, n).lerp(c3, Math.max(0, noise(i * 2.1, j * 1.7) - 0.5));
      const slope = Math.min(1, Math.hypot(H(i + 1, j) - H(i - 1, j), H(i, j + 1) - H(i, j - 1)) * 0.9);
      let blocked = 0, cnt = 0; for (let dj = -2; dj <= 1; dj++) for (let di = -2; di <= 1; di++) { const x = i + di, z = j + dj; cnt++; if (x < 0 || z < 0 || x >= map.w || z >= map.h || map.terrain[z * map.w + x]) blocked++; }
      const ti = Math.min(map.w - 1, i), tj = Math.min(map.h - 1, j), sl = map.slow[tj * map.w + ti];
      const bright = (0.8 + 0.3 * rnd()) * (1 - 0.34 * (blocked / cnt)) * (1 - 0.22 * slope);
      c.lerp(c3, slope * 0.45);
      col[k * 3] = c.r * bright * (sl < 1 ? 0.62 : 1) * 1.75; col[k * 3 + 1] = c.g * bright * (sl < 1 ? 0.72 : 1) * 1.75; col[k * 3 + 2] = c.b * bright * (sl < 1 ? 1.15 : 1) * 1.75;
    }
    for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) { const a = j * gw + i; idx.push(a, a + gw, a + 1, a + 1, a + gw, a + gw + 1); }
    const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.setAttribute('uv', new T.BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    const gt = new T.CanvasTexture(M.texGround(th)); gt.wrapS = gt.wrapT = T.RepeatWrapping; gt.anisotropy = 8; gt.encoding = T.sRGBEncoding;
    const tmat = M.fogify(own(new T.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 1, metalness: 0 })));
    const terr = new T.Mesh(tg, tmat); terr.receiveShadow = true; terr.userData.own = true; this.world.add(terr);
    // outer skirt: dark ground fading into the haze so nothing beyond the map edge reads as a flat void
    const skirt = new T.Mesh(new T.PlaneGeometry(1400, 1400).rotateX(-PI / 2), M.fogify(own(new T.MeshStandardMaterial({ color: new T.Color(th.ground[2]).multiplyScalar(0.55), roughness: 1, vertexColors: false })))); skirt.material.customProgramCacheKey = () => 'fogify-skirt'; skirt.position.set(map.w / 2, -0.9, map.h / 2); skirt.userData.own = true; this.world.add(skirt);
    this.initDecals();
    // props + authored landmarks
    this.buildProps(W, rnd); this.buildLandmarks(W, rnd);
    // sky dome (gradient + sun glow), stars, distant ranges, ringed planet
    const skyTop = hexc(th.sky).multiplyScalar(0.55), skyHor = hexc(th.fog).lerp(hexc(th.sun), 0.22).multiplyScalar(1.15);
    const sunD = new T.Vector3(0.5, 0.35, -0.4).normalize();
    this.sky = new T.Mesh(new T.SphereGeometry(340, 24, 12), own(new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: skyTop }, hor: { value: skyHor }, sunD: { value: sunD }, sunC: { value: hexc(th.sun) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 sunD; uniform vec3 sunC; void main(){ float h=clamp(vP.y,0.0,1.0); vec3 c=mix(hor,top,pow(h,0.5)); float s=pow(max(dot(vP,sunD),0.0),18.0); c+=sunC*s*0.5; c+=hor*0.25*pow(1.0-h,6.0); gl_FragColor=vec4(c,1.0); }' })));
    this.sky.userData.own = true; this.sky.renderOrder = -10; this.world.add(this.sky);
    const stars = new Float32Array(700 * 3); for (let i = 0; i < 700; i++) { const a = rnd() * PI * 2, e = 0.12 + rnd() * 1.2, r = 320; stars[i * 3] = map.w / 2 + Math.cos(a) * Math.cos(e) * r; stars[i * 3 + 1] = Math.sin(e) * r; stars[i * 3 + 2] = map.h / 2 + Math.sin(a) * Math.cos(e) * r; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(stars, 3));
    const sp = new T.Points(sg, own(new T.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75 }))); sp.userData.own = true; this.world.add(sp);
    const planet = new T.Mesh(new T.SphereGeometry(40, 28, 18), own(new T.MeshBasicMaterial({ color: new T.Color(th.ground[1]).multiplyScalar(1.6), fog: false }))); planet.position.set(map.w * 0.2, 150, -map.h * 1.6); planet.userData.own = true; this.world.add(planet);
    const ringM = new T.Mesh(new T.RingGeometry(55, 80, 56), own(new T.MeshBasicMaterial({ color: th.sun, fog: false, side: T.DoubleSide, transparent: true, opacity: 0.4 }))); ringM.position.copy(planet.position); ringM.rotation.x = 1.25; ringM.userData.own = true; this.world.add(ringM);
    const mtG = this.trackWorldRes(new T.ConeGeometry(1, 1, 6)), mtM = this.trackWorldRes(M.fogify(own(new T.MeshStandardMaterial({ color: new T.Color(th.ground[2]).multiplyScalar(0.8).lerp(hexc(th.fog), 0.5), roughness: 1, flatShading: true, vertexColors: false })))); mtM.customProgramCacheKey = () => 'fogify-mt';
    const mts = new T.InstancedMesh(mtG, mtM, 90), dm = new T.Object3D();
    for (let i = 0; i < 90; i++) { const a = (i / 90) * PI * 2 + rnd() * 0.05, rr = big * 0.75 + 95 + rnd() * 70, hh = 22 + rnd() * 44; dm.position.set(map.w / 2 + Math.cos(a) * rr, hh * 0.4 - 4, map.h / 2 + Math.sin(a) * rr); dm.rotation.set(0, rnd() * 3, 0); dm.scale.set(12 + rnd() * 18, hh, 12 + rnd() * 18); dm.updateMatrix(); mts.setMatrixAt(i, dm.matrix); }
    mts.frustumCulled = false; mts.userData.shared = true; this.world.add(mts);
    // objective markers (owner = team)
    this.objMarks = W.objs.map((o) => { const m = new T.Mesh(this.ringGeo, own(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }))); m.scale.setScalar(o.r); m.userData.shared = true; m.position.set(o.x, N.groundHeight(map, o.x, o.z) + 0.15, o.z); this.world.add(m);
      const fl = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4, 6), own(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false }))); fl.position.set(o.x, N.groundHeight(map, o.x, o.z) + 2, o.z); fl.userData.own = true; this.world.add(fl); return { ring: m, pole: fl }; });
    // strategic sites: authored landmark + ownership ring/beam (colour follows the holding team)
    this.siteViews = W.sites.map((s, i) => {
      const tm = M.fogify(own(new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.4, vertexColors: true }))); tm.customProgramCacheKey = () => 'fogify';
      const obj = M.makeSite(s.k, tm); const gy = N.groundHeight(map, s.x, s.z); obj.position.set(s.x, gy, s.z); obj.rotation.y = (i * 1.7) % (PI * 2); obj.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.world.add(obj);
      const ring = new T.Mesh(this.ringGeo, own(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false }))); ring.scale.setScalar(s.r); ring.position.set(s.x, gy + 0.18, s.z); ring.userData.shared = true; this.world.add(ring);
      const beam = new T.Mesh(new T.CylinderGeometry(0.1, 0.35, 12, 8, 1, true), own(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }))); beam.position.set(s.x, gy + 6, s.z); beam.userData.own = true; this.world.add(beam);
      return { s, obj, ring, beam, tm, rig: obj.userData.rigData, gy };
    });
    // preview group
    this.pvGroup = new T.Group(); this.pvGroup.visible = false; this.world.add(this.pvGroup);
    this.pvGroupSize = 0;
    // minimap base
    this.buildMiniBase(map);
    this.centerOn(map.starts[pid].x, map.starts[pid].z, true);
    const cx = map.w / 2 - map.starts[pid].x, cz = map.h / 2 - map.starts[pid].z; this.cam.yaw = Math.atan2(cz, cx);
  };

  // Authored ruins / wreck ribs / crystal spires / boulder piles at the big obstacle clusters, arches and obelisks near objectives and base corners.
  RP.buildLandmarks = function (W, rnd) {
    const map = W.map, th = map.theme, kind = th.prop === 'wreck' ? 'hullrib' : th.prop === 'crystal' ? 'spire' : 'rockpile';
    let n = 0;
    const put = (k, x, z, sc, ry) => { if (n++ > 90) return; const g = M.landmark(k, rnd); const gy = N.groundHeight(map, x, z); g.position.set(x, gy, z); g.scale.setScalar(sc); g.rotation.y = ry; g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.userData.landmark = true; this.world.add(g); };
    map.obstacles.forEach((o) => { if (o.s === 'c' && o.r >= 2.3 && o.k !== 'ruin') put(kind, o.x, o.z, 0.45 + o.r * 0.22, rnd() * 6); });
    map.objectives.forEach((o, i) => put(i % 2 ? 'obelisk' : 'arch', o.x + (i % 2 ? 6.5 : -6.5), o.z + (i % 2 ? -1 : 1.5), 0.9, i * 0.9));
    map.starts.forEach((s, i) => { const a = Math.atan2(map.h / 2 - s.z, map.w / 2 - s.x) + PI * 0.75; put('obelisk', s.x + Math.cos(a) * 9, s.z + Math.sin(a) * 9, 0.7, i); });
  };
  RP.buildProps = function (W, rnd) {
    const map = W.map, th = map.theme, R = this;
    const tr = (r) => R.trackWorldRes(r); // per-world resources released by disposeWorld (the prop InstancedMeshes below are flagged shared, so the mesh-level own flag cannot free them)
    const tex = tr(new T.CanvasTexture(M.texGround(th))); tex.wrapS = tex.wrapT = T.RepeatWrapping;
    const rockMat = tr(M.fogify(own(new T.MeshStandardMaterial({ map: tex, color: new T.Color(th.ground[1]).multiplyScalar(2.2), roughness: 0.95, flatShading: true }))));
    const darkMat = tr(M.fogify(own(new T.MeshStandardMaterial({ color: new T.Color(th.ground[2]).multiplyScalar(1.5), roughness: 0.9, flatShading: true }))));
    const crystalMat = tr(M.fogify(own(new T.MeshStandardMaterial({ color: th.name === 'prismatic' ? 0xa78bff : 0x6ae0ff, emissive: th.name === 'prismatic' ? 0x6a4bff : 0x1a9fd0, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92, flatShading: true }))));
    const metalTex = (M._propTex = M._propTex || M.texVanguard()).map; // generated ONCE and shared for the whole session (NOT tracked): it used to be rebuilt (and leaked) on every match reset
    const metalMat = tr(M.fogify(own(new T.MeshStandardMaterial({ map: metalTex, color: 0x9aa4ad, roughness: 0.55, metalness: 0.6 })))); // Material.dispose() does not dispose its map, so the shared metalTex survives
    const stoneMat = tr(M.fogify(own(new T.MeshStandardMaterial({ map: tex, color: 0xd8d0f0, roughness: 0.7, flatShading: true }))));
    const glowStrip = tr(M.fogify(own(new T.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8020, emissiveIntensity: 1.3 }))));
    const jag = (g, amt) => { tr(g); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) * (1 + (rnd() - 0.5) * amt), p.getY(i) * (1 + (rnd() - 0.5) * amt), p.getZ(i) * (1 + (rnd() - 0.5) * amt)); } g.computeVertexNormals(); return g; };
    const K = M.kit, propGeo = (mat, fn) => { const b = K.B(1.2); fn(b, mat); return tr(K.merge(b.items.map((i) => i.g))); }; // the merged prop geometry is per-world (K.sharedFor materials are NOT)
    const kinds = {
      rock: { geo: [jag(new T.IcosahedronGeometry(0.75, 1), 0.5), jag(new T.IcosahedronGeometry(0.75, 1), 0.6)], mat: rockMat, sy: [0.8, 1.7], sxz: [1.0, 1.5], cast: true },
      ridge: { geo: [jag(new T.IcosahedronGeometry(0.85, 1), 0.55), jag(new T.DodecahedronGeometry(0.85, 0), 0.5)], mat: rockMat, sy: [2.0, 4.2], sxz: [1.3, 1.9], cast: true },
      crystal: { geo: [jag(new T.ConeGeometry(0.5, 2, 5), 0.25), jag(new T.ConeGeometry(0.4, 2.4, 6), 0.25)], mat: crystalMat, sy: [0.8, 2.2], sxz: [0.8, 1.6], cast: true, up: 1 },
      wreck: { geo: [propGeo(K.sharedFor('vanguard').hull, (b, m) => { b.rb(1.2, 1, 1.2, 0, 0, 0, m, 0, 0, 0, 0.16).rb(1.32, 0.12, 1.32, 0, 0.5, 0, m, 0, 0, 0, 0.05).rb(0.12, 1.02, 1.3, 0.62, 0, 0, m, 0, 0, 0, 0.04).cy(0.07, 0.07, 1.2, 0.3, 0.56, 0.42, K.sharedFor('vanguard').dark, PI / 2, 0, 0, 8).rb(0.5, 0.06, 0.5, -0.2, 0.55, -0.2, K.sharedFor('vanguard').trim, 0, 0.4, 0, 0.02); }), propGeo(K.sharedFor('vanguard').hull, (b, m) => { b.tp(1.5, 0.5, 1.4, 0.7, 0.8, 0, 0, 0, m, 0, 0, 0, 0.12).rb(1.4, 0.16, 1.5, 0, -0.32, 0, m, 0, 0, 0, 0.05).cy(0.18, 0.2, 0.9, -0.45, 0.4, 0.3, K.sharedFor('vanguard').dark, 0, 0, 0, 10).rb(0.14, 0.9, 1.0, 0.7, 0.1, 0, m, 0, 0, 0.06, 0.04); })], mat: K.sharedFor('vanguard').hull, sy: [0.8, 3.2], sxz: [0.9, 1.3], cast: true, tilt: 0.25 },
      ruin: { geo: [propGeo(K.sharedFor('lattice').hull, (b, m) => { b.cy(0.4, 0.46, 1, 0, 0, 0, m, 0, 0, 0, 10).rb(1.0, 0.16, 1.0, 0, -0.5, 0, m, 0, 0, 0, 0.05).rb(0.8, 0.14, 0.8, 0, 0.5, 0, m, 0, 0, 0, 0.05).rb(0.3, 0.2, 0.3, 0.6, -0.5, 0.5, m, 0.3, 0.6, 0.2, 0.05).to(0.44, 0.03, 0, 0.1, 0, K.sharedFor('lattice').trim, PI / 2, 0, 0); }), propGeo(K.sharedFor('lattice').hull, (b, m) => { b.rb(0.9, 1, 0.9, 0, 0, 0, m, 0, 0, 0, 0.1).rb(1.0, 0.1, 1.0, 0, 0.5, 0, m, 0, 0, 0, 0.04).rb(0.94, 0.06, 0.94, 0, -0.2, 0, K.sharedFor('lattice').trim, 0, 0, 0, 0.02).cr(0.12, 0.5, 0.2, 0.5, 0.2, K.sharedFor('lattice').crys, 0, 0, 0, 5); })], mat: K.sharedFor('lattice').hull, sy: [1.2, 3.4], sxz: [0.9, 1.1], cast: true },
    };
    const buckets = {};
    const shapes = map.obstacles;
    const inS = (o, cx, cz) => (o.s === 'c' ? (cx - o.x) ** 2 + (cz - o.z) ** 2 <= o.r * o.r : cx >= o.x0 && cx < o.x1 && cz >= o.z0 && cz < o.z1);
    shapes.forEach((o) => {
      const k = kinds[o.k]; if (!k) return;
      const x0 = o.s === 'c' ? Math.floor(o.x - o.r) : o.x0, x1 = o.s === 'c' ? Math.ceil(o.x + o.r) : o.x1, z0 = o.s === 'c' ? Math.floor(o.z - o.r) : o.z0, z1 = o.s === 'c' ? Math.ceil(o.z + o.r) : o.z1;
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
        if (!inS(o, x + 0.5, z + 0.5)) continue;
        const vi = Math.floor(rnd() * k.geo.length), key = o.k + vi; (buckets[key] = buckets[key] || { k, gi: vi, list: [] }).list.push({ x: x + 0.5 + (rnd() - 0.5) * 0.4, z: z + 0.5 + (rnd() - 0.5) * 0.4, o });
        if (o.k === 'ridge' && rnd() < 0.35) (buckets[key].list).push({ x: x + 0.5 + (rnd() - 0.5) * 0.9, z: z + 0.5 + (rnd() - 0.5) * 0.9, o, small: true });
      }
    });
    const dummy = new T.Object3D();
    Object.keys(buckets).forEach((key) => {
      const b = buckets[key], k = b.k, im = new T.InstancedMesh(k.geo[b.gi], k.mat, b.list.length);
      b.list.forEach((p, i) => {
        const sy = k.sy[0] + rnd() * (k.sy[1] - k.sy[0]), sx = k.sxz[0] + rnd() * (k.sxz[1] - k.sxz[0]);
        const h = N.groundHeight(map, p.x, p.z);
        dummy.position.set(p.x, h + (k.up ? sy : 0.3 * sy) * (k.up ? 0.9 : 1), p.z);
        if (k === kinds.wreck || k === kinds.ruin) dummy.position.y = h + sy * 0.5 - 0.1;
        if (k === kinds.rock || k === kinds.ridge) dummy.position.y = h + sy * 0.35;
        dummy.rotation.set((rnd() - 0.5) * (k.tilt || 0.3), rnd() * PI * 2, (rnd() - 0.5) * (k.tilt || 0.3));
        const sc = p.small ? 0.6 : 1; dummy.scale.set(sx * sc, sy * sc * (k === kinds.rock ? 0.9 : 1), sx * sc);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.userData.own = false; im.userData.shared = true; this.world.add(im);
    });
    // glowing strips on wrecks
    if (th.prop === 'wreck') {
      const strips = shapes.filter((o) => o.k === 'wreck' && o.s === 'r');
      strips.forEach((o) => { const w = Math.abs(o.x1 - o.x0), d = Math.abs(o.z1 - o.z0); const m = new T.Mesh(new T.BoxGeometry(w > d ? w * 0.9 : 0.1, 0.08, w > d ? 0.1 : d * 0.9), glowStrip); m.position.set((o.x0 + o.x1) / 2, 3.2, (o.z0 + o.z1) / 2); m.userData.own = false; this.world.add(m); });
    }
    // decor (non-blocking)
    const decor = [];
    const decGeo = tr(th.prop === 'crystal' ? new T.OctahedronGeometry(0.25, 0) : th.prop === 'wreck' ? new T.BoxGeometry(0.5, 0.12, 0.3) : new T.IcosahedronGeometry(0.22, 0));
    const decMat = th.prop === 'crystal' ? crystalMat : th.prop === 'wreck' ? metalMat : darkMat;
    for (let i = 0; i < 420 && decor.length < 320; i++) {
      const x = 2 + rnd() * (map.w - 4), z = 2 + rnd() * (map.h - 4);
      if (N.blockedAt(W, Math.floor(x), Math.floor(z))) continue;
      decor.push({ x, z });
    }
    const dim = new T.InstancedMesh(decGeo, decMat, decor.length);
    decor.forEach((p, i) => { dummy.position.set(p.x, N.groundHeight(map, p.x, p.z) + 0.08, p.z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); const s = 0.5 + rnd() * 1.4; dummy.scale.set(s, s * (0.6 + rnd()), s); dummy.updateMatrix(); dim.setMatrixAt(i, dummy.matrix); });
    dim.receiveShadow = true; dim.userData.shared = true; this.world.add(dim);
    // craters (dark decals)
    const cGeo = tr(new T.CircleGeometry(1, 24)); cGeo.rotateX(-PI / 2);
    const cMat = tr(M.fogify(own(new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))));
    for (let i = 0; i < 26; i++) {
      const x = 4 + rnd() * (map.w - 8), z = 4 + rnd() * (map.h - 8); if (N.blockedAt(W, Math.floor(x), Math.floor(z))) continue;
      if (map.starts.some((s) => Math.hypot(s.x - x, s.z - z) < 9)) continue;
      const m = new T.Mesh(cGeo, cMat); m.position.set(x, N.groundHeight(map, x, z) + 0.06, z); m.scale.setScalar(0.8 + rnd() * 2.6); m.userData.shared = true; this.world.add(m);
    }
    // cover markers: subtle bright chips on cover tiles adjacent to blockers
    // deposits are entity views
    this.depMat = M.makeDepositMat(); this.depMat.userData.own = true;
  };

  RP.buildMiniBase = function (map) {
    const c = document.createElement('canvas'); c.width = map.w; c.height = map.h; const g = c.getContext('2d'), th = map.theme;
    const hex = (n, m) => { const r = Math.min(255, ((n >> 16) & 255) * m), gg = Math.min(255, ((n >> 8) & 255) * m), b = Math.min(255, (n & 255) * m); return `rgb(${r | 0},${gg | 0},${b | 0})`; };
    for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
      const k = j * map.w + i;
      g.fillStyle = map.terrain[k] ? hex(th.ground[1], 2.6) : map.slow[k] < 1 ? hex(th.ground[2], 1.0) : hex(th.ground[0], 1.5);
      if (map.terrain[k] && (i === 0 || j === 0 || i === map.w - 1 || j === map.h - 1)) g.fillStyle = '#000';
      g.fillRect(i, j, 1, 1);
    }
    this.miniBase = c;
    const f = document.createElement('canvas'); f.width = map.w; f.height = map.h; this.miniFog = f; this.miniFogCtx = f.getContext('2d'); this.miniFogImg = this.miniFogCtx.createImageData(map.w, map.h);
  };

  /* ------------------------------------------------------------ camera */
  RP.centerOn = function (x, z, snap) { this.cam.tx = x; this.cam.tz = z; if (snap) { this.cam.vtx = x; this.cam.vtz = z; } };
  RP.clampCam = function () { const m = this.W ? this.W.map : { w: 96, h: 96 }; this.cam.tx = Math.max(2, Math.min(m.w - 2, this.cam.tx)); this.cam.tz = Math.max(2, Math.min(m.h - 2, this.cam.tz)); this.cam.dist = Math.max(11, Math.min(m.w > 100 ? 96 : 64, this.cam.dist)); this.cam.pitch = Math.max(0.55, Math.min(1.25, this.cam.pitch)); };
  RP.updateCamera = function (dt) {
    this.clampCam(); const c = this.cam, k = 1 - Math.exp(-dt * 14);
    c.vtx += (c.tx - c.vtx) * k; c.vtz += (c.tz - c.vtz) * k;
    const h = this.W ? N.groundHeight(this.W.map, c.vtx, c.vtz) : 0, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    this.camera.position.set(c.vtx - Math.cos(c.yaw) * c.dist * cp, h + c.dist * sp, c.vtz - Math.sin(c.yaw) * c.dist * cp);
    this.camera.lookAt(c.vtx, h, c.vtz); this.camera.updateMatrixWorld();
    if (this.sky) this.sky.position.copy(this.camera.position);
    this.fill.position.set(c.vtx - 30, 40, c.vtz + 26); this.fill.target.position.set(c.vtx, 0, c.vtz); this.fill.target.updateMatrixWorld();
    this.sun.position.set(c.vtx + 28, 60, c.vtz - 20); this.sun.target.position.set(c.vtx, 0, c.vtz); this.sun.target.updateMatrixWorld();
  };
  RP.project = function (x, y, z, out) {
    const v = (this._pv = this._pv || new T.Vector3()).set(x, y, z).project(this.camera);
    out = out || {}; out.x = (v.x * 0.5 + 0.5) * this.w; out.y = (-v.y * 0.5 + 0.5) * this.h; out.behind = v.z > 1; return out;
  };
  RP.groundPoint = function (px, py) {
    const nx = (px / this.w) * 2 - 1, ny = -(py / this.h) * 2 + 1;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction; if (d.y > -0.01) return null;
    let y = 0.3, t = (y - o.y) / d.y, x = o.x + d.x * t, z = o.z + d.z * t;
    if (this.W) { y = N.groundHeight(this.W.map, x, z); t = (y - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; }
    return { x, z };
  };
  RP.groundY = function (x, z) { return this.W ? N.groundHeight(this.W.map, x, z) : 0; };

  /* ------------------------------------------------------------ entity views */
  RP.makeView = function (e) {
    let obj, rig = null;
    const gy = this.groundY(e.x, e.z);
    if (e.kind === 'deposit') {
      obj = M.makeDeposit(); obj.traverse((o) => { if (o.isMesh) o.castShadow = true; }); obj.position.set(e.x, gy, e.z);
    } else if (e.kind === 'unit') {
      obj = M.makeUnit(e.fid, e.role, e.owner); rig = obj.userData.rigData;
      obj.userData.full.traverse((o) => { if (o.isMesh) o.castShadow = this.shadowUnits; });
      obj.position.set(e.x, gy, e.z);
    } else {
      obj = M.makeBuilding(e.fid, e.role, e.owner, e.size); rig = obj.userData.rigData; obj.position.set(e.x, gy, e.z);
      obj.userData.full.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const eg = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(e.size * 0.95, 2.6, e.size * 0.95)), own(new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }))); eg.position.y = 1.3; eg.name = 'scaffold'; obj.add(eg);
    }
    const v = { e, obj, rig, x: e.x, z: e.z, phase: Math.random() * 6, recoil: 0, flash: 0, air: e.air ? 3.0 : 0, seen: true, built: e.kind === 'building' ? e.built : true, vy: 0, lod: false, lean: 0, lastFace: e.face || 0, sw: 0 };
    if (rig) { rig.bobs.forEach((b) => { b.userData.by = b.position.y; }); rig.spins.forEach((s) => { s.userData.by = s.position.y; }); rig.hulls.forEach((b) => { b.userData.by = b.position.y; }); }
    this.world.add(obj);
    return v;
  };
  RP.setLod = function (v, lod) {
    if (v.lod === lod) return; v.lod = lod;
    const u = v.obj.userData; if (u.full) u.full.visible = !lod; if (u.lod) u.lod.visible = lod;
  };

  RP.entVisible = function (e) {
    const W = this.W, pid = this.pid, p = W.players[pid];
    if (e.owner === pid) return true;
    if (e.kind === 'deposit') return p.expl[Math.floor(e.z) * W.w + Math.floor(e.x)] === 1;
    if (e.kind === 'building') return p.vis[Math.floor(e.z) * W.w + Math.floor(e.x)] === 1 || p.mem.has(e.id);
    return p.vis[Math.floor(e.z) * W.w + Math.floor(e.x)] === 1;
  };

  RP.updateFog = function () {
    const W = this.W, p = W.players[this.pid], d = this.fogData, n = W.w * W.h;
    for (let i = 0; i < n; i++) { const v = p.vis[i] ? 255 : p.expl[i] ? 128 : 0; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    this.fogTex.needsUpdate = true;
    const im = this.miniFogImg.data;
    for (let i = 0; i < n; i++) { const a = p.vis[i] ? 0 : p.expl[i] ? 110 : 235; im[i * 4] = 0; im[i * 4 + 1] = 0; im[i * 4 + 2] = 0; im[i * 4 + 3] = a; }
    this.miniFogCtx.putImageData(this.miniFogImg, 0, 0);
  };

  RP.sync = function (dt, ctx) {
    const W = this.W; if (!W) return;
    const t = performance.now() / 1000, k = 1 - Math.exp(-dt * 16);
    if (W.tick !== this.fogTick && (W.tick % 4 === 2 || this.fogTick < 0)) { this.fogTick = W.tick; this.updateFog(); }
    M.FOGU.uFogOn.value = W.reveal || (ctx && ctx.noFog) ? 0 : 1;
    const seen = new Set(), units = [], p = W.players[this.pid];
    for (const e of W.ents) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.views.get(e.id);
      const vis = this.entVisible(e);
      if (!vis) { if (v) v.obj.visible = false; continue; }
      if (!v) { v = this.makeView(e); this.views.set(e.id, v); if (e.kind === 'building' && e.built) v.built = true; }
      v.obj.visible = true; v.e = e;
      if (e.kind === 'unit') units.push(v); else this.animate(v, e, dt, t, k, true);
    }
    // detail budget: the nearest N units keep the full articulated rig, the rest render as one baked mesh (selected/hovered units always stay full)
    const cx = this.cam.vtx, cz = this.cam.vtz, force = new Set(ctx && ctx.sel ? ctx.sel : []); if (ctx && ctx.hover) force.add(ctx.hover);
    units.forEach((v) => { v._d = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz); });
    units.sort((a, b) => a._d - b._d);
    const cap = this.q.full * (this.cam.dist > 60 ? 0.5 : 1); let nfull = 0;
    for (const v of units) { const full = nfull < cap || force.has(v.e.id); if (full) nfull++; this.setLod(v, !full); this.animate(v, v.e, dt, t, k, full); }
    this.stats.full = nfull;
    // views whose entity is gone (not dying via event) are removed; remembered enemy buildings persist as frozen until mem clears
    this.views.forEach((v, id) => {
      if (seen.has(id)) return;
      if (v.e.kind === 'building' && p.mem.has(id)) { v.obj.visible = true; return; }
      if (v.obj.parent) v.obj.parent.remove(v.obj); this.views.delete(id);
    });
    this.stats.views = this.views.size;
    // ground contact: instanced soft shadows + commander/team rings (two draw calls for the whole army)
    const dm = this._dummy, col = this._col; let nb = 0, nr = 0;
    this.views.forEach((v) => {
      const e = v.e; if (!v.obj.visible || e.kind === 'deposit') return;
      if (nb >= 880 || nr >= 880) return;
      const gy = this.groundY(e.kind === 'unit' ? v.x : e.x, e.kind === 'unit' ? v.z : e.z);
      if (e.kind === 'building') { dm.position.set(e.x, gy + 0.07, e.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(e.size * 1.5); dm.updateMatrix(); this.blob.setMatrixAt(nb++, dm.matrix); return; }
      dm.position.set(v.x, gy + 0.07, v.z); dm.rotation.set(0, 0, 0); const sc = Math.max(0.8, e.radius * (e.air ? 3.4 : 3.0)); dm.scale.set(sc * (e.air ? 0.8 : 1), 1, sc * (e.air ? 0.8 : 1)); dm.updateMatrix(); this.blob.setMatrixAt(nb++, dm.matrix);
      dm.position.y = gy + 0.1; dm.scale.setScalar(Math.max(0.55, e.radius * 1.25)); dm.updateMatrix(); this.rings.setMatrixAt(nr, dm.matrix);
      col.setHex((N.PLAYER_COLORS || M.TEAM)[e.owner]);
      if (e.stasisT > W.time) col.setHex(0x39e6d6).multiplyScalar(0.8 + 0.4 * Math.sin(t * 9)); else if (e.frenzyT > W.time) col.setHex(0xe05cff).multiplyScalar(0.8 + 0.5 * Math.sin(t * 14)); else if (e.spentT > W.time) col.lerp(this._grey || (this._grey = new T.Color(0x333333)), 0.55);
      this.rings.setColorAt(nr, col); nr++;
    });
    this.blob.count = nb; this.blob.instanceMatrix.needsUpdate = true; this.rings.count = nr; this.rings.instanceMatrix.needsUpdate = true; if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    // objectives (owner = team) and strategic sites
    const tc = (o) => (o < 0 ? 0xffffff : N.TEAM_COLORS[o]);
    this.objMarks.forEach((m, i) => { const o = W.objs[i], c = tc(o.owner); m.ring.material.color.setHex(c); m.pole.material.color.setHex(c); m.ring.material.opacity = o.contested ? 0.4 + 0.3 * Math.sin(t * 8) : 0.6; const seenO = p.expl[Math.floor(o.z) * W.w + Math.floor(o.x)] === 1; m.pole.visible = seenO; m.ring.visible = seenO; });
    this.siteViews.forEach((sv) => {
      const s = sv.s, seenS = p.expl[Math.floor(s.z) * W.w + Math.floor(s.x)] === 1; sv.obj.visible = seenS; sv.ring.visible = seenS; sv.beam.visible = seenS; if (!seenS) return;
      const prog = Math.abs(s.prog), capCol = s.prog > 0 ? N.TEAM_COLORS[0] : N.TEAM_COLORS[1];
      const cc = s.owner >= 0 ? new T.Color(tc(s.owner)) : new T.Color(0xffffff).lerp(new T.Color(capCol), Math.min(1, prog * 1.4));
      sv.tm.color.copy(cc); sv.tm.emissive.copy(cc); sv.tm.emissiveIntensity = 0.55 + (s.owner >= 0 ? 0.5 : 0) + (s.contested ? 0.4 * Math.sin(t * 9) : 0);
      sv.ring.material.color.copy(cc); sv.ring.material.opacity = s.contested ? 0.35 + 0.3 * Math.sin(t * 9) : 0.4 + 0.4 * Math.max(prog, s.owner >= 0 ? 1 : 0); sv.beam.material.color.copy(cc); sv.beam.material.opacity = s.owner >= 0 ? 0.32 : 0.14 + 0.2 * prog;
      sv.rig.spins.forEach((sp) => { const u = sp.userData; if (u.axis === 'z') sp.rotation.z += dt * (u.rate || 1); else sp.rotation.y += dt * (u.rate || 0.5); });
      sv.rig.pulses.forEach((pu) => { const a = 1 + Math.sin(t * 2.4) * pu.userData.amp; pu.scale.set(a, a, a); });
    });
    this.updateRings(ctx);
    this.updateFx(dt, t);
    this.updatePreview(ctx);
    this.glow.update(dt); this.smoke.update(dt);
    this.stats.particles = this.glow.active + this.smoke.active;
  };

  RP.animate = function (v, e, dt, t, k, full) {
    const o = v.obj, W = this.W;
    if (e.kind === 'deposit') { const r = Math.max(0.35, e.amount / e.amount0); o.scale.setScalar(0.5 + 0.7 * r); return; }
    const gy = this.groundY(e.x, e.z);
    if (e.kind === 'building') {
      const rig = v.rig; o.position.set(e.x, gy, e.z);
      const far = this.cam.dist > 54 && e.built; this.setLod(v, far);
      const sc = o.getObjectByName('scaffold');
      if (!e.built) {
        const pg = e.progress;
        rig.layers.forEach((l) => { l.visible = pg >= (l.userData.layer === 1 ? 0.02 : l.userData.layer === 2 ? 0.35 : 0.7); });
        o.scale.y = 0.35 + 0.65 * Math.min(1, pg * 1.2); if (sc) sc.visible = true;
        if (e.builders > 0 && Math.random() < 0.25 * dt * 60 * 0.3) { this.dust(e.x + (Math.random() - 0.5) * e.size, gy + 0.3, e.z + (Math.random() - 0.5) * e.size); if (Math.random() < 0.5) this.spark(e.x + (Math.random() - 0.5) * e.size, gy + 1.2, e.z + (Math.random() - 0.5) * e.size, 3, hexRGB(0xffd08a)); }
        v.built = false;
      } else {
        rig.layers.forEach((l) => (l.visible = true)); o.scale.y = 1; if (sc) sc.visible = false;
        if (!v.built) { v.built = true; this.burst(e.x, gy + 1, e.z, 14, 3, 0.7, 0.8, hexRGB(0xffffff), true, 2); }
      }
      if (far) return;
      rig.turrets.forEach((tn) => { tn.rotation.y = -e.face; });
      rig.guns.forEach((g) => { if (v.recoil > 0) g.position.x = g.userData.rest - v.recoil * 0.15; else g.position.x = g.userData.rest; });
      rig.spins.forEach((s) => { const u = s.userData; if (u.axis === 'z') s.rotation.z += (u.rate || 0.5) * dt; else s.rotation.y += (u.rate || 0.5) * dt; });
      rig.pulses.forEach((s) => { const a = 1 + Math.sin(t * 2.2) * s.userData.amp; s.scale.set(a, a, a); });
      v.recoil = Math.max(0, v.recoil - dt * 5);
      return;
    }
    // unit
    v.x += (e.x - v.x) * k; v.z += (e.z - v.z) * k;
    if (Math.abs(v.x - e.x) > 4) { v.x = e.x; v.z = e.z; }
    const alt = e.air ? 3.0 + Math.sin(t * 1.5 + e.id) * 0.15 : e.def.hover ? 0.22 : 0;
    v.air += (alt - v.air) * k;
    o.position.set(v.x, gy + v.air, v.z);
    o.rotation.y = -e.face;
    const moving = e.moving && !(e.stasisT > W.time), spd = e.def.speed;
    v.sw = (v.sw || 0) + ((moving ? 1 : 0) - (v.sw || 0)) * Math.min(1, dt * 10);
    v.recoil = Math.max(0, v.recoil - dt * 5);
    if (!full) return;
    const rig = v.rig, fullG = o.userData.full;
    if (moving) v.phase += dt * spd * 3.2;
    // articulated pose: turn lean, walk bob, recoil kick
    const dturn = N.angDiff(e.face, v.lastFace); v.lastFace = e.face; const tl = Math.max(-0.35, Math.min(0.35, (dturn / Math.max(dt, 0.001)) * 0.05)) * (e.air ? 1.6 : 0.6);
    v.lean += (tl - v.lean) * Math.min(1, dt * 8);
    fullG.rotation.x = v.lean; fullG.rotation.z = -0.05 * v.sw * (e.air ? 1.5 : 1) - (e.air ? 0.06 * v.sw : 0); fullG.position.x = -v.recoil * 0.05;
    rig.hulls.forEach((h) => { h.position.y = h.userData.by + Math.abs(Math.sin(v.phase * 0.5)) * 0.07 * v.sw; h.rotation.z = Math.sin(v.phase) * 0.03 * v.sw; });
    rig.legs.forEach((l) => { const u = l.userData; l.rotation.z = Math.sin(v.phase + (u.phase || 0)) * (u.amp || 0.5) * v.sw; if (u.side) l.rotation.x = 0; });
    rig.knees.forEach((kn) => { kn.rotation.z = -Math.max(0, Math.sin(v.phase + 1.4)) * (kn.userData.amp || 0.6) * v.sw; });
    const engaged = W.time - (e.lastFire || -9) < 0.5;
    rig.arms.forEach((a) => { const u = a.userData; if (u.aim) { const tgt = engaged || (e.target && !moving) ? 1.25 : 0.25 + Math.sin(v.phase + (u.phase || 0)) * (u.amp || 0.2) * v.sw; a.rotation.z += (tgt - a.rotation.z) * Math.min(1, dt * 12); a.children.forEach((c) => { if (c.userData.rig === 'gun') c.rotation.z = -a.rotation.z * 0.92; }); } else a.rotation.z = Math.sin(v.phase + (u.phase || 0)) * (u.amp || 0.4) * v.sw; });
    rig.wings.forEach((w) => { w.rotation.x = Math.sin(t * 9 + v.phase) * 0.55 * w.userData.side; });
    rig.bobs.forEach((b) => { b.position.y = b.userData.by + Math.sin(t * 2.4 + e.id) * b.userData.amp; });
    rig.pulses.forEach((s) => { const a = 1 + Math.sin(t * 2.2 + e.id) * s.userData.amp; s.scale.set(a, a, a); });
    rig.spins.forEach((s) => { const u = s.userData; if (e.stasisT > W.time) return; if (u.orbit) s.rotation.y += dt * 1.6; else if (u.axis === 'z') s.rotation.z += dt * spd * 4 * (moving ? 1 : 0); else if (u.axis === 'x') s.rotation.x += dt * (u.rate || 1) * 8; else s.rotation.y += dt * (u.rate || 1) * 1.6; });
    rig.guns.forEach((g) => { g.position.x = g.userData.rest - v.recoil * 0.14; });
  };

  /* ------------------------------------------------------------ selection / hover rings, placement preview */
  RP.ringFrom = function (mat) {
    if (this.ringUsed >= this.ringPool.length) { const m = new T.Mesh(this.ringGeo, mat); m.renderOrder = 3; this.fxLayer.add(m); this.ringPool.push(m); }
    const r = this.ringPool[this.ringUsed++]; r.material = mat; r.visible = true; return r;
  };
  RP.updateRings = function (ctx) {
    this.ringUsed = 0;
    if (ctx) {
      const place = (e, mat, mul) => { const v = this.views.get(e.id); if (!v || !v.obj.visible) return; const r = this.ringFrom(mat); const s = e.kind === 'building' ? e.size * 0.75 + 0.35 : Math.max(0.6, e.radius * 1.6) * (mul || 1); r.scale.setScalar(s); r.position.set(e.kind === 'building' ? e.x : v.x, this.groundY(e.x, e.z) + 0.12, e.kind === 'building' ? e.z : v.z); };
      if (ctx.sel) ctx.sel.forEach((id) => { const e = this.W.byId.get(id); if (e && e.alive) place(e, this.sel.own); });
      if (ctx.hover) { const e = this.W.byId.get(ctx.hover); if (e && e.alive) place(e, e.owner === this.pid ? this.sel.hover : e.owner < 0 ? this.sel.hover : this.sel.enemy, 1.1); }
    }
    for (let i = this.ringUsed; i < this.ringPool.length; i++) this.ringPool[i].visible = false;
  };
  RP.updatePreview = function (ctx) {
    const pv = ctx && ctx.place;
    if (!pv) { this.pvGroup.visible = false; return; }
    const W = this.W, d = N.buildingDef(W.players[this.pid].faction, pv.role), s = d.size;
    if (this.pvGroupSize !== s) {
      while (this.pvGroup.children.length) this.pvGroup.remove(this.pvGroup.children[0]);
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const m = new T.Mesh(new T.PlaneGeometry(0.94, 0.94).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: 0x40ff70, transparent: true, opacity: 0.5, depthWrite: false })); m.position.set(i + 0.5, 0, j + 0.5); m.renderOrder = 4; this.pvGroup.add(m); }
      const box = new T.Mesh(new T.BoxGeometry(s * 0.9, 1.4, s * 0.9), new T.MeshBasicMaterial({ color: 0x40ff70, transparent: true, opacity: 0.18, depthWrite: false })); box.position.set(s / 2, 0.7, s / 2); box.name = 'box'; this.pvGroup.add(box);
      this.pvGroupSize = s;
    }
    this.pvGroup.visible = true;
    const y = this.groundY(pv.tx + s / 2, pv.tz + s / 2) + 0.15;
    this.pvGroup.position.set(pv.tx, y, pv.tz);
    const c = pv.ok ? 0x40ff70 : 0xff4040;
    this.pvGroup.children.forEach((m) => m.material.color.setHex(c));
  };

  /* ------------------------------------------------------------ effects */
  RP.burst = function (x, y, z, n, speed, life, size, rgb, add, grav) {
    const ps = add ? this.glow : this.smoke, cap = this.q.particles;
    n = Math.min(n, Math.max(0, Math.floor((cap - ps.active) * 0.5)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, e = (Math.random() - 0.3) * PI * 0.8, sp = speed * (0.3 + Math.random());
      ps.spawn(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + speed * 0.3, Math.sin(a) * Math.cos(e) * sp, life * (0.6 + Math.random() * 0.6), size, size * 0.3, rgb[0], rgb[1], rgb[2], add ? 1 : 0.28, grav || 0, 1.5);
    }
  };
  RP.dust = function (x, y, z) { if (this.smoke.active < this.q.particles * 0.5) this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6, 0.9, 0.5, 1.4, 0.55, 0.5, 0.42, 0.22, -0.3, 1); };
  RP.smokePuff = function (x, y, z, s) { if (this.smoke.active < this.q.particles * 0.6) this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4, 1.4, 0.4 * (s || 1), 1.6 * (s || 1), 0.3, 0.3, 0.32, 0.3, -0.2, 0.5); };
  RP.spark = function (x, y, z, n, rgb) { this.burst(x, y, z, n, 3.2, 0.35, 0.16, rgb || hexRGB(0xffe0a0), true, 8); };
  RP.flash = function (x, y, z, s, rgb) { this.glow.spawn(x, y, z, 0, 0, 0, 0.14, s, s * 0.4, rgb[0], rgb[1], rgb[2], 1, 0, 0); };
  RP.tracer = function (from, to, color, width, life, jag) {
    if (this.tracers.length >= this.q.tracers) return;
    const m = new T.Mesh(this.tracerGeo, this.addMat(color, 1)); const d = to.clone().sub(from), len = d.length();
    m.position.copy(from).addScaledVector(d, 0.5); m.scale.set(width, width, len); m.lookAt(to); this.fxLayer.add(m);
    this.tracers.push({ mesh: m, life, max: life });
  };
  RP.ringFx = function (x, y, z, r, color, life, opacity) {
    if (this.pings.length >= this.q.fx) return;
    const m = new T.Mesh(this.ringGeo, this.addMat(color, opacity == null ? 0.9 : opacity)); m.position.set(x, y, z); m.scale.setScalar(0.2); m.renderOrder = 4; this.fxLayer.add(m);
    this.pings.push({ mesh: m, life, max: life, r });
  };
  RP.ping = function (x, z, color) { this.ringFx(x, this.groundY(x, z) + 0.15, z, 0.9, color, 0.55, 0.9); };
  RP.shieldFx = function (v) {
    if (!v || this.shields.length >= 24) return;
    const m = new T.Mesh(this.sphGeo, this.addMat(0x66eeff, 0.5)); const r = Math.max(0.6, v.e.radius * 1.5); m.scale.setScalar(r); m.position.copy(v.obj.position); m.position.y += v.e.radius + 0.3; this.fxLayer.add(m);
    this.shields.push({ mesh: m, life: 0.28, max: 0.28, v });
  };
  RP.muzzlePos = function (v, out) {
    if (v.rig && v.rig.muzzles.length) { v.obj.updateMatrixWorld(true); return v.rig.muzzles[0].getWorldPosition(out); }
    return out.set(v.obj.position.x, v.obj.position.y + 0.8, v.obj.position.z);
  };
  const _a = new T.Vector3(), _b = new T.Vector3();
  RP.centerOf = function (id, e, out) {
    const v = this.views.get(id);
    if (v) { out.copy(v.obj.position); out.y += (e && e.air ? 0.3 : 0) + (e && e.kind === 'building' ? 1.0 : Math.max(0.5, (e ? e.radius : 0.4) * 1.1)); return out; }
    return out.set(e ? e.x : 0, 0.8, e ? e.z : 0);
  };

  RP.consume = function (events) {
    const W = this.W, pid = this.pid;
    let shots = 0;
    for (const ev of events) {
      switch (ev.t) {
        case 'shot': {
          const p = W.players[pid]; const inView = ev.owner === pid || p.vis[Math.floor(ev.z) * W.w + Math.floor(ev.x)] || p.vis[Math.floor(ev.tz) * W.w + Math.floor(ev.tx)];
          if (!inView) break;
          if (++shots > (this.q.fx > 100 ? 90 : 40)) break;
          const sv = this.views.get(ev.src), dv = this.views.get(ev.dst), se = W.byId.get(ev.src), de = W.byId.get(ev.dst);
          if (sv) { sv.recoil = 1; if (se) se.lastFire = W.time; }
          const from = sv ? this.muzzlePos(sv, new T.Vector3()) : new T.Vector3(ev.x, 0.8, ev.z);
          const to = de || dv ? this.centerOf(ev.dst, de, new T.Vector3()) : new T.Vector3(ev.tx, 0.8, ev.tz);
          const c = KIND_COL[ev.kind] || 0xffffff, rgb = hexRGB(c);
          const sky = ev.sair; void sky;
          switch (ev.kind) {
            case 'bullet': case 'spine': this.tracer(from, to, c, 0.05, 0.09); this.flash(from.x, from.y, from.z, 0.5, rgb); break;
            case 'cannon': this.tracer(from, to, c, 0.11, 0.12); this.flash(from.x, from.y, from.z, 0.9, rgb); this.smokePuff(from.x, from.y, from.z, 0.6); break;
            case 'claw': this.spark(to.x, to.y, to.z, 4, rgb); this.tracer(from.clone().lerp(to, 0.6), to, c, 0.07, 0.1); break;
            case 'energy': case 'beam': case 'arc': case 'lance': this.tracer(from, to, c, ev.kind === 'lance' ? 0.16 : 0.07, ev.kind === 'beam' ? 0.16 : 0.12); this.flash(from.x, from.y, from.z, 0.6, rgb); break;
            default: this.proj(from, to, ev, c); this.flash(from.x, from.y, from.z, ev.big ? 1.1 : 0.7, rgb); break;
          }
          break;
        }
        case 'hit': {
          const v = this.views.get(ev.id); if (!v || !v.obj.visible) break;
          const p = v.obj.position; this.spark(p.x, p.y + (ev.big ? 1 : 0.6), p.z, ev.big ? 3 : 2, ev.cover ? hexRGB(0x9aa0a8) : ev.flank ? hexRGB(0xff8080) : hexRGB(KIND_COL[ev.kind] || 0xffffff));
          if (ev.shield) this.shieldFx(v);
          break;
        }
        case 'impact': {
          const y = this.groundY(ev.x, ev.z);
          if (ev.kind === 'lance') { this.burst(ev.x, y + 1, ev.z, 30, 7, 0.9, 1.4, hexRGB(0xffd090), true, 3); this.ringFx(ev.x, y + 0.2, ev.z, ev.r * 1.4, 0xffb060, 0.6, 1); this.flash(ev.x, y + 2, ev.z, 5, hexRGB(0xffe0b0)); const col = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 40, 12, 1, true), this.addMat(0xffc880, 0.9)); col.position.set(ev.x, y + 20, ev.z); this.fxLayer.add(col); this.pings.push({ mesh: col, life: 0.4, max: 0.4, col: true }); }
          else if (ev.kind === 'pod') { this.burst(ev.x, y + 0.6, ev.z, 34, 6, 1.0, 1.0, hexRGB(0xffb060), true, 3); this.burst(ev.x, y + 0.6, ev.z, 12, 2, 1.6, 1.4, [0.35, 0.33, 0.32], false, -0.2); this.ringFx(ev.x, y + 0.2, ev.z, ev.r * 2, 0xffb060, 0.5, 1); this.flash(ev.x, y + 1.4, ev.z, 6, hexRGB(0xffe8c0)); }
          else if (ev.kind === 'stasis') { this.burst(ev.x, y + 0.8, ev.z, 30, 3, 1.1, 0.5, hexRGB(0x39e6d6), true, -1); this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0x39e6d6, 0.8, 1); this.flash(ev.x, y + 1.2, ev.z, 5, hexRGB(0xd0fff8)); }
          else if (ev.kind === 'bloom') { this.burst(ev.x, y + 0.5, ev.z, 40, 3.5, 1.2, 0.5, hexRGB(0xb6ff5a), true, -1); this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0xb6ff5a, 0.9, 0.9); }
          else if (ev.kind === 'field') { this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0x40ffe0, 0.9, 0.9); this.burst(ev.x, y + 1, ev.z, 30, 2.5, 1, 0.4, hexRGB(0x40ffe0), true, -2); }
          else { const big = ev.r || 1; this.burst(ev.x, y + 0.5, ev.z, 12, 3 + big, 0.6, 0.6 + big * 0.2, hexRGB(KIND_COL[ev.kind] || 0xffa050), true, 4); this.flash(ev.x, y + 0.8, ev.z, 1.6 + big * 0.5, hexRGB(0xfff0d0)); this.burst(ev.x, y + 0.6, ev.z, 5, 1.6, 1.3, 0.9, [0.25, 0.24, 0.24], false, -0.2); this.ringFx(ev.x, y + 0.15, ev.z, 0.8 + big, KIND_COL[ev.kind] || 0xffa050, 0.35, 0.6); }
          break;
        }
        case 'death': this.death(ev); break;
        case 'ability': { const y = this.groundY(ev.x, ev.z); this.ringFx(ev.x, y + 0.2, ev.z, ev.r, ev.fid === 'vanguard' ? 0xff5030 : ev.fid === 'brood' ? 0xb6ff5a : 0x40ffe0, Math.max(0.6, ev.delay + 0.3), 0.8); break; }
        case 'deliver': { const v = this.views.get(-1); void v; this.spark(ev.x, 0.9, ev.z, 3, hexRGB(0x60e8ff)); break; }
        case 'healbeam': { const f = new T.Vector3(ev.x, 1.0, ev.z), t2 = new T.Vector3(ev.tx, 0.9, ev.tz); this.tracer(f, t2, ev.fid === 'lattice' ? 0x66fff0 : 0x66ff88, 0.05, 0.2); break; }
        case 'aura': this.ringFx(ev.x, this.groundY(ev.x, ev.z) + 0.15, ev.z, ev.r, 0xa8ff70, 0.7, 0.35); break;
        case 'built': this.burst(ev.x, 1, ev.z, 16, 3, 0.8, 0.8, hexRGB(0xffffff), true, 2); break;
        case 'power': { const y = this.groundY(ev.x, ev.z), pw = N.FACTIONS[ev.fid].power;
          if (ev.id === 'droppod') { this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0xff9f3c, Math.max(0.6, ev.delay), 0.9); const col = new T.Mesh(new T.CylinderGeometry(ev.r * 0.6, ev.r * 0.6, 40, 16, 1, true), this.addMat(0xff9f3c, 0.35)); col.position.set(ev.x, y + 20, ev.z); this.fxLayer.add(col); this.pings.push({ mesh: col, life: ev.delay, max: ev.delay, col: true }); }
          else if (ev.id === 'stasis') { this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0x39e6d6, Math.max(0.6, ev.delay), 0.9); this.burst(ev.x, y + 0.6, ev.z, 16, 1.6, ev.delay, 0.3, hexRGB(0x39e6d6), true, -1.5); }
          else { this.ringFx(ev.x, y + 0.2, ev.z, ev.r, 0xe05cff, 0.9, 0.9); this.burst(ev.x, y + 0.8, ev.z, 36, 4, 0.9, 0.5, hexRGB(0xe05cff), true, -1); this.flash(ev.x, y + 1.2, ev.z, 5, hexRGB(0xf0c0ff)); }
          void pw; break; }
        case 'site': { const y = this.groundY(ev.x, ev.z), c = ev.owner < 0 ? 0xffffff : N.TEAM_COLORS[ev.owner]; this.ringFx(ev.x, y + 0.2, ev.z, 7, c, 1.0, 0.9); this.burst(ev.x, y + 1, ev.z, 26, 3.4, 1.0, 0.6, hexRGB(c), true, -1); this.flash(ev.x, y + 2, ev.z, 5, hexRGB(0xffffff)); break; }
        case 'transit': { this.ringFx(ev.x, this.groundY(ev.x, ev.z) + 0.2, ev.z, 5, 0xd18cff, Math.max(0.6, ev.delay), 0.9); this.burst(ev.x, 1, ev.z, 20, 1.6, ev.delay, 0.35, hexRGB(0xd18cff), true, -1.5); break; }
        case 'transitDone': { const y = this.groundY(ev.x, ev.z); this.ringFx(ev.x, y + 0.2, ev.z, 6, 0xd18cff, 0.8, 0.9); this.burst(ev.x, y + 1, ev.z, 30, 4, 0.9, 0.6, hexRGB(0xd18cff), true, 1); this.flash(ev.x, y + 1.5, ev.z, 5, hexRGB(0xf0e0ff)); break; }
        case 'transitCancel': this.ringFx(ev.x, this.groundY(ev.x, ev.z) + 0.2, ev.z, 5, 0xff5040, 0.6, 0.8); break;
        default: break;
      }
    }
  };

  RP.proj = function (from, to, ev, color) {
    if (this.projs.length >= this.q.fx) return;
    const d = from.distanceTo(to), dur = ev.delay > 0 ? ev.delay : Math.max(0.12, d / 34);
    const arc = ev.delay > 0.3 ? 4 + d * 0.22 : ev.kind === 'acid' || ev.kind === 'spore' ? 1.2 : 0.0;
    const m = new T.Mesh(this.sphGeo, this.addMat(color, 0.95)); m.scale.setScalar(ev.splash ? 0.22 : 0.14); this.fxLayer.add(m);
    this.projs.push({ mesh: m, from: from.clone(), to: to.clone(), t: 0, dur, arc, kind: ev.kind, rgb: hexRGB(color) });
  };

  RP.death = function (ev) {
    const W = this.W, p = W.players[this.pid];
    const vis = ev.owner === this.pid || p.vis[Math.floor(ev.z) * W.w + Math.floor(ev.x)]; if (!vis) { const vv = this.views.get(ev.id); if (vv) { vv.obj.parent && vv.obj.parent.remove(vv.obj); this.views.delete(ev.id); } return; }
    const v = this.views.get(ev.id), y = this.groundY(ev.x, ev.z);
    const col = ev.fid === 'brood' ? [0.6, 1.0, 0.25] : ev.fid === 'lattice' ? [0.4, 1.0, 0.95] : [1.0, 0.6, 0.2];
    if (ev.kind === 'building') {
      this.burst(ev.x, y + 1, ev.z, 28 + ev.size * 6, 6, 1.1, 1.2, col, true, 4); this.flash(ev.x, y + 1.5, ev.z, 5 + ev.size, hexRGB(0xfff0d0));
      for (let i = 0; i < 8; i++) this.smokePuff(ev.x + (Math.random() - 0.5) * ev.size, y + 1 + Math.random() * 2, ev.z + (Math.random() - 0.5) * ev.size, 2);
      this.ringFx(ev.x, y + 0.2, ev.z, ev.size * 1.4, 0xffb060, 0.6, 0.8);
      if (v) { this.views.delete(ev.id); this.dying.push({ v, t: 0, kind: 'building' }); }
      return;
    }
    const big = ev.role === 'heavy' || ev.role === 'walker' || ev.role === 'artillery';
    this.burst(ev.x, y + 0.7, ev.z, big ? 26 : 10, big ? 5 : 3, 0.8, big ? 1.0 : 0.5, col, true, ev.fid === 'brood' ? 9 : 5);
    if (ev.fid === 'brood') this.burst(ev.x, y + 0.5, ev.z, big ? 14 : 6, 2.4, 1.6, 0.5, [0.4, 0.55, 0.18], false, 6);
    else this.smokePuff(ev.x, y + 0.7, ev.z, big ? 2 : 1);
    if (big || ev.air) this.flash(ev.x, y + 0.8, ev.z, big ? 3.5 : 2, hexRGB(0xfff0d0));
    if (v) { this.views.delete(ev.id); this.dying.push({ v, t: 0, kind: ev.air ? 'air' : big || ev.fid === 'lattice' ? 'wreck' : 'body', y0: v.obj.position.y }); }
  };

  RP.updateFx = function (dt, t) {
    for (let i = this.tracers.length - 1; i >= 0; i--) { const tr = this.tracers[i]; tr.life -= dt; if (tr.life <= 0) { this.fxLayer.remove(tr.mesh); tr.mesh.material.dispose(); this.tracers.splice(i, 1); } else tr.mesh.material.opacity = tr.life / tr.max; }
    for (let i = this.pings.length - 1; i >= 0; i--) { const p = this.pings[i]; p.life -= dt; const f = 1 - p.life / p.max; if (p.life <= 0) { this.fxLayer.remove(p.mesh); p.mesh.material.dispose(); if (p.col) p.mesh.geometry.dispose(); this.pings.splice(i, 1); continue; } if (p.col) { p.mesh.scale.set(1 + f, 1, 1 + f); p.mesh.material.opacity = 0.9 * (1 - f); } else { p.mesh.scale.setScalar(Math.max(0.2, p.r * f)); p.mesh.material.opacity = (1 - f) * 0.9; } }
    for (let i = this.shields.length - 1; i >= 0; i--) { const s = this.shields[i]; s.life -= dt; if (s.life <= 0 || !s.v.obj.parent) { this.fxLayer.remove(s.mesh); s.mesh.material.dispose(); this.shields.splice(i, 1); } else { s.mesh.material.opacity = 0.55 * (s.life / s.max); s.mesh.position.copy(s.v.obj.position); s.mesh.position.y += s.v.e.radius + 0.3; } }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; p.t += dt; const f = Math.min(1, p.t / p.dur);
      p.mesh.position.lerpVectors(p.from, p.to, f); p.mesh.position.y += Math.sin(f * PI) * p.arc;
      if (Math.random() < 0.7) { if (p.kind === 'rocket' || p.kind === 'shell') this.smokePuff(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0.5); this.glow.spawn(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0, 0, 0, 0.2, 0.3, 0.05, p.rgb[0], p.rgb[1], p.rgb[2], 0.8, 0, 0); }
      if (f >= 1) { this.fxLayer.remove(p.mesh); p.mesh.material.dispose(); this.projs.splice(i, 1); }
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]; d.t += dt; const o = d.v.obj;
      if (d.kind === 'body') { const f = Math.min(1, d.t / 0.35); o.rotation.z = -f * 1.45; if (d.t > 0.9) o.position.y -= dt * 0.6; }
      else if (d.kind === 'wreck') { o.scale.y = Math.max(0.2, 1 - d.t * 0.8); o.position.y -= dt * 0.25; if (Math.random() < 0.3) this.smokePuff(o.position.x, o.position.y + 0.8, o.position.z, 1); }
      else if (d.kind === 'air') { o.rotation.z += dt * 4; o.position.y -= dt * (2 + d.t * 6); if (Math.random() < 0.5) this.smokePuff(o.position.x, o.position.y, o.position.z, 1.2); if (o.position.y < this.groundY(o.position.x, o.position.z) + 0.2) { this.burst(o.position.x, o.position.y + 0.5, o.position.z, 18, 4, 0.7, 1, [1, 0.6, 0.2], true, 5); d.t = 9; } }
      else { o.scale.y = Math.max(0.12, 1 - d.t * 0.7); if (Math.random() < 0.4) this.smokePuff(o.position.x + (Math.random() - 0.5) * 2, o.position.y + 1, o.position.z + (Math.random() - 0.5) * 2, 1.5); }
      const life = d.kind === 'building' ? 2.2 : d.kind === 'body' ? 1.6 : d.kind === 'air' ? 2.2 : 1.8;
      if (d.t >= life) { if (o.parent) o.parent.remove(o); this.dying.splice(i, 1); }
    }
  };

  /* ------------------------------------------------------------ frame */
  RP.render = function (ctx) {
    const t0 = performance.now();
    this.gl.shadowMap.autoUpdate = false; this.gl.shadowMap.needsUpdate = this.q.shadow > 0 && this.stats.frames % 2 === 0; // shadow map refreshed every 2nd frame
    this.gl.render(this.scene, this.camera);
    const ms = performance.now() - t0, s = this.stats;
    s.frames++; s.ms.push(ms); if (s.ms.length > 300) s.ms.shift();
    const pw = s.win; if (pw) { if (pw.ms.length < 20000) pw.ms.push(ms); else pw.truncated = true; }
    s.calls = this.gl.info.render.calls; s.tris = this.gl.info.render.triangles;
    void ctx;
  };
  RP.frameStats = function () {
    const s = this.stats, a = s.dts.slice().sort((x, y) => x - y), b = s.ms.slice().sort((x, y) => x - y);
    const q = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * f))] : 0);
    return { frames: s.frames, intervalAvg: a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, intervalP95: q(a, 0.95), intervalMax: a.length ? a[a.length - 1] : 0, submitAvg: b.length ? b.reduce((x, y) => x + y, 0) / b.length : 0, submitP95: q(b, 0.95), calls: s.calls, tris: s.tris, views: s.views, particles: s.particles };
  };
  // Full-window telemetry (QA): start/end frame counters + monotonic wall clock, every frame interval / submit time in between (bounded, flagged if truncated).
  RP.perfWindowStart = function () { const s = this.stats; s.win = { f0: s.frames, t0: performance.now(), ms: [], dts: [], truncated: false }; return { f0: s.win.f0, t0: s.win.t0 }; };
  RP.perfWindowEnd = function () {
    const s = this.stats, w = s.win; if (!w) return null; s.win = null;
    const t1 = performance.now(), sorted = (arr) => arr.slice().sort((x, y) => x - y), q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))] : 0), avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const d = sorted(w.dts), m = sorted(w.ms);
    return { frameStart: w.f0, frameEnd: s.frames, deltaFrames: s.frames - w.f0, wallStartMs: w.t0, wallEndMs: t1, elapsedMs: t1 - w.t0, fpsOverWindow: (s.frames - w.f0) / ((t1 - w.t0) / 1000), intervalSamples: d.length, submitSamples: m.length, truncated: w.truncated, scope: 'full-window', intervalAvg: avg(d), intervalP95: q(d, 0.95), intervalMax: d.length ? d[d.length - 1] : 0, submitAvg: avg(m), submitP95: q(m, 0.95), submitMax: m.length ? m[m.length - 1] : 0 };
  };
  RP.gpuInfo = function () {
    try { const g = this.gl.getContext(), ext = g.getExtension('WEBGL_debug_renderer_info'); return { vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR), renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), webgl: g.getParameter(g.VERSION) }; } catch (e) { return { error: String(e) }; }
  };

  /* ------------------------------------------------------------ minimap */
  RP.drawMinimap = function (cv) {
    const W = this.W; if (!W || !this.miniBase) return;
    const g = cv.getContext('2d'), sw = cv.width, sh = cv.height, sx = sw / W.w, sz = sh / W.h, pc = (o) => '#' + (N.PLAYER_COLORS[o] || 0xffffff).toString(16).padStart(6, '0'), tcn = (o) => (o < 0 ? '#ffffff' : '#' + N.TEAM_COLORS[o].toString(16).padStart(6, '0'));
    g.imageSmoothingEnabled = false; g.drawImage(this.miniBase, 0, 0, sw, sh);
    const p = W.players[this.pid], px = Math.max(1, sw / 128);
    W.objs.forEach((o) => { g.strokeStyle = tcn(o.owner); g.lineWidth = 2 * px; g.beginPath(); g.arc(o.x * sx, o.z * sz, o.r * sx * 0.7, 0, 7); g.stroke(); });
    for (const e of W.ents) {
      if (!e.alive) continue;
      if (e.kind === 'deposit') { if (p.expl[Math.floor(e.z) * W.w + Math.floor(e.x)]) { g.fillStyle = '#4fe0ff'; g.fillRect(e.x * sx - 1.5 * px, e.z * sz - 1.5 * px, 3 * px, 3 * px); } continue; }
      if (e.owner !== this.pid && !this.entVisible(e)) continue;
      g.fillStyle = pc(e.owner);
      if (e.kind === 'building') g.fillRect(e.tx * sx, e.tz * sz, Math.max(3 * px, e.size * sx), Math.max(3 * px, e.size * sz)); else g.fillRect(e.x * sx - 1 * px, e.z * sz - 1 * px, 2.4 * px, 2.4 * px);
    }
    g.imageSmoothingEnabled = true; g.drawImage(this.miniFog, 0, 0, sw, sh);
    // strategic sites: diamond in the holder's colour with a kind letter (only once explored)
    W.sites.forEach((s) => {
      if (!p.expl[Math.floor(s.z) * W.w + Math.floor(s.x)]) return;
      const x = s.x * sx, z = s.z * sz, r = 5.2 * px; g.fillStyle = tcn(s.owner); g.strokeStyle = s.contested ? '#ffee66' : '#000'; g.lineWidth = 1.6 * px; g.beginPath(); g.moveTo(x, z - r); g.lineTo(x + r, z); g.lineTo(x, z + r); g.lineTo(x - r, z); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = s.owner < 0 ? '#000' : '#fff'; g.font = 'bold ' + Math.round(7 * px) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.def.icon.charAt(0), x, z + 0.5 * px); g.textBaseline = 'alphabetic';
    });
    // camera footprint
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6 * px; g.beginPath();
    [[0, 0], [this.w, 0], [this.w, this.h], [0, this.h]].forEach((c, i) => { const q = this.groundPoint(c[0], c[1]) || { x: this.cam.tx, z: this.cam.tz }; const x = Math.max(0, Math.min(W.w, q.x)) * sx, z = Math.max(0, Math.min(W.h, q.z)) * sz; if (i) g.lineTo(x, z); else g.moveTo(x, z); });
    g.closePath(); g.stroke();
  };
})();
