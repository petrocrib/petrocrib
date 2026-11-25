import { createHmac, timingSafeEqual } from "crypto";
import { reportMetaPurchase } from "@/lib/meta-purchase";
import { db, uid } from "@/lib/db";
import { isStoreRequestAllowed, json, preflight } from "@/lib/http";
import { sendOrderProcessingEmail } from "@/src/lib/order-emails";

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
    if (!isStoreRequestAllowed(req)) return json(req, { valid: false }, { status: 403 });
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return json(req, { valid: false }, { status: 415 });

    const body = await req.json();
    const browserOrderId = String(body.razorpay_order_id || "").slice(0, 120);
    const paymentId = String(body.razorpay_payment_id || "").slice(0, 120);
    const signature = String(body.razorpay_signature || "").slice(0, 256);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!browserOrderId || !paymentId || !signature || !keyId || !secret) {
      return json(req, { valid: false }, { status: 400 });
    }

    const sql = db();

    const sendProcessingConfirmation = async (order: any) => {
      try {
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
    };
    const orderRows = await sql`
      SELECT "id","reference","customerId","sessionId","total","razorpayOrderId","razorpayPaymentId","paymentStatus"
      FROM "Order" WHERE "razorpayOrderId"=${browserOrderId} LIMIT 1
    `;
    if (!orderRows.length) return json(req, { valid: false }, { status: 404 });

    const stored: any = orderRows[0];
    const storedOrderId = String(stored.razorpayOrderId || "");
    if (!validSig(storedOrderId, paymentId, signature, secret)) {
      return json(req, { valid: false }, { status: 400 });
    }

    const rzRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Authorization": `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
      cache: "no-store"
    });
    const payment: any = await rzRes.json();
    if (!rzRes.ok) {
      console.error("razorpay payment lookup", { status: rzRes.status, code: payment?.error?.code });
      return json(req, { valid: false }, { status: 502 });
    }

    const paymentMatches =
      String(payment.order_id || "") === storedOrderId &&
      String(payment.currency || "").toUpperCase() === "INR" &&
      Number(payment.amount) === Number(stored.total) * 100 &&
      (payment.status === "captured" || payment.captured === true);

    if (!paymentMatches) {
      return json(req, { valid: false }, { status: 400 });
    }

    await sql`CREATE SEQUENCE IF NOT EXISTS "OrderReferenceSequence" START WITH 1`;
    const changed = await sql`
      UPDATE "Order"
      SET "reference"='PC-' || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY') || '-' || LPAD(nextval('"OrderReferenceSequence"')::text, 5, '0'),
          "razorpayPaymentId"=${paymentId}, "paymentStatus"='paid', "fulfillmentStatus"='PAID', "updatedAt"=NOW()
      WHERE "id"=${stored.id} AND "paymentStatus"<>'paid'
      RETURNING "id","reference","customerId","sessionId","total"
    `;

    let reference = String(stored.reference);
    if (changed.length) {
      const order: any = changed[0];
      reference = String(order.reference);
      await sql`
        UPDATE "Customer"
        SET "totalOrders"="totalOrders"+1, "lifetimeValue"="lifetimeValue"+${order.total}, "lastOrderAt"=NOW(), "updatedAt"=NOW()
        WHERE "id"=${order.customerId}
      `;
      await sql`
        INSERT INTO "OrderUpdate" ("id","orderId","status","title","message")
        VALUES (${uid("upd")},${order.id},'PAID','Payment received','Payment was verified directly with Razorpay and is confirmed for processing.')
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
            VALUES (${uid("ev")},${order.sessionId},'purchase',${item.productId},${item.title},${item.variant},${item.unitPrice * item.quantity},${JSON.stringify({ quantity: item.quantity, orderReference: order.reference, confirmedBy: "server_verify" })}::jsonb)
          `;
        }
      }
    } else {
      const latestPaidRows = await sql`
        SELECT "reference","paymentStatus","razorpayPaymentId" FROM "Order" WHERE "id"=${stored.id} LIMIT 1
      `;
      const latestPaid: any = latestPaidRows[0] || {};
      const alreadyPaid = latestPaid.paymentStatus === "paid" && String(latestPaid.razorpayPaymentId || "") === paymentId;
      if (!alreadyPaid) return json(req, { valid: false }, { status: 409 });
      reference = String(latestPaid.reference || stored.reference);
      await sendProcessingConfirmation({ ...stored, reference });
    }

    await reportMetaPurchase(String(stored.id), paymentId);
    return json(req, { valid: true, reference, amount: Number(stored.total) });
  } catch (error) {
    console.error("verify payment", error instanceof Error ? error.message : "unknown error");
    return json(req, { valid: false }, { status: 500 });
  }
}
