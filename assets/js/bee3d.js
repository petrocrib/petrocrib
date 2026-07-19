/* PETROCRIB — realistic 3D bees in the hero (lazy-loaded, PNG fallback).
   Loads three.js + the GLB only after the page is idle, so page speed is unaffected. */
(function () {
  var hero = document.getElementById("chitramHero");
  if (!hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function addScript(src, cb) {
    var s = document.createElement("script");
    s.src = src; s.onload = cb; s.onerror = function () {}; document.head.appendChild(s);
  }

  function start() {
    addScript("https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js", function () {
      addScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js", init);
    });
  }
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 1500);

  function init() {
    if (!window.THREE || !THREE.GLTFLoader) return;
    var touch = matchMedia("(hover: none)").matches;
    var canvas = document.createElement("canvas");
    canvas.className = "bee3d-canvas";
    hero.appendChild(canvas);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) { canvas.remove(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    cam.position.set(0, 0, 10);
    scene.add(new THREE.HemisphereLight(0xfff2d0, 0x402a10, 1.15));
    var sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(3, 6, 5); scene.add(sun);

    function size() {
      var w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    size(); addEventListener("resize", size);

    new THREE.GLTFLoader().load("assets/img/chitram/bee3d.glb", function (g) {
      var model = g.scene;
      var box = new THREE.Box3().setFromObject(model);
      var c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      model.position.sub(c);
      var norm = 1 / Math.max(s.x, s.y, s.z);
      var holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(norm);

      /* two bees sharing one model */
      var bees = [];
      var defs = touch
        ? [{ x: 2.2, y: 1.6, s: 1.5, sp: 1.0 }, { x: -0.6, y: -1.4, s: 1.0, sp: 1.4 }]
        : [{ x: 3.4, y: 1.4, s: 1.9, sp: 1.0 }, { x: 1.2, y: -1.6, s: 1.2, sp: 1.4 }];
      defs.forEach(function (d, i) {
        var b = i === 0 ? holder : holder.clone();
        b.scale.setScalar(norm * d.s);
        b.position.set(d.x, d.y, 0);
        b.rotation.y = -0.6;
        scene.add(b);
        bees.push({ o: b, hx: d.x, hy: d.y, sp: d.sp, dx: 0, dy: 0 });
      });

      hero.classList.add("hero-3d"); /* hides PNG bees */

      var mx = 0, my = 0;
      if (!touch) {
        hero.addEventListener("mousemove", function (e) {
          var r = hero.getBoundingClientRect();
          mx = (e.clientX - r.left) / r.width - 0.5;
          my = (e.clientY - r.top) / r.height - 0.5;
        });
        hero.addEventListener("mouseleave", function () { mx = 0; my = 0; });
      } else {
        addEventListener("scroll", function () {
          var y = Math.min(scrollY * 0.0012, 0.6);
          mx = Math.sin(scrollY / 240) * 0.3; my = -y;
        }, { passive: true });
      }

      var vis = true;
      new IntersectionObserver(function (en) { vis = en[0].isIntersecting; },
        { threshold: 0 }).observe(hero);

      var t0 = performance.now();
      (function loop(t) {
        requestAnimationFrame(loop);
        if (!vis) return;
        var s = (t - t0) / 1000;
        bees.forEach(function (b, i) {
          var wob = i * 2.4;
          var tx = b.hx + mx * (i === 0 ? 2.6 : 1.6) + Math.sin(s * 0.5 * b.sp + wob) * 0.5;
          var ty = b.hy + my * (i === 0 ? 1.8 : 1.1) + Math.sin(s * 1.7 * b.sp + wob) * 0.22;
          var ox = tx - b.o.position.x, oy = ty - b.o.position.y;
          b.o.position.x += ox * 0.045; b.o.position.y += oy * 0.045;
          b.dx += (ox - b.dx) * 0.06; b.dy += (oy - b.dy) * 0.06;
          b.o.rotation.z = THREE.MathUtils.clamp(-b.dx * 0.5, -0.5, 0.5);
          b.o.rotation.x = THREE.MathUtils.clamp(b.dy * 0.4, -0.4, 0.4) + Math.sin(s * 2.2 + wob) * 0.05;
          b.o.rotation.y = -0.6 + Math.sin(s * 0.4 + wob) * 0.35 + b.dx * 0.6;
        });
        renderer.render(scene, cam);
      })(t0);
    }, undefined, function () { canvas.remove(); });
  }
})();
