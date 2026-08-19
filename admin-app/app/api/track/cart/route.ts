import { db, uid } from "@/lib/db";
import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 120);
    if (!sessionId) return json(req, { error: "sessionId required" }, { status: 400 });
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    const items = rawItems.map((it: any) => ({
      title: String(it?.title || "").slice(0, 180),
      variant: String(it?.variant || "").slice(0, 180),
      price: Math.max(0, Math.round(Number(it?.price) || 0)),
      qty: Math.min(10, Math.max(1, Math.round(Number(it?.qty) || 1))),
      img: typeof it?.img === "string" ? it.img.slice(0, 1000) : ""
    })).filter((it: any) => it.title);
    const itemCount = items.reduce((n: number, it: any) => n + it.qty, 0);
    const cartValue = items.reduce((n: number, it: any) => n + it.price * it.qty, 0);
    const sql = db();

    await sql`INSERT INTO "VisitorSession" ("id") VALUES (${sessionId}) ON CONFLICT ("id") DO UPDATE SET "lastSeenAt"=NOW()`;
    await sql`
      INSERT INTO "CartPresence" ("sessionId","items","itemCount","cartValue","lastSeenAt")
      VALUES (${sessionId},${JSON.stringify(items)}::jsonb,${itemCount},${cartValue},NOW())
      ON CONFLICT ("sessionId") DO UPDATE SET
        "items"=EXCLUDED."items", "itemCount"=EXCLUDED."itemCount", "cartValue"=EXCLUDED."cartValue", "lastSeenAt"=NOW()
    `;
    await sql`
      INSERT INTO "AnalyticsEvent" ("id","sessionId","eventType","value","metadata")
      VALUES (${uid("ev")},${sessionId},${itemCount ? "cart_update" : "cart_empty"},${cartValue},${JSON.stringify({ itemCount })}::jsonb)
    `;
    return json(req, { ok: true, itemCount, cartValue });
  } catch (error) {
    console.error("track cart", error);
    return json(req, { error: "cart tracking unavailable" }, { status: 500 });
  }
}
