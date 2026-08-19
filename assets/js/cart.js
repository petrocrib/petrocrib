/* PETROCRIB CART — dedicated cart page + Razorpay Checkout. */
(function () {
  if (typeof STORE_CONFIG === "undefined" || !STORE_CONFIG.WORKER_URL) return;

  const WURL = STORE_CONFIG.WORKER_URL.replace(/\/$/, "");
  const rs = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const $ = (id) => document.getElementById(id);

  let cart = load("pc_cart", []);
  let cust = load("pc_cust", { name: "", phone: "", email: "", address: "", pincode: "" });

  const nav = document.querySelector(".nav");
  if (nav && !nav.querySelector(".cart-link")) {
    const a = document.createElement("a");
    a.href = "cart.html";
    a.className = "cart-link";
    a.innerHTML = `Cart <span class="cart-count" id="cartCount">0</span>`;
    if (/\/cart(?:\.html)?$/.test(location.pathname)) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  }

  const toastWrap = document.createElement("div");
  toastWrap.innerHTML = `<div class="cart-toast" id="cartToast"></div>`;
  document.body.appendChild(toastWrap);

  const fieldRules = {
    cpName: { key: "name", error: "Enter your full name.", valid: (v) => v.trim().length >= 2 },
    cpPhone: { key: "phone", error: "Enter a valid phone number.", valid: (v) => { const n = v.replace(/\D/g, ""); return n.length >= 10 && n.length <= 15; } },
    cpEmail: { key: "email", error: "Enter a valid email address.", valid: (v) => /^\S+@\S+\.\S+$/.test(v.trim()) },
    cpAddr: { key: "address", error: "Enter your complete delivery address.", valid: (v) => v.trim().length >= 10 },
    cpPin: { key: "pincode", error: "Enter a valid 6-digit pincode.", valid: (v) => /^[0-9]{6}$/.test(v.trim()) },
  };

  function total() { return cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0); }
  function itemCount() { return cart.reduce((s, i) => s + Number(i.qty || 0), 0); }
  function payLabel() { return `Pay ${rs(total())} securely`; }
  function syncCart() { if (window.PCAnalytics) PCAnalytics.syncCart(cart); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function safeImg(src) {
    const value = String(src || "");
    return /^(?:assets\/|https:\/\/(?:www\.)?petrocrib\.in\/|https:\/\/cdn\.shopify\.com\/)/i.test(value) ? esc(value) : "";
  }
  function toast(msg) {
    const t = $("cartToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function updateCount() {
    const el = $("cartCount");
    if (el) el.textContent = itemCount();
  }
  function setPayButton(busy, label) {
    const btn = $("cpPay");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = label || payLabel();
  }

  function saveAndRender() {
    save("pc_cart", cart);
    updateCount();
    renderCartPage();
    syncCart();
  }

  function renderCartPage() {
    const box = $("cpItems");
    if (!box) return;
    const checkout = $("cpCheckout");
    if (checkout) checkout.hidden = !cart.length;

    if (!cart.length) {
      box.innerHTML = `<div class="cp-empty"><div class="cp-empty-mark">0</div><h2>Your cart is empty</h2><p>Go grab a dialogue and come back here.</p><a class="btn" href="index.html#shop">Shop all designs</a></div>`;
    } else {
      box.innerHTML = cart.map((it, i) => {
        const handle = it.productId ? `product.html?handle=${encodeURIComponent(it.productId)}` : "index.html#shop";
        return `<article class="cp-item">
          <a class="cp-thumb" href="${handle}" aria-label="View ${esc(it.title)}"><img src="${safeImg(it.img)}" alt="${esc(it.title)}"></a>
          <div class="cp-item-info">
            <a class="cp-item-title" href="${handle}">${esc(it.title)}</a>
            <div class="cp-item-var">${esc(it.variant)}</div>
            <div class="cp-unit">${rs(it.price)} each</div>
            <div class="cp-item-actions"><div class="cp-qty" aria-label="Quantity"><button type="button" data-a="minus" data-i="${i}" aria-label="Decrease quantity">−</button><span>${Number(it.qty) || 1}</span><button type="button" data-a="plus" data-i="${i}" aria-label="Increase quantity">+</button></div><button type="button" class="cp-remove" data-a="rm" data-i="${i}">Remove</button></div>
          </div>
          <div class="cp-line-price">${rs(Number(it.price || 0) * Number(it.qty || 0))}</div>
        </article>`;
      }).join("");
    }

    box.querySelectorAll("button[data-a]").forEach((b) => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        if (!cart[i]) return;
        if (b.dataset.a === "plus" && cart[i].qty < 10) cart[i].qty++;
        if (b.dataset.a === "minus") { cart[i].qty--; if (cart[i].qty < 1) cart.splice(i, 1); }
        if (b.dataset.a === "rm") cart.splice(i, 1);
        saveAndRender();
      });
    });

    if ($("cpSubtotal")) $("cpSubtotal").textContent = rs(total());
    if ($("cpTotal")) $("cpTotal").textContent = rs(total());
    if ($("cpItemCount")) $("cpItemCount").textContent = `${itemCount()} item${itemCount() === 1 ? "" : "s"}`;
    if ($("cpSummaryItems")) $("cpSummaryItems").textContent = `${itemCount()} item${itemCount() === 1 ? "" : "s"}`;
    setPayButton(false);
    updateCount();
  }

  function showFieldError(id, message) {
    const el = $(id);
    if (!el) return;
    const field = el.closest(".cp-field");
    const error = $(`${id}Error`);
    if (field) field.classList.toggle("has-error", !!message);
    el.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message || "";
  }

  function validateField(id) {
    const rule = fieldRules[id];
    const el = $(id);
    if (!rule || !el) return true;
    const value = String(el.value || "");
    const ok = rule.valid(value);
    showFieldError(id, ok ? "" : rule.error);
    return ok;
  }

  function syncCustomerFromForm() {
    Object.entries(fieldRules).forEach(([id, rule]) => {
      const el = $(id);
      if (el) cust[rule.key] = el.value;
    });
    save("pc_cust", cust);
  }

  function validateAll() {
    syncCustomerFromForm();
    const invalid = Object.keys(fieldRules).filter((id) => !validateField(id));
    if (invalid.length) {
      const first = $(invalid[0]);
      if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => first.focus(), 250); }
      return false;
    }
    return true;
  }

  function bindCustomerForm() {
    Object.entries(fieldRules).forEach(([id, rule]) => {
      const el = $(id);
      if (!el) return;
      el.value = cust[rule.key] || "";
      el.addEventListener("input", () => {
        if (id === "cpPin") el.value = el.value.replace(/\D/g, "").slice(0, 6);
        cust[rule.key] = el.value;
        save("pc_cust", cust);
        if (el.getAttribute("aria-invalid") === "true") validateField(id);
      });
      el.addEventListener("blur", () => validateField(id));
    });
  }

  function showPaymentResult(ok, resp, verified, data) {
    const root = $("cartPageInner");
    if (!root) return;
    const reference = verified.reference || data.reference || "";
    const amountPaid = data.amount ? rs(Number(data.amount) / 100) : "";
    root.innerHTML = `<section class="cp-success">
      <div class="cp-success-badge">${ok ? "✓ Payment verified" : "Payment received"}</div>
      <div class="cp-success-check">${ok ? "✓" : "…"}</div>
      <h2>${ok ? "Order confirmed!" : "We’re confirming it"}</h2>
      <p>${ok ? "Your payment is verified and your Petrocrib order is safely recorded." : "Razorpay received the payment, but final verification is still being confirmed. Please don’t pay again immediately."}</p>
      <div class="cp-success-details">
        ${reference ? `<div class="cp-success-ref"><span>Order reference</span><b>${esc(reference)}</b></div>` : ""}
        <div class="cp-success-ref"><span>Payment ID</span><b>${esc(resp.razorpay_payment_id)}</b></div>
        ${amountPaid ? `<div class="cp-success-ref"><span>Amount</span><b>${amountPaid}</b></div>` : ""}
      </div>
      <div class="cp-next">
        <h3>${ok ? "What happens next" : "What to do now"}</h3>
        ${ok ? `<div class="cp-next-row"><span>1</span><div>Your order is recorded in Petrocrib.</div></div><div class="cp-next-row"><span>2</span><div>We’ll prepare it for dispatch.</div></div><div class="cp-next-row"><span>3</span><div>Order updates will come by WhatsApp/email.</div></div>` : `<div class="cp-next-row"><span>1</span><div>Keep this payment ID for reference.</div></div><div class="cp-next-row"><span>2</span><div>If the amount was debited, avoid retrying immediately.</div></div><div class="cp-next-row"><span>3</span><div>Contact us if verification does not complete.</div></div>`}
      </div>
      <a class="btn" href="index.html#shop">Continue shopping</a>
    </section>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startPayment() {
    if (!cart.length) return toast("Cart is empty");
    if (!validateAll()) return toast("Check the highlighted delivery details");

    setPayButton(true, "Preparing payment…");
    if (window.PCAnalytics) PCAnalytics.track("checkout_start", { value: total(), metadata: { itemCount: itemCount() } });

    try {
      const res = await fetch(WURL + "/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: window.PCAnalytics ? PCAnalytics.sessionId() : null,
          items: cart.map((i) => ({ title: i.title, variant: i.variant, price: i.price, qty: i.qty })),
          customer: { name: cust.name, phone: cust.phone, email: cust.email, address: cust.address, pincode: cust.pincode },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderId) throw new Error(data.error || "order failed");

      const resetButton = () => setPayButton(false);
      const rz = new Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "PETROCRIB",
        description: itemCount() + " item(s)",
        prefill: { name: cust.name, contact: cust.phone, email: cust.email },
        theme: { color: "#fcd019" },
        modal: { ondismiss: resetButton },
        handler: async (resp) => {
          let ok = false;
          let verified = {};
          try {
            const v = await fetch(WURL + "/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resp) });
            verified = await v.json();
            ok = !!verified.valid;
          } catch {}

          if (ok) {
            cart = [];
            save("pc_cart", cart);
            updateCount();
            syncCart();
          }
          if (window.PCAnalytics) PCAnalytics.track(ok ? "checkout_success" : "checkout_verification_pending", { value: data.amount / 100, metadata: { reference: verified.reference || data.reference || "" } });
          showPaymentResult(ok, resp, verified, data);
        },
      });

      rz.on("payment.failed", () => {
        resetButton();
        toast("Payment failed — try again");
        if (window.PCAnalytics) PCAnalytics.track("payment_failed", { value: total() });
      });
      setPayButton(true, "Payment window open…");
      rz.open();
    } catch (e) {
      setPayButton(false);
      toast("Could not start payment. Try again.");
    }
  }

  window.Cart = {
    add(item, open) {
      const key = item.title + item.variant;
      const found = cart.find((i) => i.title + i.variant === key);
      if (found) { if (found.qty < 10) found.qty++; }
      else cart.push({ ...item, qty: 1 });
      save("pc_cart", cart);
      updateCount();
      syncCart();
      if (window.PCAnalytics) PCAnalytics.track("add_to_cart", { productId: item.productId || null, productTitle: item.title, variant: item.variant, value: item.price });
      if (open) location.href = "cart.html";
      else toast("Added to cart ✓");
    },
  };

  if ($("cartPageInner")) {
    bindCustomerForm();
    renderCartPage();
    const pay = $("cpPay");
    if (pay) pay.addEventListener("click", startPayment);
  }

  updateCount();
  syncCart();
})();
