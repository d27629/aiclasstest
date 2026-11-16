/* 餃酌 hero: 3D street scene (three.js r128).
 * Low-poly pedestrians pass the shopfront; some turn, walk into the doorway and fade out,
 * others step out of the shop and walk away. Returns false when WebGL is unavailable
 * so the caller can fall back to the 2D crowd. */
(function () {
  'use strict';

  window.JZ_startCrowd3D = function (container) {
    const T = window.THREE;
    if (!T) return false;

    let renderer;
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) { return false; }
    if (!renderer || !renderer.getContext()) return false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.innerHTML = '';
    container.classList.add('is-3d');
    container.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const FOV = 32, CAM_Z = 11;
    const camera = new T.PerspectiveCamera(FOV, 2, 0.1, 100);

    // ---- lights --------------------------------------------------------------------------
    scene.add(new T.HemisphereLight(0xfff1e0, 0x4a3326, 0.95));
    const sun = new T.DirectionalLight(0xffffff, 0.65);
    sun.position.set(-4, 8, 8);
    scene.add(sun);

    // ---- helpers -------------------------------------------------------------------------
    const radialTexture = (inner, outer) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, inner);
      grad.addColorStop(1, outer);
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      return new T.CanvasTexture(c);
    };
    const shadowTex = radialTexture('rgba(0,0,0,.55)', 'rgba(0,0,0,0)');
    const glowTex = radialTexture('rgba(255,190,100,.75)', 'rgba(255,190,100,0)');

    // ---- shop ----------------------------------------------------------------------------
    const shop = new T.Group();
    scene.add(shop);
    const FRONT_Z = -2.6;
    const mat = (color, extra) => new T.MeshLambertMaterial(Object.assign({ color }, extra || {}));
    const basic = (color, extra) => new T.MeshBasicMaterial(Object.assign({ color }, extra || {}));
    const box = (w, h, d, material, x, y, z, parent) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      (parent || shop).add(m);
      return m;
    };
    const SHOP_W = 4.4, SHOP_H = 3.3, DOOR_W = 1.3, DOOR_H = 2.3;
    const wall = mat(0xf3e6d3), trim = mat(0x6b4a35);
    const sideW = (SHOP_W - DOOR_W) / 2;
    box(sideW, SHOP_H, 0.3, wall, -(DOOR_W + sideW) / 2, SHOP_H / 2, FRONT_Z, shop);
    box(sideW, SHOP_H, 0.3, wall, (DOOR_W + sideW) / 2, SHOP_H / 2, FRONT_Z, shop);
    box(DOOR_W, SHOP_H - DOOR_H, 0.3, wall, 0, DOOR_H + (SHOP_H - DOOR_H) / 2, FRONT_Z, shop);
    box(SHOP_W, 0.12, 2.6, trim, 0, SHOP_H + 0.06, FRONT_Z - 1.1, shop);                 // roof
    box(DOOR_W + 0.2, 0.1, 0.36, trim, 0, DOOR_H + 0.05, FRONT_Z, shop);                  // door lintel
    box(0.1, DOOR_H, 0.36, trim, -DOOR_W / 2 - 0.05, DOOR_H / 2, FRONT_Z, shop);          // door jambs
    box(0.1, DOOR_H, 0.36, trim, DOOR_W / 2 + 0.05, DOOR_H / 2, FRONT_Z, shop);
    box(SHOP_W + 0.2, 0.14, 0.5, trim, 0, 0.07, FRONT_Z + 0.1, shop);                     // plinth
    box(DOOR_W + 0.1, DOOR_H, 1.8, basic(0x2a1a12), 0, DOOR_H / 2, FRONT_Z - 0.95, shop); // dark interior
    const inner = new T.Mesh(new T.PlaneGeometry(DOOR_W, DOOR_H), basic(0xffffff, { map: glowTex, transparent: true, opacity: 0.9, depthWrite: false }));
    inner.position.set(0, DOOR_H / 2, FRONT_Z - 1.7);
    shop.add(inner);
    // windows
    [-1, 1].forEach(side => {
      const w = new T.Mesh(new T.PlaneGeometry(0.95, 1.05), basic(0xffd9a0, { transparent: true, opacity: 0.92 }));
      w.position.set(side * (DOOR_W / 2 + sideW / 2), 1.45, FRONT_Z + 0.16);
      shop.add(w);
      box(1.05, 0.06, 0.1, trim, w.position.x, 0.9, FRONT_Z + 0.18, shop);
    });
    // striped awning
    const awning = new T.Group();
    awning.position.set(0, 2.62, FRONT_Z + 0.55);
    awning.rotation.x = 0.28;
    const stripes = 10, sw = (SHOP_W + 0.4) / stripes;
    for (let i = 0; i < stripes; i++) {
      box(sw, 0.1, 1.15, mat(i % 2 ? 0xfff7ef : 0xd8783d), -(SHOP_W + 0.4) / 2 + sw * (i + 0.5), 0, 0, awning);
    }
    shop.add(awning);
    // sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 128;
    const signTex = new T.CanvasTexture(signCanvas);
    const drawSign = () => {
      const g = signCanvas.getContext('2d');
      g.clearRect(0, 0, 512, 128);
      g.fillStyle = '#32241e';
      g.beginPath();
      if (g.roundRect) g.roundRect(4, 8, 504, 112, 22); else g.rect(4, 8, 504, 112);
      g.fill();
      g.strokeStyle = '#d8783d'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#fff7ef'; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = '700 62px "Noto Serif TC", serif';
      g.fillText('餃酌', 150, 68);
      g.font = '600 26px "DM Sans", sans-serif';
      g.fillStyle = '#f3bc8e';
      g.fillText('JIAO ZHUO', 350, 70);
      signTex.needsUpdate = true;
    };
    drawSign();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawSign);
    const sign = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), basic(0xffffff, { map: signTex, transparent: true }));
    sign.position.set(0, 3.0, FRONT_Z + 0.17);
    shop.add(sign);
    // warm light spilling out of the door
    const spill = new T.Mesh(new T.PlaneGeometry(3.4, 2.4), basic(0xffffff, { map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.02, FRONT_Z + 1.1);
    shop.add(spill);
    const doorLight = new T.PointLight(0xffb066, 0.9, 7);
    doorLight.position.set(0, 1.6, FRONT_Z + 0.8);
    shop.add(doorLight);

    // ---- pedestrians ---------------------------------------------------------------------
    const TOPS = [0xffffff, 0xe6f0f2, 0x3f9aa3, 0x6f9bd1, 0x7fb069, 0x2f4a7a, 0xc8d7ea, 0xe8c547];
    const PANTS = [0x1f2a3a, 0x4b5d78, 0x8a94a6, 0x2f4a7a, 0x3a3f4a];
    const SKINS = [0xf4d3b3, 0xe2b48a, 0xc68a62, 0xa56b47];
    const HAIRS = [0x2b1d15, 0x4a3224, 0x1f1612, 0x7a5638];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const rand = (a, b) => a + Math.random() * (b - a);
    const GAIT = 3.9;     // rad of leg swing per unit of distance walked
    const FOOT_Y = 0.9;

    class Person {
      constructor() {
        this.root = new T.Group();
        this.mats = {
          top: mat(pick(TOPS)), pants: mat(pick(PANTS)), skin: mat(pick(SKINS)), hair: mat(pick(HAIRS)), shoe: mat(0x241812)
        };
        Object.keys(this.mats).forEach(k => { this.mats[k].transparent = true; });
        const body = new T.Group();
        this.body = body;
        this.root.add(body);
        const m = this.mats;
        const torso = new T.Mesh(new T.CylinderGeometry(0.2, 0.23, 0.62, 12), m.top);
        torso.scale.z = 0.72; torso.position.y = 1.23; body.add(torso);
        const head = new T.Mesh(new T.SphereGeometry(0.16, 14, 12), m.skin);
        head.position.y = 1.72; body.add(head);
        const hair = new T.Mesh(new T.SphereGeometry(0.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair);
        hair.position.set(0, 1.735, -0.012); hair.rotation.x = -0.25; body.add(hair);
        const neck = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.1, 8), m.skin);
        neck.position.y = 1.56; body.add(neck);
        const limb = (mesh, x, y) => { const g = new T.Group(); g.position.set(x, y, 0); mesh.position.y = -0.4; g.add(mesh); body.add(g); return g; };
        const legGeo = new T.CylinderGeometry(0.075, 0.065, 0.84, 8);
        const shoeGeo = new T.BoxGeometry(0.13, 0.08, 0.26);
        const mkLeg = x => { const l = new T.Mesh(legGeo, m.pants); const s = new T.Mesh(shoeGeo, m.shoe); s.position.set(0, -0.46, 0.05); l.add(s); return limb(l, x, FOOT_Y); };
        this.legL = mkLeg(-0.1); this.legR = mkLeg(0.1);
        const armGeo = new T.CylinderGeometry(0.052, 0.046, 0.56, 8);
        const mkArm = x => { const a = new T.Mesh(armGeo, m.top); const h = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), m.skin); h.position.y = -0.31; a.add(h); a.position.y = -0.27; const g = new T.Group(); g.position.set(x, 1.48, 0); g.add(a); body.add(g); return g; };
        this.armL = mkArm(-0.27); this.armR = mkArm(0.27);
        if (Math.random() < 0.4) { const bag = new T.Mesh(new T.BoxGeometry(0.3, 0.38, 0.14), mat(pick(PANTS))); bag.material.transparent = true; this.mats.bag = bag.material; bag.position.set(0, 1.25, -0.2); body.add(bag); }
        this.shadow = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), basic(0xffffff, { map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false }));
        this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.015;
        this.root.add(this.shadow);
        const sc = rand(0.93, 1.07);
        this.root.scale.setScalar(sc);
        this.shadowBase = 0.5;
        this.phase = rand(0, 6);
        this.state = 'wait';
        this.timer = rand(0, 4);
        this.heading = 0; this.target = 0;
        this.speed = 1.2;
        this.opacity = 0;
        this.root.visible = false;
        scene.add(this.root);
      }
      setOpacity(o) {
        this.opacity = o;
        const ms = this.mats;
        for (const k in ms) ms[k].opacity = o;
        this.shadow.material.opacity = this.shadowBase * o;
        this.root.visible = o > 0.01;
      }
      spawn() {
        const r = Math.random();
        const edge = layout.halfW + 1.8;
        this.speed = rand(0.95, 1.55);
        this.dir = Math.random() < 0.5 ? 1 : -1;
        if (r < 0.34) {                                  // customer: walks to the door and goes in
          this.state = 'toDoor';
          this.root.position.set(-this.dir * edge, 0, rand(-1.75, -1.35));
          this.heading = this.target = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          this.setOpacity(1);
        } else if (r < 0.5) {                            // leaves the shop
          this.state = 'exiting';
          this.root.position.set(layout.shopX + rand(-0.25, 0.25), 0, FRONT_Z - 0.5);
          this.heading = this.target = 0;
          this.setOpacity(0);
        } else {                                         // passer-by
          this.state = 'walk';
          this.root.position.set(-this.dir * edge, 0, rand(-0.6, 2.3));
          this.heading = this.target = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          this.setOpacity(1);
        }
        this.root.rotation.y = this.heading;
      }
      update(dt) {
        if (this.state === 'wait') {
          this.timer -= dt;
          if (this.timer <= 0) this.spawn();
          return;
        }
        // smooth turning
        let diff = this.target - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 7);
        this.root.rotation.y = this.heading;
        const p = this.root.position;
        const step = this.speed * dt;
        p.x += Math.sin(this.heading) * step;
        p.z += Math.cos(this.heading) * step;
        this.phase += step * GAIT;
        const s = Math.sin(this.phase);
        this.legL.rotation.x = s * 0.55; this.legR.rotation.x = -s * 0.55;
        this.armL.rotation.x = -s * 0.42; this.armR.rotation.x = s * 0.42;
        this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035;

        switch (this.state) {
          case 'walk':
            if (Math.abs(p.x) > layout.halfW + 2.2) this.finish();
            break;
          case 'toDoor':
            if ((p.x - layout.shopX) * this.dir >= -0.05) { this.state = 'entering'; this.target = Math.PI; }
            if (Math.abs(p.x) > layout.halfW + 3) this.finish();
            break;
          case 'entering': {
            const fade = Math.min(1, Math.max(0, (p.z - (FRONT_Z - 0.55)) / 0.9));
            this.setOpacity(fade);
            p.x += (layout.shopX - p.x) * Math.min(1, dt * 3);   // line up with the doorway
            if (p.z < FRONT_Z - 0.6) this.finish();
            break;
          }
          case 'exiting': {
            this.setOpacity(Math.min(1, (p.z - (FRONT_Z - 0.55)) / 0.9 + 0.05));
            if (p.z > -1.55) {                                 // out on the pavement: pick a direction
              this.dir = Math.random() < 0.5 ? 1 : -1;
              this.target = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
              this.state = 'walk';
              this.setOpacity(1);
            }
            break;
          }
        }
      }
      finish() {
        this.state = 'wait';
        this.timer = rand(0.4, 3.5);
        this.setOpacity(0);
      }
    }

    const layout = { halfW: 8, shopX: 5 };
    const crowd = [];
    const N = 14;
    for (let i = 0; i < N; i++) crowd.push(new Person());

    // ---- sizing --------------------------------------------------------------------------
    function resize() {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(0, 1.8, CAM_Z);
      camera.lookAt(0, 2.0, 0);
      camera.updateProjectionMatrix();
      const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
      layout.halfW = halfH * camera.aspect;
      layout.shopX = Math.min(8, Math.max(2.7, layout.halfW * 0.56));
      shop.position.x = layout.shopX;
      // phones get fewer people
      const active = w < 768 ? 8 : N;
      crowd.forEach((p, i) => { if (i >= active && p.state !== 'wait') { p.finish(); } p.disabled = i >= active; });
    }
    resize();
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

    // ---- loop ----------------------------------------------------------------------------
    let raf = 0, last = 0, onScreen = true;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      for (const p of crowd) { if (p.disabled && p.state === 'wait') continue; p.update(dt); }
      renderer.render(scene, camera);
    }
    function run() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
    if (window.IntersectionObserver) {
      new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; onScreen ? run() : stop(); }).observe(container);
    }
    renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
    // warm up: scatter a few people already on screen so the scene is not empty at start
    for (let k = 0; k < 130; k++) crowd.forEach(p => { if (!p.disabled) p.update(0.1); });
    run();
    return true;
  };
})();
