/* ============================================================
   FermenTaal — interactive 3D brand site
   Vanilla JS · three.js r137 · GSAP ScrollTrigger · Lenis
   ------------------------------------------------------------
   EDIT YOUR DETAILS HERE  ↓↓↓
   ============================================================ */
const CONFIG = {
  whatsappNumber: "919410795450",            // country code + number, digits only
  whatsappMessage: "Hi FermenTaal! 🍍 I'd like to order some pineapple kombucha. How many bottles can I get?",
  instagramHandle: "fermentaal",             // → instagram.com/fermentaal (confirmed)

  // --- Hero bottle ---
  // "procedural" = the orbitable, true-3D glass bottle built in code (the showstopper —
  //                drag to spin, glass refraction, rising bubbles). This is the default.
  // "photo"      = show the real studio product photo (assets/bottle.jpg) on a gently
  //                swaying plane instead. Flat, not spinnable, but it's the real bottle.
  heroBottle: "photo",
  bottleImage: "assets/bottle-cutout.png",
  bottleCutout: true,   // bottleImage already has a transparent background → floats on the cream page
  // Which slice of the photo to show (0..1) when heroBottle = "photo". Frames the
  // centred bottle in the 2000x1116 cutout. x/w = horizontal, y/h = vertical.
  bottleCrop: { x: 0.40, y: 0.11, w: 0.20, h: 0.82 },
  // Set true if the photo has a clean WHITE background you want keyed out further.
  // Leave false for background-removed PNGs or to protect glass/cap highlights.
  bottleWhiteKey: false,
};

/* ---------- Wire up order links + footer year (works even if 3D fails) ---------- */
(function wireLinks() {
  const wa = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(CONFIG.whatsappMessage)}`;
  const ig = `https://instagram.com/${CONFIG.instagramHandle}`;
  const set = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };
  set("wa-link", wa);
  set("ig-link", ig);
  set("ig-link-2", ig);
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Scroll choreography (pinning, scrubbing, splitting) only runs with GSAP + motion OK.
const MOTION = !REDUCED && !!window.gsap && !!window.ScrollTrigger;

/* ============================================================
   THREE.JS SCENE
   ============================================================ */
let renderer, scene, camera, bottleGroup, bottle, bubbles;
let envRT;
const canvas = document.getElementById("webgl");

// Animated state lerped each frame
const view = { x: 0, y: 0, scale: 1, spin: 0 };
const target = { x: 0, y: 0, scale: 1 };
// Extra pose the pinned showcase scrubs (tilt around Y, lean around Z)
const lean = { y: 0, z: 0 };
let dragSpin = 0, dragVel = 0, spinAuto = 0;
const pointer = { x: 0, y: 0 };
let rendering = true;

function isMobile() { return window.innerWidth < 900; }

function initThree() {
  if (!window.THREE) throw new Error("three.js not loaded");

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#fbf3e4");

  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.15, 6.6);
  camera.lookAt(0, 0, 0);

  // Environment for realistic glass reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  envRT = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  // Lights for warm highlights on top of the env
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const warm = new THREE.PointLight(0xffd9a0, 18, 20);
  warm.position.set(-2.5, 1.5, 3);
  scene.add(warm);
  const rim = new THREE.DirectionalLight(0xffe9c8, 1.0);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  buildBottle();

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => { rendering = !document.hidden; });
  setupPointer();

  renderer.setAnimationLoop(tick);
}

/* ---------- Bottle: real product photo (preferred), procedural fallback ---------- */
function buildBottle() {
  bottleGroup = new THREE.Group();   // scroll moves this (x / y / scale)
  bottle = new THREE.Group();        // tilt / spin lives here
  bottleGroup.add(bottle);
  scene.add(bottleGroup);

  // Default to the orbitable, true-3D procedural bottle (the showstopper).
  if (CONFIG.heroBottle !== "photo") { buildProceduralBottle(); return; }

  // Opt-in: real studio photo on a swaying plane.
  new THREE.TextureLoader().load(
    CONFIG.bottleImage,
    (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      buildPhotoBottle(tex);
    },
    undefined,
    () => { console.warn("Bottle photo not found at " + CONFIG.bottleImage + " — using procedural bottle."); buildProceduralBottle(); }
  );
}

