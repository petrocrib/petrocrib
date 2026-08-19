/* PETROCRIB CART — dedicated cart page + Razorpay Checkout.
   Active only when STORE_CONFIG.WORKER_URL is set. */

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

  function total() { return cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0); }
  function itemCount() { return cart.reduce((s, i) => s + Number(i.qty || 0), 0); }
  function syncCart() { if (window.PCAnalytics) PCAnalytics.syncCart(cart); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function safeImg(src) {
    const value = String(src || "");
    return /^(?:assets\/|https:\/\/(?:www\.)?petrocrib\.in\/)/i.test(value) ? esc(value) : "";
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
      box.innerHTML = `
        <div class="cp-empty">
          <div class="cp-empty-mark">0</div>
          <h2>Your cart is empty</h2>
          <p>Go grab a dialogue and come back here.</p>
          <a class="btn" href="index.html#shop">Shop all designs</a>
        </div>`;
    } else {
      box.innerHTML = cart.map((it, i) => {
        const handle = it.productId ? `product.html?handle=${encodeURIComponent(it.productId)}` : "index.html#shop";
        return `
          <article class="cp-item">
            <a class="cp-thumb" href="${handle}" aria-label="View ${esc(it.title)}">
              <img src="${safeImg(it.img)}" alt="${esc(it.title)}">
            </a>
            <div class="cp-item-info">
              <a class="cp-item-title" href="${handle}">${esc(it.title)}</a>
              <div class="cp-item-var">${esc(it.variant)}</div>
              <div class="cp-unit">${rs(it.price)} each</div>
              <div class="cp-item-actions">
                <div class="cp-qty" aria-label="Quantity">
                  <button type="button" data-a="minus" data-i="${i}" aria-label="Decrease quantity">−</button>
                  <span>${Number(it.qty) || 1}</span>
                  <button type="button" data-a="plus" data-i="${i}" aria-label="Increase quantity">+</button>
                </div>
                <button type="button" class="cp-remove" data-a="rm" data-i="${i}">Remove</button>
              </div>
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
        if (b.dataset.a === "minus") {
          cart[i].qty--;
          if (cart[i].qty < 1) cart.splice(i, 1);
        }
        if (b.dataset.a === "rm") cart.splice(i, 1);
        saveAndRender();
      });
    });

    if ($("cpSubtotal")) $("cpSubtotal").textContent = rs(total());
    if ($("cpTotal")) $("cpTotal").textContent = rs(total());
    if ($("cpItemCount")) $("cpItemCount").textContent = `${itemCount()} item${itemCount() === 1 ? "" : "s"}`;
    updateCount();
  }

  function bindCustomerForm() {
    const fields = [
      ["cpName", "name"],
      ["cpPhone", "phone"],
      ["cpEmail", "email"],
      ["cpAddr", "address"],
      ["cpPin", "pincode"],
    ];
    fields.forEach(([id, key]) => {
      const el = $(id);
      if (!el) return;
      el.value = cust[key] || "";
      el.addEventListener("input", () => {
        cust[key] = el.value;
        save("pc_cust", cust);
      });
    });
  }

  function showPaymentResult(ok, resp, verified, data) {
    const root = $("cartPageInner");
    if (!root) return;
    const reference = verified.reference || data.reference || "";
    root.innerHTML = `
      <section class="cp-success">
        <div class="cp-success-check">✓</div>
        <h2>${ok ? "Order received!" : "Payment received"}</h2>
        <p>${ok ? "Your payment is verified and your order is now in our system." : "Your payment reached Razorpay. Verification is still being confirmed."}</p>
        ${reference ? `<div class="cp-success-ref"><span>Order reference</span><b>${esc(reference)}</b></div>` : ""}
        <div class="cp-success-ref"><span>Payment ID</span><b>${esc(resp.razorpay_payment_id)}</b></div>
        <p class="cp-success-note">We’ll confirm the order on WhatsApp/email before dispatch.</p>
        <a class="btn" href="index.html#shop">Continue shopping</a>
      </section>`;
  }

  async function startPayment() {
    if (!cart.length) return toast("Cart is empty");
    if (!cust.name.trim()) return toast("Name is required");
    if (!/^[0-9+\s-]{10,}$/.test(cust.phone.trim())) return toast("Enter a valid phone number");
    if (!/^\S+@\S+\.\S+$/.test(cust.email.trim())) return toast("Enter a valid email");
    if (cust.address.trim().length < 10) return toast("Enter your full address");
    if (!/^[0-9]{6}$/.test(cust.pincode.trim())) return toast("Enter a valid 6-digit pincode");

    const btn = $("cpPay");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Preparing payment…";

    if (window.PCAnalytics) {
      PCAnalytics.track("checkout_start", { value: total(), metadata: { itemCount: itemCount() } });
    }

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

      const resetButton = () => {
        if (!$("cpPay")) return;
        $("cpPay").disabled = false;
        $("cpPay").textContent = "Pay securely with Razorpay";
      };

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
            const v = await fetch(WURL + "/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            verified = await v.json();
            ok = !!verified.valid;
          } catch {}

          if (ok) {
            cart = [];
            save("pc_cart", cart);
            updateCount();
            syncCart();
          }
          if (window.PCAnalytics) {
            PCAnalytics.track(ok ? "checkout_success" : "checkout_verification_pending", {
              value: data.amount / 100,
              metadata: { reference: verified.reference || data.reference || "" },
            });
          }
          showPaymentResult(ok, resp, verified, data);
        },
      });

      rz.on("payment.failed", () => {
        resetButton();
        toast("Payment failed — try again");
        if (window.PCAnalytics) PCAnalytics.track("payment_failed", { value: total() });
      });
      btn.textContent = "Payment window open…";
      rz.open();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Pay securely with Razorpay";
      toast("Could not start payment. Try again.");
    }
  }

  window.Cart = {
    add(item, open) {
      const key = item.title + item.variant;
      const found = cart.find((i) => i.title + i.variant === key);
      if (found) {
        if (found.qty < 10) found.qty++;
      } else {
        cart.push({ ...item, qty: 1 });
      }
      save("pc_cart", cart);
      updateCount();
      syncCart();
      if (window.PCAnalytics) {
        PCAnalytics.track("add_to_cart", {
          productId: item.productId || null,
          productTitle: item.title,
          variant: item.variant,
          value: item.price,
        });
      }
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
