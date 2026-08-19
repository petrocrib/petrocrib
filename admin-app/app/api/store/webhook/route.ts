import { createHmac, timingSafeEqual } from "crypto";
import { db, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!signature || signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function markPaid(razorpayOrderId: string, paymentId: string, amount: number, currency: string) {
  const sql = db();
  const rows = await sql`
    SELECT "id","reference","customerId","sessionId","total","paymentStatus","razorpayPaymentId"
    FROM "Order" WHERE "razorpayOrderId"=${razorpayOrderId} LIMIT 1
  `;
  if (!rows.length) return;

  const existing: any = rows[0];
  if (String(currency || "").toUpperCase() !== "INR") return;
  if (Number(amount) !== Number(existing.total) * 100) return;
  if (existing.paymentStatus === "paid") return;

  const changed = await sql`
    UPDATE "Order"
    SET "razorpayPaymentId"=${paymentId}, "paymentStatus"='paid', "fulfillmentStatus"='PAID', "updatedAt"=NOW()
    WHERE "id"=${existing.id} AND "paymentStatus"<>'paid'
    RETURNING "id","reference","customerId","sessionId","total"
  `;
  if (!changed.length) return;

  const order: any = changed[0];
  await sql`
    UPDATE "Customer"
    SET "totalOrders"="totalOrders"+1,
        "lifetimeValue"="lifetimeValue"+${order.total},
        "lastOrderAt"=NOW(), "updatedAt"=NOW()
    WHERE "id"=${order.customerId}
  `;
  await sql`
    INSERT INTO "OrderUpdate" ("id","orderId","status","title","message")
    VALUES (${uid("upd")},${order.id},'PAID','Payment received','Razorpay confirmed the payment. Your order is now confirmed for processing.')
  `;

  if (order.sessionId) {
    await sql`
      UPDATE "CartPresence"
      SET "items"='[]'::jsonb,"itemCount"=0,"cartValue"=0,"lastSeenAt"=NOW()
      WHERE "sessionId"=${order.sessionId}
    `;
    const items = await sql`
      SELECT "productId","title","variant","unitPrice","quantity"
      FROM "OrderItem" WHERE "orderId"=${order.id}
    `;
    for (const item of items as any[]) {
      await sql`
        INSERT INTO "AnalyticsEvent" ("id","sessionId","eventType","productId","productTitle","variant","value","metadata")
        VALUES (${uid("ev")},${order.sessionId},'purchase',${item.productId},${item.title},${item.variant},${item.unitPrice * item.quantity},${JSON.stringify({ quantity: item.quantity, orderReference: order.reference, confirmedBy: "razorpay_webhook" })}::jsonb)
      `;
    }
  }
}

async function markFailed(razorpayOrderId: string, paymentId: string | null, reason: string | null) {
  const sql = db();
  const changed = await sql`
    UPDATE "Order"
    SET "paymentStatus"='failed', "updatedAt"=NOW()
    WHERE "razorpayOrderId"=${razorpayOrderId} AND "paymentStatus"<>'paid'
    RETURNING "id"
  `;
  if (!changed.length) return;
  await sql`
    INSERT INTO "OrderUpdate" ("id","orderId","status","title","message")
    VALUES (${uid("upd")},${(changed[0] as any).id},'PAYMENT_FAILED','Payment attempt failed',${reason || (paymentId ? `Razorpay payment ${paymentId} failed.` : "Razorpay reported a failed payment attempt.")})
  `;
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  if (!validWebhookSignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    const type = String(event?.event || "");
    const payment = event?.payload?.payment?.entity;
    const order = event?.payload?.order?.entity;

    if (type === "payment.captured" || type === "order.paid") {
      const razorpayOrderId = String(payment?.order_id || order?.id || "");
      const paymentId = String(payment?.id || "");
      const amount = Number(payment?.amount ?? order?.amount_paid ?? 0);
      const currency = String(payment?.currency || order?.currency || "");
      if (razorpayOrderId && paymentId && amount > 0) {
        await markPaid(razorpayOrderId, paymentId, amount, currency);
      }
    } else if (type === "payment.failed") {
      const razorpayOrderId = String(payment?.order_id || "");
      if (razorpayOrderId) {
        const reason = String(payment?.error_description || payment?.error_reason || "") || null;
        await markFailed(razorpayOrderId, payment?.id ? String(payment.id) : null, reason);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("razorpay webhook", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
