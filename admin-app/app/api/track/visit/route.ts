import { db, uid } from "@/lib/db";
import { classifySource } from "@/lib/source";
import { isStoreRequestAllowed, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  try {
    if (!isStoreRequestAllowed(req)) return json(req, { error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    const sessionId = String(body.sessionId || "").slice(0, 120);
    const path = String(body.path || "/").slice(0, 800);
    if (!sessionId) return json(req, { error: "sessionId required" }, { status: 400 });

    const a = classifySource(body);
    const sql = db();
    const country = req.headers.get("x-vercel-ip-country") || undefined;
    const region = req.headers.get("x-vercel-ip-country-region") || undefined;
    const city = req.headers.get("x-vercel-ip-city") ? decodeURIComponent(req.headers.get("x-vercel-ip-city")!) : undefined;
    const ua = (req.headers.get("user-agent") || "").slice(0, 800) || undefined;
    const device = typeof body.deviceType === "string" ? body.deviceType.slice(0, 40) : undefined;

    await sql`
      INSERT INTO "VisitorSession" (
        "id","landingPath","lastPath","country","region","city","userAgent","deviceType",
        "firstSource","firstReferrer","firstUtmSource","firstUtmMedium","firstUtmCampaign","firstUtmContent","firstUtmTerm",
        "lastSource","lastReferrer","lastUtmSource","lastUtmMedium","lastUtmCampaign","lastUtmContent","lastUtmTerm"
      ) VALUES (
        ${sessionId},${path},${path},${country || null},${region || null},${city || null},${ua || null},${device || null},
        ${a.source},${a.referrer || null},${a.utmSource || null},${a.utmMedium || null},${a.utmCampaign || null},${a.utmContent || null},${a.utmTerm || null},
        ${a.source},${a.referrer || null},${a.utmSource || null},${a.utmMedium || null},${a.utmCampaign || null},${a.utmContent || null},${a.utmTerm || null}
      )
      ON CONFLICT ("id") DO UPDATE SET
        "lastSeenAt"=NOW(),
        "lastPath"=EXCLUDED."lastPath",
        "country"=COALESCE(EXCLUDED."country","VisitorSession"."country"),
        "region"=COALESCE(EXCLUDED."region","VisitorSession"."region"),
        "city"=COALESCE(EXCLUDED."city","VisitorSession"."city"),
        "userAgent"=COALESCE(EXCLUDED."userAgent","VisitorSession"."userAgent"),
        "deviceType"=COALESCE(EXCLUDED."deviceType","VisitorSession"."deviceType"),
        "lastSource"=EXCLUDED."lastSource",
        "lastReferrer"=EXCLUDED."lastReferrer",
        "lastUtmSource"=EXCLUDED."lastUtmSource",
        "lastUtmMedium"=EXCLUDED."lastUtmMedium",
        "lastUtmCampaign"=EXCLUDED."lastUtmCampaign",
        "lastUtmContent"=EXCLUDED."lastUtmContent",
        "lastUtmTerm"=EXCLUDED."lastUtmTerm"
    `;

    if (!body.heartbeat) {
      await sql`
        INSERT INTO "PageView" ("id","sessionId","path","productId","productTitle","source","referrer","utmSource","utmMedium","utmCampaign")
        VALUES (${uid("pv")},${sessionId},${path},${body.productId || null},${body.productTitle || null},${a.source},${a.referrer || null},${a.utmSource || null},${a.utmMedium || null},${a.utmCampaign || null})
      `;
    }
    return json(req, { ok: true, source: a.source });
  } catch (error) {
    console.error("track visit", error instanceof Error ? error.message : "unknown error");
    return json(req, { error: "tracking unavailable" }, { status: 500 });
  }
}
