import { isAdmin } from "@/lib/auth";
import { db, uid } from "@/lib/db";
import { isChromeEndpoint, pushConfig, sendAdminPush } from "@/lib/admin-push";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) return new Response(null, { status: 401 });
  return Response.json({ publicKey: pushConfig()?.publicKey ?? null }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response(null, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin) return new Response(null, { status: 403 });
  if (!pushConfig()) return new Response(null, { status: 503 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !isChromeEndpoint(endpoint)) {
    return new Response(null, { status: 400 });
  }

  try {
    const sql = db();
    if (body.action === "status") {
      const rows = await sql`SELECT 1 FROM "AdminPushSubscription" WHERE "endpoint"=${endpoint}`;
      if (!rows.length) return new Response(null, { status: 404 });
    } else if (body.action === "disable") {
      await sql`DELETE FROM "AdminPushSubscription" WHERE "endpoint"=${endpoint}`;
    } else if (body.action === "test") {
      if (!(await sendAdminPush(endpoint))) return new Response(null, { status: 502 });
    } else if (body.action === "enable") {
      const { p256dh, auth } = body.keys ?? {};
      if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(p256dh) ||
          typeof auth !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(auth)) {
        return new Response(null, { status: 400 });
      }
      await sql`INSERT INTO "AdminPushSubscription" ("id", "endpoint", "p256dh", "auth")
        VALUES (${uid("push")}, ${endpoint}, ${p256dh}, ${auth})
        ON CONFLICT ("endpoint") DO UPDATE SET "p256dh"=EXCLUDED."p256dh",
          "auth"=EXCLUDED."auth", "updatedAt"=now()`;
    } else {
      return new Response(null, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch {
    console.error("Admin push request failed");
    return new Response(null, { status: 503 });
  }
}