/* ---------- Real product photo on an interactive plane ---------- */
let photoMode = false;
function buildPhotoBottle(tex) {
  photoMode = true;
  const cutout = !!CONFIG.bottleCutout;
  // A cutout already has a transparent background → keep the cream page behind it.
  // A plain white-bg photo gets a soft studio sweep so its background blends in.
  if (!cutout) scene.background = studioBackdrop();

  const cr = CONFIG.bottleCrop;
  const img = tex.image;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(cr.w, cr.h);
  tex.offset.set(cr.x, 1 - cr.y - cr.h);

  const aspect = (img.width * cr.w) / (img.height * cr.h);
  const H = 3.7, W = H * aspect;

  // NOTE: a ShaderMaterial does NOT auto-apply tex.offset/repeat — the vertex shader
  // must do it. vUv stays 0..1 for the plane-edge feather; vTex is the cropped sample.
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      map: { value: tex },
      uOffset: { value: new THREE.Vector2(cr.x, 1 - cr.y - cr.h) },
      uRepeat: { value: new THREE.Vector2(cr.w, cr.h) },
      uFeather: { value: cutout ? 0.004 : 0.09 },
      uKey: { value: (!cutout && CONFIG.bottleWhiteKey) ? 1.0 : 0.0 },
    },
    vertexShader:
      "varying vec2 vUv; varying vec2 vTex; uniform vec2 uOffset; uniform vec2 uRepeat;" +
      "void main(){ vUv = uv; vTex = uv * uRepeat + uOffset; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; varying vec2 vTex; uniform sampler2D map; uniform float uFeather; uniform float uKey;" +
      "void main(){ vec4 c = texture2D(map, vTex);" +
      "float fx = smoothstep(0.0, uFeather, vUv.x) * smoothstep(1.0, 1.0-uFeather, vUv.x);" +
      "float fy = smoothstep(0.0, uFeather, vUv.y) * smoothstep(1.0, 1.0-uFeather, vUv.y);" +
      "float a = c.a * fx * fy;" +
      "float lum = dot(c.rgb, vec3(0.299,0.587,0.114));" +
      "a *= mix(1.0, 1.0 - smoothstep(0.90, 0.99, lum), uKey);" +
      "if(a < 0.01) discard; gl_FragColor = vec4(c.rgb, a); }",
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  bottle.add(plane);
}

function studioBackdrop() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(256, 210, 30, 256, 280, 380);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.55, "#fbf4e8"); g.addColorStop(1, "#efe1cb");
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

/* ---------- Procedural glass bottle (fallback) ---------- */
function buildProceduralBottle() {
  bottle.position.y = -1.42;         // centre the silhouette at the origin

  // --- glass shell (surface of revolution) ---
  const profile = [
    [0.00, 0.00], [0.46, 0.00], [0.50, 0.06],
    [0.50, 1.60], [0.49, 1.74], [0.45, 1.87],
    [0.37, 2.01], [0.27, 2.15], [0.195, 2.30],
    [0.175, 2.48], [0.175, 2.70], [0.198, 2.77], [0.178, 2.84],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const glassGeo = new THREE.LatheGeometry(profile, 80);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1.0,
    thickness: 0.55,
    roughness: 0.06,
    ior: 1.5,
    metalness: 0,
    envMapIntensity: 1.5,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    transparent: true,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.renderOrder = 2;
  bottle.add(glass);

  // --- amber liquid inside (filled ~80%) ---
  const liq = [
    [0.00, 0.05], [0.455, 0.05], [0.455, 1.50], [0.00, 1.52],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const liqGeo = new THREE.LatheGeometry(liq, 64);
  const liqMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc6a16,
    transmission: 0.42,
    thickness: 1.4,
    roughness: 0.18,
    ior: 1.34,
    attenuationColor: new THREE.Color(0xc04e12),
    attenuationDistance: 0.7,
    envMapIntensity: 1.0,
    transparent: true,
  });
  const liquid = new THREE.Mesh(liqGeo, liqMat);
  liquid.renderOrder = 1;
  bottle.add(liquid);

  // --- gold cap ---
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xcb9a37, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.4,
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.20, 56), capMat);
  cap.position.y = 2.80;
  bottle.add(cap);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.207, 0.207, 0.03, 56), capMat);
  capTop.position.y = 2.905;
  bottle.add(capTop);

  // --- wraparound label (canvas texture) ---
  const labelTex = makeLabelTexture();
  const labelGeo = new THREE.CylinderGeometry(0.508, 0.508, 0.92, 80, 1, true);
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.5,
    side: THREE.FrontSide,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.y = 0.74;
  label.rotation.y = Math.PI; // bring the centred art to face the camera (+Z)
  label.renderOrder = 3;
  bottle.add(label);

  buildBubbles();
}

