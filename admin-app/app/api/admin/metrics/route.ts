import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    const [summary, sources, orderSources, daily, locations, pages, products, carts, abandoned] = await Promise.all([
      sql`
        WITH bounds AS (
          SELECT (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS day_start
        )
        SELECT
          (SELECT COUNT(*)::int FROM "VisitorSession" WHERE "lastSeenAt" > NOW() - INTERVAL '3 minutes') AS "activeUsers",
          (SELECT COUNT(DISTINCT "sessionId")::int FROM "PageView", bounds WHERE "createdAt" >= bounds.day_start) AS "visitorsToday",
          (SELECT COUNT(*)::int FROM "PageView", bounds WHERE "createdAt" >= bounds.day_start) AS "pageViewsToday",
          (SELECT COUNT(*)::int FROM "CartPresence" WHERE "itemCount" > 0 AND "lastSeenAt" > NOW() - INTERVAL '10 minutes') AS "liveCarts",
          (SELECT COALESCE(SUM("cartValue"),0)::int FROM "CartPresence" WHERE "itemCount" > 0 AND "lastSeenAt" > NOW() - INTERVAL '10 minutes') AS "liveCartValue",
          (SELECT COUNT(*)::int FROM "Order", bounds WHERE "createdAt" >= bounds.day_start) AS "ordersToday",
          (SELECT COUNT(*)::int FROM "Order" WHERE "paymentStatus"='paid') AS "paidOrders",
          (SELECT COUNT(*)::int FROM "Order") AS "totalOrders",
          (SELECT COALESCE(SUM("total"),0)::int FROM "Order" WHERE "paymentStatus"='paid') AS "lifetimeRevenue",
          (SELECT COALESCE(SUM("total"),0)::int FROM "Order", bounds WHERE "paymentStatus"='paid' AND "createdAt" >= bounds.day_start) AS "revenueToday",
          (SELECT COALESCE(ROUND(AVG("total")),0)::int FROM "Order" WHERE "paymentStatus"='paid') AS "averageOrderValue"
      `,
      sql`SELECT "firstSource" AS source, COUNT(*)::int AS visitors FROM "VisitorSession" WHERE "firstSeenAt" > NOW()-INTERVAL '30 days' GROUP BY "firstSource" ORDER BY visitors DESC`,
      sql`SELECT "source", COUNT(*)::int AS orders, COALESCE(SUM("total"),0)::int AS revenue FROM "Order" WHERE "paymentStatus"='paid' AND "createdAt" > NOW()-INTERVAL '30 days' GROUP BY "source" ORDER BY revenue DESC`,
      sql`
        WITH days AS (SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date d)
        SELECT d::text AS date,
          COALESCE(COUNT(DISTINCT p."sessionId"),0)::int AS visitors,
          COALESCE(COUNT(p."id"),0)::int AS views
        FROM days LEFT JOIN "PageView" p ON (p."createdAt" AT TIME ZONE 'Asia/Kolkata')::date=d
        GROUP BY d ORDER BY d
      `,
      sql`SELECT COALESCE("city",'Unknown') AS city, COALESCE("region",'') AS region, COALESCE("country",'Unknown') AS country, COUNT(*)::int AS visitors FROM "VisitorSession" WHERE "firstSeenAt">NOW()-INTERVAL '30 days' GROUP BY "city","region","country" ORDER BY visitors DESC LIMIT 30`,
      sql`SELECT "path", COUNT(*)::int AS views, COUNT(DISTINCT "sessionId")::int AS visitors FROM "PageView" WHERE "createdAt">NOW()-INTERVAL '7 days' GROUP BY "path" ORDER BY views DESC LIMIT 15`,
      sql`
        SELECT "productId", MAX("productTitle") AS title,
          COUNT(*) FILTER (WHERE "eventType"='product_view')::int AS views,
          COUNT(*) FILTER (WHERE "eventType"='add_to_cart')::int AS adds,
          COUNT(*) FILTER (WHERE "eventType"='purchase')::int AS purchases
        FROM "AnalyticsEvent"
        WHERE "productId" IS NOT NULL AND "createdAt">NOW()-INTERVAL '30 days'
        GROUP BY "productId" ORDER BY views DESC LIMIT 20
      `,
      sql`SELECT "sessionId","items","itemCount","cartValue","lastSeenAt","checkoutStartedAt" FROM "CartPresence" WHERE "itemCount">0 AND "lastSeenAt">NOW()-INTERVAL '10 minutes' ORDER BY "lastSeenAt" DESC LIMIT 20`,
      sql`SELECT COUNT(*)::int AS count, COALESCE(SUM("cartValue"),0)::int AS value FROM "CartPresence" c WHERE c."itemCount">0 AND c."lastSeenAt" BETWEEN NOW()-INTERVAL '7 days' AND NOW()-INTERVAL '30 minutes' AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."sessionId"=c."sessionId")`
    ]);

    const s: any = summary[0] || {};
    const visitors = Number(s.visitorsToday || 0);
    const paidTodayRows = await sql`WITH b AS (SELECT (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS d) SELECT COUNT(*)::int AS count FROM "Order", b WHERE "paymentStatus"='paid' AND "createdAt">=b.d`;
    const paidToday = Number((paidTodayRows[0] as any)?.count || 0);

    return NextResponse.json({
      summary: { ...s, paidOrdersToday: paidToday, conversionToday: visitors ? Number(((paidToday / visitors) * 100).toFixed(2)) : 0 },
      sources,
      orderSources,
      daily,
      locations,
      pages,
      products,
      liveCarts: carts,
      abandoned: abandoned[0] || { count: 0, value: 0 }
    });
  } catch (error) {
    console.error("admin metrics", error);
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 500 });
  }
}
