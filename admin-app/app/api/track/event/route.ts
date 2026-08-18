import { db, uid } from "@/lib/db";
import { classifySource } from "@/lib/source";
import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 120);
    const eventType = String(body.eventType || "").slice(0, 80);
    if (!sessionId || !eventType) return json(req, { error: "sessionId and eventType required" }, { status: 400 });
    const sql = db();
    const a = classifySource(body);
    const value = Math.max(0, Math.round(Number(body.value) || 0));
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    await sql`INSERT INTO "VisitorSession" ("id","lastSource") VALUES (${sessionId},${a.source}) ON CONFLICT ("id") DO UPDATE SET "lastSeenAt"=NOW(), "lastSource"=${a.source}`;
    await sql`
      INSERT INTO "AnalyticsEvent" ("id","sessionId","eventType","path","productId","productTitle","variant","value","metadata","source")
      VALUES (${uid("ev")},${sessionId},${eventType},${body.path || null},${body.productId || null},${body.productTitle || null},${body.variant || null},${value},${JSON.stringify(metadata)}::jsonb,${a.source})
    `;
    if (eventType === "checkout_start") {
      await sql`UPDATE "CartPresence" SET "checkoutStartedAt"=COALESCE("checkoutStartedAt",NOW()), "lastSeenAt"=NOW() WHERE "sessionId"=${sessionId}`;
    }
    return json(req, { ok: true });
  } catch (error) {
    console.error("track event", error);
    return json(req, { error: "event tracking unavailable" }, { status: 500 });
  }
}