/* ---------- Canvas-drawn label art ---------- */
function makeLabelTexture() {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 460;
  const x = c.getContext("2d");

  // Orange field (full wrap, so any side facing the camera reads as the label)
  const g = x.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, "#d85f17");
  g.addColorStop(0.5, "#ee8623");
  g.addColorStop(1, "#d2570f");
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);

  // Everything is centred → maps to the front of the bottle after a 180° turn.
  const cx = c.width * 0.5;

  // Top line
  x.fillStyle = "#ffffff";
  x.textAlign = "center";
  x.font = "600 30px Inter, Arial, sans-serif";
  x.fillText("Homemade in Dehradun", cx, 56);
  x.font = "400 21px Inter, Arial, sans-serif";
  x.globalAlpha = 0.9;
  x.fillText("(all natural ingredients)", cx, 86);
  x.globalAlpha = 1;

  // Pineapple motif
  drawPineapple(x, cx - 6, 118, 0.9);

  // Wordmark
  x.fillStyle = "#241a12";
  x.font = "500 92px Fraunces, Georgia, serif";
  x.fillText("Fermen", cx, 300);
  x.fillText("Taal", cx, 372);

  // Flavour + tag
  x.fillStyle = "#5a3410";
  x.font = "italic 400 40px Fraunces, Georgia, serif";
  x.fillText("Pineapple", cx, 414);

  x.fillStyle = "#ffffff";
  roundRect(x, cx - 92, 426, 184, 30, 6); x.fill();
  x.fillStyle = "#241a12";
  x.font = "600 21px Inter, Arial, sans-serif";
  x.fillText("KOMBUCHA", cx, 448);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function drawPineapple(x, cx, cy, s) {
  x.save();
  x.translate(cx + 150, cy);
  x.scale(s, s);
  // body
  const bg = x.createLinearGradient(0, -10, 0, 80);
  bg.addColorStop(0, "#ffd54a"); bg.addColorStop(1, "#f4a72a");
  x.fillStyle = bg;
  x.beginPath(); x.ellipse(0, 35, 34, 46, 0, 0, Math.PI * 2); x.fill();
  // cross-hatch
  x.strokeStyle = "rgba(120,70,10,0.55)"; x.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    x.beginPath(); x.moveTo(-30, 20 + i * 14); x.lineTo(30, 35 + i * 14); x.stroke();
    x.beginPath(); x.moveTo(-30, 35 + i * 14); x.lineTo(30, 20 + i * 14); x.stroke();
  }
  // leaves
  x.fillStyle = "#3f7d32";
  for (const a of [-0.5, 0, 0.5]) {
    x.save(); x.rotate(a);
    x.beginPath(); x.moveTo(0, -8); x.quadraticCurveTo(10, -45, 0, -64);
    x.quadraticCurveTo(-10, -45, 0, -8); x.fill();
    x.restore();
  }
  x.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- Rising bubbles ---------- */
