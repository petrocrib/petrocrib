import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 120) || "";
    const sql = db();
    const rows = q
      ? await sql`
        SELECT o.*, COALESCE(json_agg(i ORDER BY i."id") FILTER (WHERE i."id" IS NOT NULL),'[]') AS items
        FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o."id"
        WHERE o."reference" ILIKE ${`%${q}%`} OR o."customerName" ILIKE ${`%${q}%`} OR o."phone" ILIKE ${`%${q}%`} OR o."razorpayPaymentId" ILIKE ${`%${q}%`}
        GROUP BY o."id" ORDER BY o."createdAt" DESC LIMIT 300
      `
      : await sql`
        SELECT o.*, COALESCE(json_agg(i ORDER BY i."id") FILTER (WHERE i."id" IS NOT NULL),'[]') AS items
        FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o."id"
        GROUP BY o."id" ORDER BY o."createdAt" DESC LIMIT 300
      `;
    return NextResponse.json({ orders: rows });
  } catch (error) {
    console.error("admin orders", error);
    return NextResponse.json({ error: "Orders unavailable" }, { status: 500 });
  }
}
