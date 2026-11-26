import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const params = new URL(req.url).searchParams;
    const q = params.get("q")?.trim().slice(0, 120) || "";
    const archived = params.get("archived") === "true";
    const payment = params.get("payment") || "all";
    if (payment !== "all" && payment !== "paid" && payment !== "unpaid") {
      return NextResponse.json({ error: "Invalid payment filter" }, { status: 400 });
    }

    const pattern = `%${q}%`;
    const sql = db();
    const rows = await sql`
      SELECT o.*, COALESCE(json_agg(i ORDER BY i."id") FILTER (WHERE i."id" IS NOT NULL),'[]') AS items
      FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o."id"
      WHERE (o."archivedAt" IS NOT NULL) = ${archived}
        AND (
          ${payment} = 'all'
          OR (${payment} = 'paid' AND o."paymentStatus" = 'paid')
          OR (${payment} = 'unpaid' AND o."paymentStatus" IS DISTINCT FROM 'paid')
        )
        AND (
          ${q} = '' OR o."reference" ILIKE ${pattern} OR o."customerName" ILIKE ${pattern}
          OR o."phone" ILIKE ${pattern} OR o."razorpayPaymentId" ILIKE ${pattern}
        )
      GROUP BY o."id" ORDER BY o."createdAt" DESC LIMIT 300
    `;
    return NextResponse.json({ orders: rows });
  } catch (error) {
    console.error("admin orders", error);
    return NextResponse.json({ error: "Orders unavailable" }, { status: 500 });
  }
}
