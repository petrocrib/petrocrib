import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    const [summary, top, inactive] = await Promise.all([
      sql`
        WITH paid AS (
          SELECT o."customerId", COUNT(*)::int AS orders, SUM(o."total")::bigint AS revenue,
            MIN(o."createdAt") AS first_paid, MAX(o."createdAt") AS last_paid
          FROM "Order" o WHERE o."paymentStatus"='paid' AND o."customerId" IS NOT NULL
          GROUP BY o."customerId"
        )
        SELECT COUNT(*)::int AS "customersWithOrders",
          COUNT(*) FILTER (WHERE orders > 1)::int AS "returningCustomers",
          COALESCE(SUM(revenue),0)::bigint AS "paidRevenue",
          COALESCE(SUM(revenue) FILTER (WHERE orders > 1),0)::bigint AS "returningRevenue",
          COALESCE(SUM(orders),0)::int AS "paidOrders",
          COALESCE(SUM(orders) FILTER (WHERE orders > 1),0)::int AS "returningOrders",
          COALESCE(AVG(revenue),0)::numeric(12,2) AS "customerRevenueAverage"
        FROM paid
      `,
      sql`
        SELECT c."id",c."name",c."email",c."phone",COUNT(o."id")::int AS "paidOrders",
          COALESCE(SUM(o."total"),0)::bigint AS "lifetimeValue",MAX(o."createdAt") AS "lastOrderAt"
        FROM "Customer" c JOIN "Order" o ON o."customerId"=c."id" AND o."paymentStatus"='paid'
        GROUP BY c."id" ORDER BY "lifetimeValue" DESC LIMIT 20
      `,
      sql`
        SELECT c."id",c."name",c."email",c."phone",c."totalOrders",c."lifetimeValue",c."lastOrderAt"
        FROM "Customer" c
        WHERE c."lastOrderAt" < NOW() - INTERVAL '90 days'
        ORDER BY c."lastOrderAt" ASC LIMIT 100
      `
    ]);
    const s: any = summary[0] || {};
    const rate = Number(s.customersWithOrders || 0) ? Number(s.returningCustomers || 0) / Number(s.customersWithOrders) * 100 : 0;
    const aov = Number(s.paidOrders || 0) ? Number(s.paidRevenue || 0) / Number(s.paidOrders) : 0;
    return NextResponse.json({ summary: { ...s, repeatCustomerRate: Number(rate.toFixed(1)), paidAov: Math.round(aov) }, top, inactive }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("returning customers", error);
    return NextResponse.json({ error: "Returning customer data unavailable" }, { status: 500 });
  }
}
