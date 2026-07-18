/* PETROCRIB CART — multi-item cart + Razorpay Checkout via Cloudflare Worker.
   Active only when STORE_CONFIG.WORKER_URL is set. */

(function () {
  if (typeof STORE_CONFIG === "undefined" || !STORE_CONFIG.WORKER_URL) return;
  const WURL = STORE_CONFIG.WORKER_URL.replace(/\/$/, "");
  const rs = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let cart = load("pc_cart", []);
  let cust = load("pc_cust", { name: "", phone: "", email: "", address: "" });

  /* ---------- header cart button ---------- */
  const nav = document.querySelector(".nav");
  if (nav) {
    const a = document.createElement("a");
    a.href = "#";
    a.className = "cart-link";
    a.innerHTML = `Cart <span class="cart-count" id="cartCount">0</span>`;
    a.addEventListener("click", (e) => { e.preventDefault(); openDrawer(); });
    nav.appendChild(a);
  }

  /* ---------- drawer ---------- */
  const wrap = document.createElement("div");
  wrap.innerHTML = `
  <div class="cart-overlay" id="cartOverlay"></div>
  <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping cart">
    <div class="cd-head">
      <h3>Your cart</h3>
      <button class="cd-close" id="cdClose" aria-label="Close">✕</button>
    </div>
    <div class="cd-items" id="cdItems"></div>
    <div class="cd-form" id="cdForm">
      <div class="cd-sub">Delivery details</div>
      <input id="cdName" placeholder="Full name" autocomplete="name">
      <input id="cdPhone" placeholder="Phone (WhatsApp preferred)" autocomplete="tel">
      <input id="cdEmail" placeholder="Email" autocomplete="email">
      <textarea id="cdAddr" rows="3" placeholder="Full address with pincode"></textarea>
    </div>
    <div class="cd-foot">
      <div class="cd-total">Total <b id="cdTotal">₹0</b></div>
      <button class="btn cd-pay" id="cdPay">Pay with Razorpay</button>
      <div class="cd-note">UPI · Cards · Netbanking — secured by Razorpay</div>
    </div>
  </aside>
  <div class="cart-toast" id="cartToast"></div>`;
  document.body.appendChild(wrap);

  const $ = (id) => document.getElementById(id);
  ["cdName", "cdPhone", "cdEmail", "cdAddr"].forEach((id, i) => {
    const k = ["name", "phone", "email", "address"][i];
    $(id).value = cust[k] || "";
    $(id).addEventListener("input", () => { cust[k] = $(id).value; save("pc_cust", cust); });
  });
  $("cdClose").addEventListener("click", closeDrawer);
  $("cartOverlay").addEventListener("click", closeDrawer);

  function openDrawer() { render(); document.body.classList.add("cart-open"); }
  function closeDrawer() { document.body.classList.remove("cart-open"); }

  function total() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

  function render() {
    const box = $("cdItems");
    if (!cart.length) {
      box.innerHTML = `<p class="cd-empty">Your cart is empty. Go grab a dialogue.</p>`;
    } else {
      box.innerHTML = cart.map((it, i) => `
        <div class="cd-item">
          <img src="${it.img || ""}" alt="">
          <div class="cd-info">
            <div class="cd-title">${esc(it.title)}</div>
            <div class="cd-var">${esc(it.variant)}</div>
            <div class="cd-price">${rs(it.price)}</div>
          </div>
          <div class="cd-qty">
            <button data-a="minus" data-i="${i}">−</button>
            <span>${it.qty}</span>
            <button data-a="plus" data-i="${i}">+</button>
            <button class="cd-rm" data-a="rm" data-i="${i}">✕</button>
          </div>
        </div>`).join("");
    }
    box.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.dataset.i;
        if (b.dataset.a === "plus" && cart[i].qty < 10) cart[i].qty++;
        if (b.dataset.a === "minus") { cart[i].qty--; if (cart[i].qty < 1) cart.splice(i, 1); }
        if (b.dataset.a === "rm") cart.splice(i, 1);
        save("pc_cart", cart); render();
      })
    );
    $("cdTotal").textContent = rs(total());
    updateCount();
  }

  function updateCount() {
    const el = $("cartCount");
    if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
  }

  function toast(msg) {
    const t = $("cartToast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- public API ---------- */
  window.Cart = {
    add(item, open) {
      const key = item.title + item.variant;
      const found = cart.find((i) => i.title + i.variant === key);
      if (found) { if (found.qty < 10) found.qty++; }
      else cart.push({ ...item, qty: 1 });
      save("pc_cart", cart);
      updateCount();
      if (open) openDrawer();
      else toast("Added to cart ✓");
    },
  };

  /* ---------- checkout ---------- */
  $("cdPay").addEventListener("click", async () => {
    if (!cart.length) return toast("Cart is empty");
    if (!cust.name.trim() || !cust.phone.trim() || cust.address.trim().length < 10)
      return toast("Fill name, phone & full address first");
    const btn = $("cdPay");
    btn.disabled = true; btn.textContent = "Preparing…";
    try {
      const res = await fetch(WURL + "/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({ title: i.title, variant: i.variant, price: i.price, qty: i.qty })),
          customer: { name: cust.name, phone: cust.phone, address: cust.address },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderId) throw new Error(data.error || "order failed");

      const rz = new Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "PETROCRIB",
        description: cart.reduce((s, i) => s + i.qty, 0) + " item(s)",
        prefill: { name: cust.name, contact: cust.phone, email: cust.email },
        theme: { color: "#fcd019" },
        handler: async (resp) => {
          let ok = false;
          try {
            const v = await fetch(WURL + "/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            ok = (await v.json()).valid;
          } catch {}
          cart = []; save("pc_cart", cart); render();
          $("cdItems").innerHTML = `<div class="cd-success">
            <div class="cd-check">✓</div>
            <h3>Order received!</h3>
            <p>Payment ID: <b>${esc(resp.razorpay_payment_id)}</b>${ok ? "" : " (verification pending)"}</p>
            <p>We'll confirm on WhatsApp/email before dispatch. Screenshot this for reference.</p>
          </div>`;
        },
      });
      rz.on("payment.failed", () => toast("Payment failed — try again"));
      rz.open();
    } catch (e) {
      toast("Could not start payment. Try again.");
    }
    btn.disabled = false; btn.textContent = "Pay with Razorpay";
  });

  updateCount();
})();