function buildBubbles() {
  const N = REDUCED ? 0 : 70;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    resetBubble(pos, i, true);
    speed[i] = 0.004 + Math.random() * 0.01;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, map: bubbleSprite(), transparent: true, opacity: 0.5,
    depthWrite: false, sizeAttenuation: true, color: 0xfff3d8,
  });
  bubbles = new THREE.Points(geo, mat);
  bubbles.userData.speed = speed;
  bubbles.renderOrder = 4;
  bottle.add(bubbles);
}
function resetBubble(pos, i, randomY) {
  const r = Math.random() * 0.38;
  const a = Math.random() * Math.PI * 2;
  pos[i * 3] = Math.cos(a) * r;
  pos[i * 3 + 1] = randomY ? 0.1 + Math.random() * 1.3 : 0.08;
  pos[i * 3 + 2] = Math.sin(a) * r;
}
function bubbleSprite() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.4, "rgba(255,245,220,0.5)");
  g.addColorStop(1, "rgba(255,245,220,0)");
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill();
  return new THREE.CanvasTexture(c);
}

/* ---------- Pointer drag-to-spin + parallax ---------- */
function setupPointer() {
  let down = false, lastX = 0;
  const start = (e) => { down = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); dragVel = 0; };
  const move = (e) => {
    const cxp = (e.touches ? e.touches[0].clientX : e.clientX);
    const cyp = (e.touches ? e.touches[0].clientY : e.clientY);
    pointer.x = (cxp / window.innerWidth) * 2 - 1;
    pointer.y = (cyp / window.innerHeight) * 2 - 1;
    if (down) { const dx = cxp - lastX; lastX = cxp; dragVel = dx * 0.006; dragSpin += dragVel; }
  };
  const end = () => { down = false; };
  canvas.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: true });
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("touchend", end);
}

/* ---------- Resize ---------- */
function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyStage(); // re-evaluate responsive target
}

