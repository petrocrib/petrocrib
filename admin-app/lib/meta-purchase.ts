import { createHash } from "node:crypto";
import { db } from "@/lib/db";
export async function reportMetaPurchase(orderId: string | null, paymentId: string) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const version = process.env.META_CAPI_GRAPH_VERSION;
  if (process.env.META_CAPI_ENABLED !== "true" || !token || !version || !/^v\d+\.\d+$/.test(version) || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return;
  try {
    const sql = db();
    const rows = await sql`
      UPDATE "MetaPurchaseConsent" c SET "lastAttemptAt"=NOW()
      FROM "Order" o
      WHERE c."orderId"=o."id" AND (${orderId}::text IS NULL OR o."id"=${orderId})
        AND o."paymentStatus"='paid' AND o."razorpayPaymentId"=${paymentId}
        AND c."sentAt" IS NULL AND c."consentedAt">NOW()-INTERVAL '1 day'
        AND (c."lastAttemptAt" IS NULL OR c."lastAttemptAt"<NOW()-INTERVAL '5 minutes')
      RETURNING o."id", o."total", o."email", o."phone"
    `;
    const row = rows[0];
    if (!row) return;
    const value = Number(row.total);
    if (!Number.isFinite(value) || value <= 0) return;
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    const email = String(row.email || "").trim().toLowerCase();
    let phone = String(row.phone || "").replace(/\D/g,"");
    if (phone.length === 10) phone = "91" + phone;
    const user_data = { ...(email ? {em:[hash(email)]} : {}), ...(phone.length >= 11 && phone.length <= 15 ? {ph:[hash(phone)]} : {}) };
    if (!Object.keys(user_data).length) return;
    const code = process.env.META_CAPI_TEST_EVENT_CODE;
    const response = await fetch(`https://graph.facebook.com/${version}/241903595474647/events`, {
      method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body:JSON.stringify({data:[{event_name:"Purchase",event_id:paymentId,event_time:Math.floor(Date.now()/1000),action_source:"website",event_source_url:"https://petrocrib.in/cart.html",user_data,custom_data:{currency:"INR",value}}],...(code?{test_event_code:code}:{})}),
      signal:AbortSignal.timeout(2500), cache:"no-store"
    });
    if (!response.ok) { console.warn("Meta purchase delivery rejected", response.status); return; }
    const result = await response.json();
    if (result.events_received !== 1) return;
    await sql`UPDATE "MetaPurchaseConsent" SET "sentAt"=NOW() WHERE "orderId"=${row.id}`;
  } catch { console.warn("Meta purchase delivery unavailable"); }
}
