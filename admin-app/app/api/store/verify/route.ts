import { createHmac, timingSafeEqual } from "crypto";
import { db, uid } from "@/lib/db";
import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) { return preflight(req); }

function validSig(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (expected.length !== signature.length) return false;
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!orderId || !paymentId || !signature || !secret) return json(req, { valid: false }, { status: 400 });
    if (!validSig(orderId, paymentId, signature, secret)) return json(req, { valid: false }, { status: 400 });

    const sql = db();
    const changed = await sql`
      UPDATE "Order" SET "razorpayPaymentId"=${paymentId}, "paymentStatus"='paid', "fulfillmentStatus"='PAID', "updatedAt"=NOW()
      WHERE "razorpayOrderId"=${orderId} AND "paymentStatus"<>'paid'
      RETURNING "id","reference","customerId","sessionId","total"
    `;
    let reference: string | undefined;

    if (changed.length) {
      const order: any = changed[0];
      reference = order.reference;
      await sql`UPDATE "Customer" SET "totalOrders"="totalOrders"+1, "lifetimeValue"="lifetimeValue"+${order.total}, "lastOrderAt"=NOW(), "updatedAt"=NOW() WHERE "id"=${order.customerId}`;
      await sql`INSERT INTO "OrderUpdate" ("id","orderId","status","title","message") VALUES (${uid("upd")},${order.id},'PAID','Payment received','Payment has been verified. Your order is now confirmed for processing.')`;
      if (order.sessionId) {
        await sql`UPDATE "CartPresence" SET "items"='[]'::jsonb,"itemCount"=0,"cartValue"=0,"lastSeenAt"=NOW() WHERE "sessionId"=${order.sessionId}`;
        const items = await sql`SELECT "productId","title","variant","unitPrice","quantity" FROM "OrderItem" WHERE "orderId"=${order.id}`;
        for (const item of items as any[]) {
          await sql`INSERT INTO "AnalyticsEvent" ("id","sessionId","eventType","productId","productTitle","variant","value","metadata") VALUES (${uid("ev")},${order.sessionId},'purchase',${item.productId},${item.title},${item.variant},${item.unitPrice * item.quantity},${JSON.stringify({ quantity: item.quantity, orderReference: order.reference })}::jsonb)`;
        }
      }
    } else {
      const rows = await sql`SELECT "reference" FROM "Order" WHERE "razorpayOrderId"=${orderId} AND "razorpayPaymentId"=${paymentId} LIMIT 1`;
      if (!rows.length) return json(req, { valid: false }, { status: 404 });
      reference = String((rows[0] as any).reference);
    }

    return json(req, { valid: true, reference });
  } catch (error) {
    console.error("verify payment", error);
    return json(req, { valid: false }, { status: 500 });
  }
}