/* ---------- Render loop ---------- */
function tick() {
  if (!rendering) return;
  const t = performance.now() * 0.001;

  // smooth follow scroll target (shared)
  view.x += (target.x - view.x) * 0.07;
  view.y += (target.y - view.y) * 0.07;
  view.scale += (target.scale - view.scale) * 0.07;
  bottleGroup.position.x = view.x;
  bottleGroup.scale.setScalar(view.scale);

  if (photoMode) {
    // Flat photo → gentle float + sway + drag-tilt that eases back to neutral
    dragSpin += dragVel; dragVel *= 0.9; dragSpin *= 0.92;
    const sway = (REDUCED ? 0 : Math.sin(t * 0.6) * 0.05) + pointer.x * 0.18 + dragSpin;
    view.spin += (Math.max(-0.5, Math.min(0.5, sway)) - view.spin) * 0.08;
    bottle.rotation.y = view.spin + lean.y;
    bottle.rotation.x += ((pointer.y * 0.05) - bottle.rotation.x) * 0.05;
    bottle.rotation.z += (lean.z - bottle.rotation.z) * 0.08;
    const bob = REDUCED ? 0 : Math.sin(t * 0.9) * 0.045;
    bottleGroup.position.y = view.y + bob;
    camera.position.x += ((pointer.x * 0.16) - camera.position.x) * 0.04;
  } else {
    // Procedural 3D bottle → idle auto-rotate + drag inertia
    if (!REDUCED) spinAuto += 0.0024;
    dragSpin += dragVel; dragVel *= 0.92;
    view.spin += ((spinAuto + dragSpin) - view.spin) * 0.08;
    bottleGroup.position.y = view.y;
    bottle.rotation.y = view.spin + lean.y;
    bottle.rotation.x += ((pointer.y * 0.12) - bottle.rotation.x) * 0.05;
    bottle.rotation.z += (lean.z - bottle.rotation.z) * 0.08;
    camera.position.x += ((pointer.x * 0.25) - camera.position.x) * 0.04;
  }
  camera.lookAt(0, 0, 0);

  // bubbles
  if (bubbles) {
    const p = bubbles.geometry.attributes.position.array;
    const sp = bubbles.userData.speed;
    for (let i = 0; i < sp.length; i++) {
      p[i * 3 + 1] += sp[i];
      if (p[i * 3 + 1] > 1.4) resetBubble(p, i, false);
    }
    bubbles.geometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

/* ============================================================
   SCROLL CHOREOGRAPHY  (Lenis + GSAP ScrollTrigger)
   ------------------------------------------------------------
   Apple-style chapters:
   1. Hero          — intro rise on load, headline scrubs away on scroll
   2. Showcase      — section PINS; scroll drives a guided bottle tour
                      with crossfading feature callouts
   3. Story         — bottle drifts into the text column (staged)
   4. Statement     — big line of copy fills in word by word
   5. Inside        — dark panel scales in; stat counters tick up
   6. Gallery       — pinned horizontal filmstrip driven by scroll
   ============================================================ */
let stage = "hero";
function applyStage() {
  if (stage === "showcase") return; // the pinned timeline owns the bottle here
  const m = isMobile();
  if (stage === "hero") {
    if (m && photoMode) {
      // Opaque photo bottle would sit on top of the headline — lift it above the text.
      target.x = 0.1; target.y = 1.6; target.scale = 0.48;
    } else {
      target.x = m ? 0 : 1.05; target.y = m ? 0.1 : 0; target.scale = m ? 0.82 : 1;
    }
  } else if (stage === "story") {
    target.x = m ? 0 : 1.75; target.y = m ? 0.2 : 0.05; target.scale = m ? 0.8 : 1.02;
  }
}

function initScroll() {
  // Smooth scrolling via Lenis (optional — falls back to native)
  let lenis = null;
  if (window.Lenis && !REDUCED) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  if (lenis) lenis.on("scroll", ScrollTrigger.update);

  // Flag: CSS switches the showcase into "stage mode" only when we choreograph it.
  if (MOTION) document.body.classList.add("js-motion");

  // Smooth-scroll all in-page anchors through Lenis (clears the fixed nav)
  if (lenis) {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (!id || id.length < 2) return;
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -76, duration: 1.4 });
        history.pushState(null, "", id);
      });
    });
  }

  // Sticky local nav slides in once the hero is mostly scrolled past
  const nav = document.getElementById("localnav");
  if (nav) {
    ScrollTrigger.create({
      start: () => window.innerHeight * 0.64,
      end: () => Math.max(ScrollTrigger.maxScroll(window), 99999),
      onToggle: (self) => nav.classList.toggle("is-in", self.isActive),
    });
  }

  // Reveal-on-scroll for any .reveal element
  gsap.utils.toArray(".reveal").forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: "top 86%",
      onEnter: () => el.classList.add("is-in"),
    });
  });

  // 3D bottle staging tied to sections
  applyStage();
  ScrollTrigger.create({
    trigger: "#story", start: "top 70%", end: "bottom top",
    onEnter: () => { stage = "story"; applyStage(); },
    onLeaveBack: () => { stage = MOTION ? "showcase" : "hero"; applyStage(); },
  });

  if (MOTION) {
    initHeroMotion();
    initShowcase();
    initStatement();
    initCounters();
    initPanels();
    initGallery();
  }

  // Fade the 3D canvas out once the bottle chapters are done (panels below are solid).
  // Desktop: after the story. Phones: as the story arrives (its media column is hidden).
  if (renderer) {
    const fadeCfg = isMobile()
      ? { trigger: "#story", start: "top 92%", end: "top 40%" }
      : { trigger: "#story", start: "bottom 60%", end: "bottom 10%" };
    ScrollTrigger.create({
      trigger: fadeCfg.trigger, start: fadeCfg.start, end: fadeCfg.end, scrub: true,
      onUpdate: (self) => {
        const o = 1 - self.progress;
        canvas.style.opacity = o.toFixed(3);
        const wasRendering = rendering;
        rendering = o > 0.02 && !document.hidden;
        if (rendering && !wasRendering) renderer.setAnimationLoop(tick);
      },
    });
  }

  // Let the hero canvas receive drags; ignore elsewhere
  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom top",
    onToggle: (self) => canvas.classList.toggle("interactive", self.isActive),
  });

  // Re-measure pinned distances once everything (fonts, images) has loaded
  window.addEventListener("load", () => ScrollTrigger.refresh());
}

