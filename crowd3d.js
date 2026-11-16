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
    const wall = mat(0xf6ead7), trim = mat(0x6b4a35), wood = mat(0x9a6a45), cream = mat(0xfff7ef);
    const sideW = (SHOP_W - DOOR_W) / 2;
    const sideX = DOOR_W / 2 + sideW / 2;
    const textTex = (w, h, draw) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const tex = new T.CanvasTexture(c);
      const run = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g); tex.needsUpdate = true; };
      run();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
      return tex;
    };

    // walls: two side panels + lintel panel, wooden skirting, stone plinth
    box(sideW, SHOP_H, 0.3, wall, -sideX, SHOP_H / 2, FRONT_Z, shop);
    box(sideW, SHOP_H, 0.3, wall, sideX, SHOP_H / 2, FRONT_Z, shop);
    box(DOOR_W, SHOP_H - DOOR_H, 0.3, wall, 0, DOOR_H + (SHOP_H - DOOR_H) / 2, FRONT_Z, shop);
    box(sideW, 0.7, 0.34, wood, -sideX, 0.35, FRONT_Z, shop);
    box(sideW, 0.7, 0.34, wood, sideX, 0.35, FRONT_Z, shop);
    box(SHOP_W + 0.25, 0.12, 0.62, mat(0xb9b0a4), 0, 0.06, FRONT_Z + 0.1, shop);
    box(0.14, SHOP_H, 0.36, trim, -SHOP_W / 2 + 0.07, SHOP_H / 2, FRONT_Z, shop);   // corner posts
    box(0.14, SHOP_H, 0.36, trim, SHOP_W / 2 - 0.07, SHOP_H / 2, FRONT_Z, shop);
    box(SHOP_W, 0.1, 0.36, trim, 0, SHOP_H - 0.05, FRONT_Z, shop);                  // top beam
    // doorway
    box(DOOR_W + 0.22, 0.12, 0.4, trim, 0, DOOR_H + 0.06, FRONT_Z, shop);
    box(0.11, DOOR_H, 0.4, trim, -DOOR_W / 2 - 0.055, DOOR_H / 2, FRONT_Z, shop);
    box(0.11, DOOR_H, 0.4, trim, DOOR_W / 2 + 0.055, DOOR_H / 2, FRONT_Z, shop);
    const glowTexW = radialTexture('rgba(255,236,190,.95)', 'rgba(255,200,120,0)');
    box(DOOR_W + 0.1, DOOR_H, 1.8, basic(0x2a1a12), 0, DOOR_H / 2, FRONT_Z - 0.95, shop);
    const inner = new T.Mesh(new T.PlaneGeometry(DOOR_W, DOOR_H), basic(0xffffff, { map: glowTexW, transparent: true, opacity: 0.95, depthWrite: false }));
    inner.position.set(0, DOOR_H / 2, FRONT_Z - 1.7);
    shop.add(inner);
    // noren curtain (sways a little)
    const noren = new T.Group();
    noren.position.set(0, DOOR_H - 0.02, FRONT_Z + 0.2);
    const norenTex = textTex(128, 128, g => { g.fillStyle = '#b5322b'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff7ef'; g.font = '700 74px "Noto Serif TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('餃', 64, 66); });
    const strips = [];
    for (let i = 0; i < 3; i++) {
      const sw0 = (DOOR_W - 0.06) / 3;
      const st = new T.Group();
      st.position.set(-DOOR_W / 2 + 0.03 + sw0 * (i + 0.5), 0, 0);
      const sm = new T.Mesh(new T.PlaneGeometry(sw0 - 0.03, 0.4), i === 1 ? basic(0xffffff, { map: norenTex, side: T.DoubleSide }) : basic(0xb5322b, { side: T.DoubleSide }));
      sm.position.y = -0.2;
      st.add(sm);
      noren.add(st); strips.push(st);
    }
    box(DOOR_W + 0.06, 0.04, 0.04, trim, 0, 0, 0, noren);
    shop.add(noren);
    // windows with frames and warm glow
    [-1, 1].forEach(side => {
      const wx = side * sideX;
      const ww = side < 0 ? 1.05 : 0.8;
      const wxx = side < 0 ? wx : wx - 0.06;
      const gl = new T.Mesh(new T.PlaneGeometry(ww, 1.05), basic(0xffffff, { map: glowTexW, transparent: true, opacity: 1 }));
      gl.material.color.set(0xffdca0);
      gl.position.set(wxx, 1.62, FRONT_Z + 0.16);
      shop.add(gl);
      box(ww + 0.12, 0.07, 0.1, trim, wxx, 2.17, FRONT_Z + 0.2, shop);
      box(ww + 0.12, 0.07, 0.1, trim, wxx, 1.07, FRONT_Z + 0.2, shop);
      box(0.07, 1.17, 0.1, trim, wxx - ww / 2 - 0.03, 1.62, FRONT_Z + 0.2, shop);
      box(0.07, 1.17, 0.1, trim, wxx + ww / 2 + 0.03, 1.62, FRONT_Z + 0.2, shop);
      box(0.04, 1.05, 0.06, trim, wxx, 1.62, FRONT_Z + 0.2, shop);
    });
    // vertical banner on the right
    const bannerTex = textTex(96, 320, g => {
      g.fillStyle = '#c93a2e'; g.fillRect(0, 0, 96, 320);
      g.strokeStyle = '#f3d28a'; g.lineWidth = 5; g.strokeRect(6, 6, 84, 308);
      g.fillStyle = '#fff7ef'; g.font = '700 50px "Noto Serif TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['現', '煎', '鍋', '貼'].forEach((ch, i) => g.fillText(ch, 48, 52 + i * 70));
    });
    const banner = new T.Mesh(new T.PlaneGeometry(0.27, 0.9), basic(0xffffff, { map: bannerTex }));
    banner.position.set(SHOP_W / 2 - 0.3, 1.62, FRONT_Z + 0.2);
    shop.add(banner);
    // tiled roof
    const roofTex = textTex(128, 128, g => {
      g.fillStyle = '#5a3d2e'; g.fillRect(0, 0, 128, 128);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
        const x = c * 16 - (r % 2 ? 8 : 0), y = r * 16;
        g.fillStyle = (r + c) % 3 ? '#7a533c' : '#6a4731';
        g.beginPath(); g.arc(x + 8, y + 4, 8.4, 0, Math.PI); g.lineTo(x, y); g.lineTo(x + 16, y); g.fill();
        g.strokeStyle = 'rgba(30,18,12,.45)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 8, y + 4, 8.4, 0, Math.PI); g.stroke();
      }
    });
    roofTex.wrapS = roofTex.wrapT = T.RepeatWrapping; roofTex.repeat.set(5, 1.4);
    const roof = new T.Mesh(new T.BoxGeometry(SHOP_W + 0.6, 0.14, 1.34), new T.MeshLambertMaterial({ map: roofTex }));
    roof.position.set(0, SHOP_H + 0.4, FRONT_Z - 0.02);
    roof.rotation.x = 0.55;
    shop.add(roof);
    const ridge = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, SHOP_W + 0.7, 10), mat(0x3f2a1f));
    ridge.rotation.z = Math.PI / 2; ridge.position.set(0, SHOP_H + 0.76, FRONT_Z - 0.58);
    shop.add(ridge);
    [-1, 1].forEach(side => {          // little "shachi" ridge ends
      const e = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), mat(0xd8783d));
      e.position.set(side * (SHOP_W / 2 + 0.38), SHOP_H + 0.82, FRONT_Z - 0.58);
      shop.add(e);
    });
    // striped awning with scalloped edge
    const awning = new T.Group();
    awning.position.set(0, 2.62, FRONT_Z + 0.55);
    awning.rotation.x = 0.28;
    const stripes = 10, sw = (SHOP_W + 0.4) / stripes;
    for (let i = 0; i < stripes; i++) {
      const col = i % 2 ? 0xfff7ef : 0xd8783d;
      const x0 = -(SHOP_W + 0.4) / 2 + sw * (i + 0.5);
      box(sw, 0.1, 1.15, mat(col), x0, 0, 0, awning);
      const scallop = new T.Mesh(new T.CylinderGeometry(sw / 2, sw / 2, 0.1, 14, 1, false, 0, Math.PI), mat(col));
      scallop.rotation.x = Math.PI / 2; scallop.rotation.y = Math.PI / 2;
      scallop.position.set(x0, 0, 0.575);
      awning.add(scallop);
    }
    shop.add(awning);
    // sign board
    const signTex = textTex(512, 128, g => {
      g.fillStyle = '#32241e';
      g.beginPath(); if (g.roundRect) g.roundRect(4, 8, 504, 112, 22); else g.rect(4, 8, 504, 112); g.fill();
      g.strokeStyle = '#e8b04e'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#fff7ef'; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = '700 62px "Noto Serif TC", serif'; g.fillText('餃酌', 150, 68);
      g.font = '600 26px "DM Sans", sans-serif'; g.fillStyle = '#f3bc8e'; g.fillText('JIAO ZHUO', 350, 70);
    });
    const sign = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), basic(0xffffff, { map: signTex, transparent: true }));
    sign.position.set(0, 3.0, FRONT_Z + 0.17);
    shop.add(sign);
    // paper lanterns
    const lanterns = [];
    const lanternGlow = radialTexture('rgba(255,120,70,.8)', 'rgba(255,120,70,0)');
    [-1, 1].forEach((side, i) => {
      const g = new T.Group();
      g.position.set(side * (SHOP_W / 2 - 0.05), 2.5, FRONT_Z + 1.02);
      const body = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), basic(0xe03a2c)); body.scale.set(1, 1.2, 1); body.position.y = -0.36; g.add(body);
      [0.2, -0.2].forEach(dy => { const cap = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.05, 10), basic(0xe8b04e)); cap.position.y = -0.36 + dy * 1.0; g.add(cap); });
      const tassel = new T.Mesh(new T.CylinderGeometry(0.012, 0.025, 0.16, 6), basic(0xe8b04e)); tassel.position.y = -0.69; g.add(tassel);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: lanternGlow, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.8 }));
      glow.scale.setScalar(0.9); glow.position.y = -0.36; g.add(glow);
      const cord = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.14, 4), basic(0x2a1a12)); cord.position.y = -0.07; g.add(cord);
      shop.add(g); lanterns.push({ g, i });
    });
    // stall counter with steamer baskets and rising steam
    const counterX = -sideX - 0.1;
    box(1.35, 0.62, 0.46, wood, counterX, 0.43, FRONT_Z + 0.42, shop);
    box(1.45, 0.07, 0.54, trim, counterX, 0.775, FRONT_Z + 0.42, shop);
    const bamboo = mat(0xe3bd7c), bambooDark = mat(0xc99a58);
    [-0.28, 0.3].forEach((dx, k) => {
      const base = 0.81;
      for (let l = 0; l < 2 + k; l++) {
        const ring = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.13, 18), l % 2 ? bamboo : bambooDark);
        ring.position.set(counterX + dx, base + 0.065 + l * 0.13, FRONT_Z + 0.42); shop.add(ring);
      }
      const lid = new T.Mesh(new T.ConeGeometry(0.24, 0.1, 18), bamboo);
      lid.position.set(counterX + dx, base + (2 + k) * 0.13 + 0.05, FRONT_Z + 0.42); shop.add(lid);
    });
    const steamTex = radialTexture('rgba(255,255,255,.85)', 'rgba(255,255,255,0)');
    const puffs = [];
    for (let i = 0; i < 10; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.userData = { off: i / 10, dx: i % 2 ? 0.3 : -0.28, h: i % 2 ? 1.34 : 1.2 };
      shop.add(sp); puffs.push(sp);
    }
    // potted shrubs
    const shrub = (x, z) => {
      const g = new T.Group(); g.position.set(x, 0, z);
      const pot = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.26, 12), mat(0xc9754a)); pot.position.y = 0.13; g.add(pot);
      [[0, 0.5, 0, 0.22], [-0.12, 0.42, 0.05, 0.15], [0.12, 0.44, -0.03, 0.16], [0.02, 0.68, 0.02, 0.15]].forEach(([px, py, pz, r]) => {
        const l = new T.Mesh(new T.SphereGeometry(r, 10, 8), mat(0x6f9a4f)); l.position.set(px, py, pz); g.add(l);
      });
      shop.add(g);
    };
    shrub(DOOR_W / 2 + 0.38, FRONT_Z + 0.5);
    shrub(SHOP_W / 2 + 0.12, FRONT_Z + 0.6);
    // warm light spilling out of the door
    const spill = new T.Mesh(new T.PlaneGeometry(3.4, 2.4), basic(0xffffff, { map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.02, FRONT_Z + 1.1);
    shop.add(spill);
    const doorLight = new T.PointLight(0xffb066, 0.9, 7);
    doorLight.position.set(0, 1.6, FRONT_Z + 0.8);
    shop.add(doorLight);
    shop.scale.setScalar(1.08);
    function shopTick(t) {
      strips.forEach((st, i) => { st.rotation.z = Math.sin(t * 1.4 + i * 0.9) * 0.05; });
      lanterns.forEach(l => { l.g.rotation.z = Math.sin(t * 1.2 + l.i * 1.7) * 0.07; });
      puffs.forEach(sp => {
        const ph = (t * 0.28 + sp.userData.off) % 1;
        sp.position.set(counterX + sp.userData.dx + Math.sin(t * 1.5 + sp.userData.off * 12) * 0.06 * ph, sp.userData.h + ph * 0.95, FRONT_Z + 0.42);
        sp.scale.setScalar(0.22 + ph * 0.55);
        sp.material.opacity = 0.62 * Math.sin(Math.min(1, ph * 1.15) * Math.PI) * (1 - ph * 0.4);
      });
    }

    // ---- pedestrians ---------------------------------------------------------------------
    const TOPS = [0xffffff, 0xfff0d6, 0x3f9aa3, 0x6f9bd1, 0x7fb069, 0xf08fa0, 0xe8c547, 0xb79ce0];
    const PANTS = [0x3b4b6b, 0x4b5d78, 0x8a94a6, 0x2f4a7a, 0x5a4a58];
    const SKINS = [0xffdcc0, 0xf2c29b, 0xd9a073, 0xb57a52];
    const HAIRS = [0x2b1d15, 0x4a3224, 0x1f1612, 0x8a5a38, 0xc58b4a];
    const ACCENTS = [0xd8783d, 0xf08fa0, 0x3f9aa3, 0xe8c547, 0x7fb069, 0xffffff];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const rand = (a, b) => a + Math.random() * (b - a);
    const GAIT = 6.2;
    const HIP_Y = 0.47;

    const G = {
      sph: new T.SphereGeometry(1, 18, 14),
      leg: new T.CylinderGeometry(0.075, 0.068, 0.44, 10),
      arm: new T.CylinderGeometry(0.05, 0.045, 0.3, 8),
      hairCap: new T.SphereGeometry(0.33, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      beanie: new T.SphereGeometry(0.345, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      mouth: new T.TorusGeometry(0.04, 0.009, 6, 14, Math.PI),
      circle: new T.CircleGeometry(0.06, 14),
      cone: new T.CylinderGeometry(0.17, 0.33, 0.4, 16),
      bag: new T.BoxGeometry(0.2, 0.24, 0.1),
      pack: new T.BoxGeometry(0.3, 0.34, 0.12),
      scarf: new T.TorusGeometry(0.19, 0.05, 8, 18),
      tail: new T.BoxGeometry(0.07, 0.2, 0.04)
    };

    class Person {
      constructor() {
        this.root = new T.Group();
        const top = pick(TOPS), accent = pick(ACCENTS);
        const dress = Math.random() < 0.3;
        const M = this.mats = {
          top: mat(top), pants: mat(pick(PANTS)), skin: mat(pick(SKINS)), hair: mat(pick(HAIRS)), shoe: mat(0x3a2a21),
          accent: mat(accent), eye: basic(0x2a1a14), glint: basic(0xffffff), blush: basic(0xff8f9c), mouth: basic(0x8a3b3b),
          bagM: mat(0xd8783d), bagTop: mat(0xfff7ef)
        };
        Object.keys(M).forEach(k => { M[k].transparent = true; });
        const body = new T.Group(); this.body = body; this.root.add(body);
        const S = (mat0, r, sx, sy, sz, x, y, z, parent) => { const m = new T.Mesh(G.sph, mat0); m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z); (parent || body).add(m); return m; };
        // torso (+ hips or dress)
        S(M.top, 1, 0.25, 0.3, 0.21, 0, 0.74, 0);
        if (dress) { const sk = new T.Mesh(G.cone, M.top); sk.position.y = 0.6; body.add(sk); }
        else S(M.pants, 1, 0.22, 0.14, 0.19, 0, 0.55, 0);
        // legs
        const mkLeg = x => {
          const pv = new T.Group(); pv.position.set(x, HIP_Y, 0);
          const l = new T.Mesh(G.leg, M.pants); l.position.y = -0.22; pv.add(l);
          S(M.shoe, 1, 0.1, 0.065, 0.15, 0, -0.45, 0.04, pv);
          body.add(pv); return pv;
        };
        this.legL = mkLeg(-0.1); this.legR = mkLeg(0.1);
        // arms
        const mkArm = x => {
          const pv = new T.Group(); pv.position.set(x, 0.88, 0);
          const inner = new T.Group(); inner.rotation.z = x < 0 ? 0.18 : -0.18; pv.add(inner);
          const a = new T.Mesh(G.arm, M.top); a.position.y = -0.15; inner.add(a);
          S(M.skin, 1, 0.058, 0.058, 0.058, 0, -0.32, 0, inner);
          body.add(pv); return { pv, inner };
        };
        const aL = mkArm(-0.28), aR = mkArm(0.28);
        this.armL = aL.pv; this.armR = aR.pv;
        // takeaway bag in the right hand (shown for people leaving the shop)
        const bag = new T.Group(); bag.position.set(0, -0.44, 0.05);
        bag.add(new T.Mesh(G.bag, M.bagM));
        const flap = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.105), M.bagTop); flap.position.y = 0.09; bag.add(flap);
        aR.inner.add(bag); this.bag = bag; bag.visible = false;
        // head
        const head = new T.Group(); head.position.y = 1.13; body.add(head);
        const hm = new T.Mesh(G.sph, M.skin); hm.scale.set(0.31, 0.29, 0.3); head.add(hm);
        [-1, 1].forEach(sd => {
          S(M.eye, 1, 0.036, 0.046, 0.026, sd * 0.11, 0.0, 0.282, head);
          S(M.glint, 1, 0.012, 0.012, 0.01, sd * 0.11 + 0.01, 0.017, 0.304, head);
          const bl = new T.Mesh(G.circle, M.blush); bl.position.set(sd * 0.19, -0.08, 0.225); bl.rotation.y = sd * 0.62; bl.scale.set(1.2, 0.75, 1); head.add(bl);
        });
        const mouth = new T.Mesh(G.mouth, M.mouth); mouth.position.set(0, -0.085, 0.283); mouth.rotation.z = Math.PI; head.add(mouth);
        S(M.skin, 1, 0.026, 0.02, 0.02, 0, -0.01, 0.298, head);       // tiny nose bump
        // hair / hats
        const style = Math.floor(Math.random() * 5);
        const cap = (geo, mm) => { const c = new T.Mesh(geo, mm); c.position.set(0, 0.01, -0.02); c.rotation.x = -0.28; head.add(c); return c; };
        const fringe = () => [[-0.13, 0.19, 0.25], [0, 0.22, 0.27], [0.13, 0.19, 0.25]].forEach(([x, y, z]) => S(M.hair, 1, 0.085, 0.07, 0.06, x, y, z, head));
        if (style === 0) { cap(G.hairCap, M.hair); fringe(); }
        else if (style === 1) { cap(G.hairCap, M.hair); fringe(); S(M.hair, 1, 0.12, 0.12, 0.12, 0, 0.37, -0.06, head); }
        else if (style === 2) { cap(G.hairCap, M.hair); fringe(); S(M.hair, 1, 0.1, 0.1, 0.1, -0.27, 0.24, -0.04, head); S(M.hair, 1, 0.1, 0.1, 0.1, 0.27, 0.24, -0.04, head); }
        else if (style === 3) { cap(G.hairCap, M.hair); const b = cap(G.beanie, M.accent); b.position.y = 0.04; S(M.accent, 1, 0.09, 0.09, 0.09, 0, 0.36, -0.02, head); S(M.hair, 1, 0.085, 0.06, 0.05, -0.14, 0.15, 0.25, head); S(M.hair, 1, 0.085, 0.06, 0.05, 0.14, 0.15, 0.25, head); }
        else { const b = cap(G.hairCap, M.accent); b.scale.setScalar(1.01); S(M.accent, 1, 0.1, 0.1, 0.08, -0.22, 0.27, -0.03, head); S(M.accent, 1, 0.1, 0.1, 0.08, 0.22, 0.27, -0.03, head); S(M.blush, 1, 0.05, 0.05, 0.04, -0.22, 0.27, 0.03, head); S(M.blush, 1, 0.05, 0.05, 0.04, 0.22, 0.27, 0.03, head); fringe(); }
        // accessories
        if (Math.random() < 0.38) { const sc = new T.Mesh(G.scarf, M.accent); sc.rotation.x = Math.PI / 2; sc.position.y = 0.97; body.add(sc); const tl = new T.Mesh(G.tail, M.accent); tl.position.set(0.1, 0.86, 0.19); tl.rotation.z = 0.15; body.add(tl); }
        if (Math.random() < 0.35) { const pk = new T.Mesh(G.pack, M.accent); pk.position.set(0, 0.74, -0.21); body.add(pk); }
        // shadow
        this.shadow = new T.Mesh(new T.PlaneGeometry(0.85, 0.85), basic(0xffffff, { map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false }));
        this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.015;
        this.root.add(this.shadow);
        this.root.scale.setScalar(rand(1.12, 1.26));
        this.shadowBase = 0.5;
        this.phase = rand(0, 6);
        this.state = 'wait';
        this.timer = rand(0, 4);
        this.heading = 0; this.target = 0;
        this.speed = 1;
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
        this.speed = rand(0.8, 1.25);
        this.dir = Math.random() < 0.5 ? 1 : -1;
        this.bag.visible = false;
        if (r < 0.34) {                                  // customer: walks to the door and goes in
          this.state = 'toDoor';
          this.root.position.set(-this.dir * edge, 0, rand(-1.55, -1.25));
          this.heading = this.target = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          this.setOpacity(1);
        } else if (r < 0.52) {                           // leaves the shop with a takeaway bag
          this.state = 'exiting';
          this.bag.visible = true;
          this.root.position.set(layout.shopX + rand(-0.2, 0.2), 0, FRONT_Z - 0.5);
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
        this.legL.rotation.x = s * 0.6; this.legR.rotation.x = -s * 0.6;
        this.armL.rotation.x = -s * 0.5; this.armR.rotation.x = s * 0.5;
        this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.045;
        this.body.rotation.z = Math.cos(this.phase) * 0.05;       // gentle waddle
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
            p.x += (layout.shopX - p.x) * Math.min(1, dt * 3);
            if (p.z < FRONT_Z - 0.6) this.finish();
            break;
          }
          case 'exiting': {
            this.setOpacity(Math.min(1, (p.z - (FRONT_Z - 0.55)) / 0.9 + 0.05));
            if (p.z > -1.3) {
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
      shopTick(now / 1000);
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
