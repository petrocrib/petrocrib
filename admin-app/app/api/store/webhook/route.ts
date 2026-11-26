import { after } from "next/server";
import { notifyAdminOfPaidOrder } from "@/lib/admin-push";
import { createHmac, timingSafeEqual } from "crypto";
import { db, uid } from "@/lib/db";
import { sendOrderProcessingEmail } from "@/src/lib/order-emails";

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

async function sendProcessingConfirmation(order: any) {
  try {
    const sql = db();
    const [customerRows, items] = await Promise.all([
      sql`SELECT "name","email" FROM "Customer" WHERE "id"=${order.customerId} LIMIT 1`,
      sql`SELECT "productId","title","variant","unitPrice","quantity","image" FROM "OrderItem" WHERE "orderId"=${order.id}`,
    ]);
    const customer: any = customerRows[0] || {};
    await sendOrderProcessingEmail({
      id: String(order.id),
      reference: String(order.reference),
      total: order.total,
      customerName: customer.name,
      customerEmail: customer.email,
      items: items as any[],
    }, `order-confirmation/${order.id}`);
  } catch (emailErr) {
    console.error("processing email error", emailErr instanceof Error ? emailErr.message : "unknown error");
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
  if (existing.paymentStatus === "paid") {
    if (String(existing.razorpayPaymentId || "") === paymentId) await sendProcessingConfirmation(existing);
    return;
  }

  await sql`CREATE SEQUENCE IF NOT EXISTS "OrderReferenceSequence" START WITH 1`;
  const changed = await sql`
    UPDATE "Order"
    SET "reference"='PC-' || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY') || '-' || LPAD(nextval('"OrderReferenceSequence"')::text, 5, '0'),
        "razorpayPaymentId"=${paymentId}, "paymentStatus"='paid', "fulfillmentStatus"='PAID', "updatedAt"=NOW()
    WHERE "id"=${existing.id} AND "paymentStatus"<>'paid'
    RETURNING "id","reference","customerId","sessionId","total"
  `;
  if (!changed.length) {
    const latestRows = await sql`
      SELECT "id","reference","customerId","total","paymentStatus","razorpayPaymentId"
      FROM "Order" WHERE "id"=${existing.id} LIMIT 1
    `;
    const latest: any = latestRows[0] || {};
    if (latest.paymentStatus === "paid" && String(latest.razorpayPaymentId || "") === paymentId) {
      await sendProcessingConfirmation(latest);
    }
    return;
  }

  const order: any = changed[0];
  after(() => notifyAdminOfPaidOrder(String(order.id)));
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

  await sendProcessingConfirmation(order);

  if (order.sessionId) {
    await sql`
      UPDATE "CartPresence"
      SET "items"='[]'::jsonb,"itemCount"=0,"cartValue"=0,"lastSeenAt"=NOW()
      WHERE "sessionId"=${order.sessionId}
    `;
    const items = await sql`
      SELECT "productId","title","variant","unitPrice","quantity","image"
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