/* ---------- 1 · Hero: rise on load, scrub away on scroll ---------- */
function initHeroMotion() {
  const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
  intro
    .from(".hero__brandmark .t", { y: 110, opacity: 0, duration: 1.2, stagger: 0.14 }, 0.1)
    .from(".hero__tagline", { y: 34, opacity: 0, duration: 0.9 }, 0.55)
    .from(".hero__cta .btn", { y: 26, opacity: 0, duration: 0.8, stagger: 0.09 }, 0.75)
    .from(".scroll-cue", { opacity: 0, duration: 1.0, ease: "none" }, 1.2);

  gsap.to(".hero__inner", {
    y: -90, opacity: 0, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 72%", scrub: true },
  });
  gsap.to(".scroll-cue", {
    opacity: 0, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "12% top", scrub: true },
  });
}

/* ---------- 2 · Showcase: pinned scroll-driven bottle tour ---------- */
function initShowcase() {
  const stageEl = document.querySelector(".showcase");
  if (!stageEl) return;
  const c1 = ".callout--1", c2 = ".callout--2", c3 = ".callout--3";
  const noWebgl = document.body.classList.contains("no-webgl");
  const fallback = ".showcase__fallback";

  const mm = gsap.matchMedia();

  const buildTimeline = (m) => {
    // m = mobile flag. Poses tuned per breakpoint (world units of the 3D scene).
    gsap.set([c1, c2], m ? { xPercent: -50 } : { yPercent: -50 });
    gsap.set(c3, { xPercent: -50 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stageEl,
        start: "top top",
        end: "+=320%",
        scrub: 0.6,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => { if (self.isActive) stage = "showcase"; },
        onLeaveBack: () => { stage = "hero"; applyStage(); },
        onLeave: () => { stage = "story"; applyStage(); },
      },
    });

    // Chapter 1 — the bottle rises to centre stage beneath the title
    // (desktop crops the bottle's base slightly — the "up close" moment)
    tl.to(target, m ? { x: 0, y: -0.15, scale: 0.55, duration: 1.3, ease: "power1.inOut" }
                    : { x: 0, y: -0.9, scale: 1.1, duration: 1.3, ease: "power1.inOut" }, 0);
    tl.fromTo(".showcase__title", { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "none" }, 0.9);
    tl.to(".showcase__title", { autoAlpha: 0, y: -40, duration: 0.7, ease: "none" }, 1.9);

    // Chapter 2 — drift left, first callout on the right
    tl.to(target, m ? { x: 0, y: 0.35, scale: 0.62, duration: 1.5, ease: "power1.inOut" }
                    : { x: -1.25, y: -0.05, scale: 1.15, duration: 1.5, ease: "power1.inOut" }, 2.3);
    tl.to(lean, { y: 0.2, z: 0.06, duration: 1.5, ease: "power1.inOut" }, 2.3);
    tl.fromTo(c1, m ? { autoAlpha: 0, y: 46 } : { autoAlpha: 0, x: 70 },
                  m ? { autoAlpha: 1, y: 0, duration: 0.9, ease: "none" } : { autoAlpha: 1, x: 0, duration: 0.9, ease: "none" }, 2.7);
    tl.to(c1, m ? { autoAlpha: 0, y: -30, duration: 0.6, ease: "none" } : { autoAlpha: 0, x: -50, duration: 0.6, ease: "none" }, 4.4);

    // Chapter 3 — drift right, second callout on the left
    tl.to(target, m ? { x: 0, y: 0.35, scale: 0.62, duration: 1.5, ease: "power1.inOut" }
                    : { x: 1.25, y: -0.05, scale: 1.15, duration: 1.5, ease: "power1.inOut" }, 4.7);
    tl.to(lean, { y: -0.2, z: -0.06, duration: 1.5, ease: "power1.inOut" }, 4.7);
    tl.fromTo(c2, m ? { autoAlpha: 0, y: 46 } : { autoAlpha: 0, x: -70 },
                  m ? { autoAlpha: 1, y: 0, duration: 0.9, ease: "none" } : { autoAlpha: 1, x: 0, duration: 0.9, ease: "none" }, 5.1);
    tl.to(c2, m ? { autoAlpha: 0, y: -30, duration: 0.6, ease: "none" } : { autoAlpha: 0, x: 50, duration: 0.6, ease: "none" }, 6.8);

    // Chapter 4 — settle back to centre, last callout below
    tl.to(target, m ? { x: 0, y: 0.3, scale: 0.58, duration: 1.5, ease: "power1.inOut" }
                    : { x: 0, y: 0.05, scale: 1.05, duration: 1.5, ease: "power1.inOut" }, 7.0);
    tl.to(lean, { y: 0, z: 0, duration: 1.5, ease: "power1.inOut" }, 7.0);
    tl.fromTo(c3, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "none" }, 7.5);
    tl.to({}, { duration: 1.0 }, 8.7); // hold the final frame for a beat

    // No WebGL → mirror the tour on the static cutout image instead
    if (noWebgl) {
      gsap.set(fallback, { xPercent: -50, yPercent: -50 });
      tl.fromTo(fallback, { scale: 0.9 }, { scale: 1.06, duration: 1.6, ease: "power1.inOut" }, 0);
      if (!m) {
        tl.to(fallback, { x: "-26vw", rotation: 4, duration: 1.5, ease: "power1.inOut" }, 2.3);
        tl.to(fallback, { x: "26vw", rotation: -4, duration: 1.5, ease: "power1.inOut" }, 4.7);
        tl.to(fallback, { x: 0, rotation: 0, scale: 0.98, duration: 1.5, ease: "power1.inOut" }, 7.0);
      }
    }
    return tl;
  };

  mm.add("(min-width: 900px)", () => { buildTimeline(false); });
  mm.add("(max-width: 899px)", () => { buildTimeline(true); });
}

