/* PETROCRIB static store engine */

const money = (n) => "₹" + Number(n).toLocaleString("en-IN");

async function loadProducts() {
  // Data is embedded via products.js so the site works even when
  // opened directly from disk (file://). Falls back to fetch just in case.
  if (typeof PRODUCTS !== "undefined") return PRODUCTS;
  const res = await fetch("products.json");
  return res.json();
}

/* ---------------- home page grid ---------------- */
async function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const products = await loadProducts();

  // marquee strip
  const track = document.getElementById("marqueeTrack");
  if (track) {
    const phrases = ["WEAR THE DIALOGUE", "MEME MERCH", "PETROCRIB"];
    const seq = phrases.map((ph) => `<span>${ph}</span><i>•</i>`).join("").repeat(4);
    track.innerHTML = `<em>${seq}</em><em>${seq}</em>`;
  }

  grid.innerHTML = products
    .map((p) => {
      const priceLabel = money(p.minPrice);
      const img = p.images[0] || "";
      return `
      <a class="card" href="product.html?handle=${encodeURIComponent(p.handle)}">
        <div class="thumb"><img loading="lazy" src="${img}" alt="${escapeHtml(p.title)}"></div>
        <div class="meta">
          <h3>${escapeHtml(p.title)}</h3>
          <div class="price">${priceLabel}</div>
        </div>
      </a>`;
    })
    .join("");
}

/* ---------------- size guides (inches) ---------------- */
const SIZE_GUIDES = {
  regular: {
    label: "Regular fit — size guide (inches)",
    cols: ["Size", "Chest", "Length"],
    rows: [
      ["S", 36, 26], ["M", 38, 27], ["L", 40, 28], ["XL", 42, 29],
      ["2XL", 44, 30], ["3XL", 48, 31], ["4XL", 50, 32], ["5XL", 52, 33],
    ],
  },
  oversized: {
    label: "Oversized fit — size guide (inches)",
    cols: ["Size", "Chest", "Length", "Shoulder", "Sleeve"],
    rows: [
      ["S", 44, 28, 21, 8], ["M", 46, 29, 22, 8.5], ["L", 48, 30, 23, 9],
      ["XL", 50, 30, 24, 9.5], ["XXL", 52, 30.5, 25, 10],
    ],
  },
};
function guideForType(typeName) {
  const t = (typeName || "").toLowerCase();
  if (t.includes("regular")) return SIZE_GUIDES.regular;
  return SIZE_GUIDES.oversized; // oversized & hoodie share this chart
}
function guideTable(g) {
  return `<div class="size-guide">
    <div class="sg-label">${g.label}</div>
    <table>
      <thead><tr>${g.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${g.rows
        .map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table>
  </div>`;
}

