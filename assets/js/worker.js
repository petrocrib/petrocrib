/* ============================================================
   PETROCRIB — Razorpay backend (Cloudflare Worker)
   Deploy this at dash.cloudflare.com → Workers & Pages.
   Set these variables in Worker Settings → Variables:
     RAZORPAY_KEY_ID      = rzp_live_xxxx   (from Razorpay dashboard → Account & Settings → API Keys)
     RAZORPAY_KEY_SECRET  = xxxx            (mark as Secret/encrypt!)
     ALLOWED_ORIGIN       = https://YOUR-USERNAME.github.io
   ============================================================ */

const ALLOWED_PRICES = [500, 700, 800, 1000, 1300];

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST")
      return json({ error: "POST only" }, 405, cors);

    const url = new URL(req.url);

    /* ---------- create order ---------- */
    if (url.pathname === "/create-order") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length || items.length > 20) return json({ error: "bad items" }, 400, cors);

      let total = 0;
      const lines = [];
      for (const it of items) {
        const price = Number(it.price), qty = Number(it.qty);
        if (!ALLOWED_PRICES.includes(price)) return json({ error: "bad price" }, 400, cors);
        if (!Number.isInteger(qty) || qty < 1 || qty > 10) return json({ error: "bad qty" }, 400, cors);
        total += price * qty;
        lines.push(`${qty}x ${String(it.title).slice(0, 40)} [${String(it.variant).slice(0, 40)}] @${price}`);
      }

      const c = body.customer || {};
      const notes = {
        items: lines.join(" | ").slice(0, 250),
        items2: lines.join(" | ").slice(250, 500),
        name: String(c.name || "").slice(0, 100),
        phone: String(c.phone || "").slice(0, 20),
        address: String(c.address || "").slice(0, 250),
      };

      const rzp = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total * 100, // paise
          currency: "INR",
          notes,
        }),
      });
      const order = await rzp.json();
      if (!rzp.ok) return json({ error: "razorpay error", detail: order }, 502, cors);
      return json(
        { orderId: order.id, amount: order.amount, currency: "INR", keyId: env.RAZORPAY_KEY_ID },
        200, cors
      );
    }

    /* ---------- verify payment signature ---------- */
    if (url.pathname === "/verify") {
      let b;
      try { b = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
      const msg = `${b.razorpay_order_id}|${b.razorpay_payment_id}`;
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(env.RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
      const hex = [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
      return json({ valid: hex === b.razorpay_signature }, 200, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