/* ---------- 4 · Statement: words fill in as you scroll ---------- */
function initStatement() {
  const el = document.querySelector(".statement__text");
  if (!el) return;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(" ");
  gsap.fromTo(el.querySelectorAll(".w"),
    { opacity: 0.12 },
    {
      opacity: 1, ease: "none", stagger: 0.35, duration: 1,
      scrollTrigger: { trigger: ".statement", start: "top 78%", end: "center 42%", scrub: 0.4 },
    });
}

/* ---------- 5a · Stat counters tick up when they enter ---------- */
function initCounters() {
  document.querySelectorAll(".count").forEach((el) => {
    const end = parseInt(el.dataset.count, 10) || 0;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end, duration: 1.6, ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(obj.v); },
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
}

/* ---------- 5b · Dark panels scale in as they arrive ---------- */
function initPanels() {
  gsap.utils.toArray(".panel").forEach((p) => {
    gsap.fromTo(p, { scale: 0.945, y: 34 }, {
      scale: 1, y: 0, ease: "none",
      scrollTrigger: { trigger: p, start: "top 96%", end: "top 55%", scrub: 0.5 },
    });
  });
}

/* ---------- 6 · Gallery: pinned horizontal filmstrip (desktop) ---------- */
function initGallery() {
  const section = document.querySelector(".gallery");
  const track = document.querySelector(".gallery__track");
  if (!section || !track) return;

  const mm = gsap.matchMedia();
  mm.add("(min-width: 900px)", () => {
    section.classList.add("gallery--pinned");
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => "+=" + (dist() + window.innerHeight * 0.15),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    return () => section.classList.remove("gallery--pinned");
  });
  // On phones / reduced motion the strip stays a native swipeable scroller.
}

/* ============================================================
   BOOT
   ============================================================ */
function boot() {
  try {
    initThree();
  } catch (err) {
    console.warn("WebGL unavailable, using fallback:", err);
    document.body.classList.add("no-webgl");
    if (canvas) canvas.style.display = "none";
  }
  initScroll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