/* ---------------- product page ---------------- */
async function renderProduct() {
  const root = document.getElementById("product");
  if (!root) return;
  const handle = new URLSearchParams(location.search).get("handle");
  const products = await loadProducts();
  const p = products.find((x) => x.handle === handle) || products[0];
  document.title = p.title + " — " + STORE_CONFIG.storeName;

  const state = {
    type: p.types[0],
    color: p.colors[0] || "",
    size: "M",
    imgIndex: 0,
  };
  if (!p.sizes.includes(state.size)) state.size = p.sizes[0] || "";

  root.innerHTML = `
    <div class="gallery">
      <div class="main"><img id="mainImg" src="${p.images[0] || ""}" alt="${escapeHtml(p.title)}"></div>
      <div class="thumbs" id="thumbs">
        ${p.images.map((s, i) => `<img src="${s}" data-i="${i}" class="${i === 0 ? "active" : ""}" alt="view ${i + 1}">`).join("")}
      </div>
    </div>
    <div class="pinfo">
      <h1>${escapeHtml(p.title)}</h1>
      <div class="price" id="price"></div>

      <div class="opt-group">
        <div class="label">Clothing type</div>
        <div class="pills" id="typePills">
          ${p.types.map((t) => `<button class="pill" data-v="${escapeHtml(t)}">${escapeHtml(t)} — ${money(p.typePrices[t])}</button>`).join("")}
        </div>
      </div>

      ${p.colors.length ? `
      <div class="opt-group">
        <div class="label">Color</div>
        <div class="pills" id="colorPills">
          ${p.colors.map((c) => `<button class="pill" data-v="${escapeHtml(c)}">${escapeHtml(cap(c))}</button>`).join("")}
        </div>
      </div>` : ""}

      ${p.sizes.length ? `
      <div class="opt-group">
        <div class="label">Size</div>
        <div class="pills" id="sizePills">
          ${p.sizes.map((s) => `<button class="pill" data-v="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
        </div>
      </div>` : ""}

      <div class="buy-row">
        <button class="btn" id="buyBtn">Buy now</button>
      </div>
      <div class="order-note" id="orderNote"></div>
      <div id="sizeGuide"></div>

      <div class="desc">${p.body}</div>
      <a class="back" href="index.html">← Back to all designs</a>
    </div>`;

  const priceEl = document.getElementById("price");
  const noteEl = document.getElementById("orderNote");
  const buyBtn = document.getElementById("buyBtn");

  function currentPrice() {
    return Math.round(p.typePrices[state.type]);
  }
  function summary() {
    return `${p.title} | ${state.type} | ${cap(state.color)} | Size ${state.size}`;
  }
  const sgEl = document.getElementById("sizeGuide");
  function paint() {
    priceEl.textContent = money(currentPrice());
    if (sgEl) sgEl.innerHTML = guideTable(guideForType(state.type));
    setActive("typePills", state.type);
    setActive("colorPills", state.color);
    setActive("sizePills", state.size);
    const link = STORE_CONFIG.razorpayLinks[currentPrice()];
    if (link) {
      noteEl.innerHTML = `On the payment page, mention: <b>${escapeHtml(summary())}</b> (we copy it to your clipboard when you tap Buy).`;
    } else if (STORE_CONFIG.whatsappNumber) {
      noteEl.textContent = "Ordering via WhatsApp — your selection is pre-filled in the message.";
    } else {
      noteEl.textContent = "Ordering is not set up yet. Store owner: add your Razorpay links in config.js.";
    }
  }
  function setActive(id, val) {
    const box = document.getElementById(id);
    if (!box) return;
    box.querySelectorAll(".pill").forEach((b) => b.classList.toggle("on", b.dataset.v === val));
  }

  bindPills("typePills", (v) => { state.type = v; paint(); });
  bindPills("colorPills", (v) => { state.color = v; paint(); });
  bindPills("sizePills", (v) => { state.size = v; paint(); });

  document.getElementById("thumbs").addEventListener("click", (e) => {
    const t = e.target.closest("img[data-i]");
    if (!t) return;
    document.getElementById("mainImg").src = p.images[+t.dataset.i];
    document.querySelectorAll("#thumbs img").forEach((im) => im.classList.remove("active"));
    t.classList.add("active");
  });

  buyBtn.addEventListener("click", async () => {
    const price = currentPrice();
    const link = STORE_CONFIG.razorpayLinks[price];
    if (link) {
      try { await navigator.clipboard.writeText(summary()); } catch (e) {}
      window.open(link, "_blank");
    } else if (STORE_CONFIG.whatsappNumber) {
      const msg = encodeURIComponent(
        `Hi! I want to order:\n${summary()}\nPrice: ${money(price)}`
      );
      window.open(`https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${msg}`, "_blank");
    } else {
      alert("Ordering is not configured yet. Add Razorpay links in config.js.");
    }
  });

  function bindPills(id, fn) {
    const box = document.getElementById(id);
    if (!box) return;
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".pill");
      if (b) fn(b.dataset.v);
    });
  }

  paint();
}

/* ---------------- utils ---------------- */
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* footer contact from config */
(function fillFooter() {
  const ig = document.getElementById("igLink");
  if (ig) {
    if (STORE_CONFIG.instagram) ig.href = "https://instagram.com/" + STORE_CONFIG.instagram.replace("@","");
    else ig.style.display = "none";
  }
  const wa = document.getElementById("waLink");
  if (wa) {
    if (STORE_CONFIG.whatsappNumber) wa.href = "https://wa.me/" + STORE_CONFIG.whatsappNumber;
    else wa.style.display = "none";
  }
  const set = (id, val, prefix) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val ? (prefix || "") + val : "";
  };
  set("fEmail", STORE_CONFIG.email);
  set("fPhone", STORE_CONFIG.phone);
  set("fAddress", STORE_CONFIG.address);
})();

renderGrid();
renderProduct();
