import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) || "";
    const sql = db();
    const customers = q ? await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM "Order" o WHERE o."customerId"=c."id" AND o."paymentStatus"='paid') AS "paidOrderCount",
        (SELECT MAX(o."createdAt") FROM "Order" o WHERE o."customerId"=c."id" AND o."paymentStatus"='paid') AS "lastPaidOrderAt"
      FROM "Customer" c
      WHERE c."name" ILIKE ${`%${q}%`} OR c."email" ILIKE ${`%${q}%`} OR c."phone" ILIKE ${`%${q}%`}
      ORDER BY c."lastOrderAt" DESC NULLS LAST LIMIT 500
    ` : await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM "Order" o WHERE o."customerId"=c."id" AND o."paymentStatus"='paid') AS "paidOrderCount",
        (SELECT MAX(o."createdAt") FROM "Order" o WHERE o."customerId"=c."id" AND o."paymentStatus"='paid') AS "lastPaidOrderAt"
      FROM "Customer" c ORDER BY c."lastOrderAt" DESC NULLS LAST LIMIT 500
    `;
    return NextResponse.json({ customers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin customers", error);
    return NextResponse.json({ error: "Customers unavailable" }, { status: 500 });
  }
}
