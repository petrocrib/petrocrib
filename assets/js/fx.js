/* PETROCRIB FX — interactivity for desktop (cursor) AND mobile (scroll/tap) */
(function () {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  const touch = matchMedia("(hover: none)").matches;

  /* ---- scroll reveal (all devices) ---- */
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.style.opacity = 1;
          en.target.style.transform = "none";
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.12 }
  );
  const arm = () => {
    document.querySelectorAll(".card:not([data-fx])").forEach((c, i) => {
      c.dataset.fx = 1;
      c.style.opacity = 0;
      c.style.transform = "translateY(26px)";
      c.style.transition = `opacity .5s ease ${(i % 4) * 0.07}s, transform .5s ease ${(i % 4) * 0.07}s`;
      io.observe(c);
    });
  };
  new MutationObserver(arm).observe(document.body, { childList: true, subtree: true });
  arm();

  const hero = document.getElementById("chitramHero");
  const bees = hero ? hero.querySelectorAll(".cs-bee") : [];
  const artImg = hero ? hero.querySelector(".hero-art img") : null;

  /* ================= MOBILE: scroll-driven parallax ================= */
  if (touch) {
    if (hero) {
      let tick = false;
      addEventListener(
        "scroll",
        () => {
          if (tick) return;
          tick = true;
          requestAnimationFrame(() => {
            const y = window.scrollY;
            bees.forEach((b, i) => {
              const d = i === 0 ? 1.5 : 1;
              const flip = b.classList.contains("b2") ? " scaleX(-1)" : "";
              b.style.transform =
                `translate(${Math.sin(y / 55 + i * 2) * 12}px, ${-y * 0.14 * d}px) rotate(${Math.sin(y / 70) * 8}deg)` + flip;
            });
            if (artImg) artImg.style.transform = `translateY(${y * 0.05}px)`;
            tick = false;
          });
        },
        { passive: true }
      );
    }
    return; // pointer effects below are desktop-only
  }

  /* ================= DESKTOP: cursor effects ================= */
  /* Chitram hero parallax */
  if (hero) {
    const depth = [2.2, 1.3, 0.8];
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      hero.style.backgroundPosition = `${50 - px * 4}% ${30 - py * 4}%`;
      if (artImg) artImg.style.transform = `translate(${px * -14}px, ${py * -10}px) scale(1.06)`;
      bees.forEach((b, i) => {
        const d = depth[i] || 1;
        const flip = b.classList.contains("b2") ? " scaleX(-1)" : "";
        b.style.transform =
          `translate(${px * 60 * d}px, ${py * 44 * d}px) rotate(${px * 12 * d}deg)` + flip;
      });
    });
    hero.addEventListener("mouseleave", () => {
      hero.style.backgroundPosition = "";
      if (artImg) artImg.style.transform = "";
      bees.forEach((b) => (b.style.transform = b.classList.contains("b2") ? "scaleX(-1)" : ""));
    });
  }

  /* cursor spotlight */
  const glow = document.createElement("div");
  glow.style.cssText =
    "position:fixed;left:0;top:0;width:340px;height:340px;pointer-events:none;z-index:1;" +
    "border-radius:50%;background:radial-gradient(circle,rgba(252,208,25,.07),transparent 70%);" +
    "transform:translate(-50%,-50%);";
  document.body.appendChild(glow);
  addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  });

  /* 3D tilt + 10% grow on cards */
  const TILT_SEL = ".card, .gallery .main";
  document.addEventListener("mousemove", (e) => {
    const el = e.target.closest(TILT_SEL);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const grow = el.classList.contains("card") ? " scale(1.1)" : "";
    el.style.transform =
      `perspective(700px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-4px)` + grow;
    el.style.transition = "transform .06s linear";
    el.style.zIndex = grow ? 4 : "";
  });
  document.addEventListener(
    "mouseout",
    (e) => {
      const el = e.target.closest(TILT_SEL);
      if (el && !el.contains(e.relatedTarget)) {
        el.style.transition = "transform .35s ease";
        el.style.transform = "";
        el.style.zIndex = "";
      }
    },
    true
  );

  /* magnetic buttons */
  document.addEventListener("mousemove", (e) => {
    const b = e.target.closest(".btn, .pill");
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.transform =
      `translate(${(e.clientX - r.left - r.width / 2) * 0.15}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
  });
  document.addEventListener(
    "mouseout",
    (e) => {
      const b = e.target.closest(".btn, .pill");
      if (b && !b.contains(e.relatedTarget)) {
        b.style.transition = "transform .3s ease";
        b.style.transform = "";
        setTimeout(() => (b.style.transition = ""), 300);
      }
    },
    true
  );
})();
