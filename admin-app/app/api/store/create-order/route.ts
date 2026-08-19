import { db, normalizePhone, uid } from "@/lib/db";
import { validateCart } from "@/lib/catalog";
import { isStoreRequestAllowed, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) { return preflight(req); }

function reference() {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `PC-${date}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    if (!isStoreRequestAllowed(req)) return json(req, { error: "Forbidden" }, { status: 403 });
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return json(req, { error: "JSON required" }, { status: 415 });

    const body = await req.json();
    const items = await validateCart(body.items);
    const customer = body.customer || {};
    const name = String(customer.name || "").trim().slice(0,160);
    const phone = String(customer.phone || "").trim().slice(0,80);
    const phoneNormalized = normalizePhone(phone);
    const email = String(customer.email || "").trim().slice(0,240) || null;
    const address = String(customer.address || customer.addressLine1 || "").trim().slice(0,700);
    const address2 = String(customer.addressLine2 || "").trim().slice(0,300) || null;
    const pincode = String(customer.pincode || customer.postalCode || address.match(/PIN:\s*(\d{6})/i)?.[1] || "").trim().slice(0,20);
    const city = String(customer.city || "").trim().slice(0,120) || null;
    const state = String(customer.state || "").trim().slice(0,120) || null;
    const country = String(customer.country || "India").trim().slice(0,120) || "India";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0,120) : null;

    if (name.length < 2) return json(req, { error: "Name is required" }, { status: 400 });
    if (phoneNormalized.length < 10) return json(req, { error: "Valid phone required" }, { status: 400 });
    if (address.length < 8) return json(req, { error: "Delivery address required" }, { status: 400 });
    if (!pincode) return json(req, { error: "Pincode required" }, { status: 400 });

    const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
    const total = subtotal;
    if (total < 1 || total > 100000) return json(req, { error: "Invalid order total" }, { status: 400 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return json(req, { error: "Payments are not configured" }, { status: 503 });

    const ref = reference();
    const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: total * 100, currency: "INR", receipt: ref, notes: { reference: ref, customer: name } })
    });
    const rz = await rzRes.json();
    if (!rzRes.ok || !rz.id) {
      console.error("razorpay create", { status: rzRes.status, code: rz?.error?.code });
      return json(req, { error: "Could not create payment order" }, { status: 502 });
    }

    const sql = db();
    let source: any = { firstSource: "direct" };
    if (sessionId) {
      const s = await sql`SELECT "firstSource","firstReferrer","firstUtmSource","firstUtmMedium","firstUtmCampaign","firstUtmContent","firstUtmTerm" FROM "VisitorSession" WHERE "id"=${sessionId} LIMIT 1`;
      if (s.length) source = s[0];
    }

    const customerId = uid("cus");
    const customerRows = await sql`
      INSERT INTO "Customer" ("id","name","phone","phoneNormalized","email","city","state","country","firstOrderAt","lastOrderAt")
      VALUES (${customerId},${name},${phone},${phoneNormalized},${email},${city},${state},${country},NOW(),NOW())
      ON CONFLICT ("phoneNormalized") DO UPDATE SET
        "name"=EXCLUDED."name", "phone"=EXCLUDED."phone", "email"=COALESCE(EXCLUDED."email","Customer"."email"),
        "city"=COALESCE(EXCLUDED."city","Customer"."city"), "state"=COALESCE(EXCLUDED."state","Customer"."state"),
        "country"=COALESCE(EXCLUDED."country","Customer"."country"), "lastOrderAt"=NOW(), "updatedAt"=NOW()
      RETURNING "id"
    `;
    const actualCustomerId = String((customerRows[0] as any).id);
    const orderId = uid("ord");

    await sql`
      INSERT INTO "Order" (
        "id","reference","sessionId","customerId","razorpayOrderId","subtotal","total","customerName","phone","email",
        "addressLine1","addressLine2","city","state","postalCode","country","source","referrer","utmSource","utmMedium","utmCampaign","utmContent","utmTerm"
      ) VALUES (
        ${orderId},${ref},${sessionId},${actualCustomerId},${rz.id},${subtotal},${total},${name},${phone},${email},
        ${address},${address2},${city},${state},${pincode},${country},${source.firstSource || "direct"},${source.firstReferrer || null},
        ${source.firstUtmSource || null},${source.firstUtmMedium || null},${source.firstUtmCampaign || null},${source.firstUtmContent || null},${source.firstUtmTerm || null}
      )
    `;
    for (const item of items) {
      await sql`INSERT INTO "OrderItem" ("id","orderId","productId","title","variant","color","size","unitPrice","quantity","image") VALUES (${uid("itm")},${orderId},${item.productId},${item.title},${item.variant},${item.color || null},${item.size || null},${item.unitPrice},${item.quantity},${item.image || null})`;
    }
    await sql`INSERT INTO "OrderUpdate" ("id","orderId","status","title","message") VALUES (${uid("upd")},${orderId},'PAYMENT_PENDING','Checkout started','Order created and awaiting payment.')`;

    return json(req, { orderId: rz.id, amount: rz.amount, keyId, reference: ref });
  } catch (error: any) {
    console.error("create order", error instanceof Error ? error.message : "unknown error");
    return json(req, { error: "Could not create order" }, { status: 400 });
  }
}
