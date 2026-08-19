import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db, uid } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["PAYMENT_PENDING","PAID","CONFIRMED","PACKED","SHIPPED","DELIVERED","CANCELLED","RETURNED","REFUNDED"]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const sql = db();
    const orders = await sql`SELECT * FROM "Order" WHERE "id"=${id} LIMIT 1`;
    if (!orders.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [items, updates] = await Promise.all([
      sql`SELECT * FROM "OrderItem" WHERE "orderId"=${id} ORDER BY "id"`,
      sql`SELECT * FROM "OrderUpdate" WHERE "orderId"=${id} ORDER BY "createdAt" DESC`
    ]);
    return NextResponse.json({ order: orders[0], items, updates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("order detail", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Order unavailable" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
    const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : undefined;
    const courier = typeof body.courier === "string" ? body.courier.trim().slice(0, 120) : undefined;
    const tracking = typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 160) : undefined;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1200) : "";
    const visible = body.visibleToCustomer !== false;
    const sql = db();

    if (status) await sql`UPDATE "Order" SET "fulfillmentStatus"=${status}, "updatedAt"=NOW() WHERE "id"=${id}`;
    if (courier !== undefined || tracking !== undefined) {
      await sql`UPDATE "Order" SET "courier"=COALESCE(${courier || null},"courier"), "trackingNumber"=COALESCE(${tracking || null},"trackingNumber"), "updatedAt"=NOW() WHERE "id"=${id}`;
    }
    if (title && message) {
      await sql`INSERT INTO "OrderUpdate" ("id","orderId","status","title","message","visibleToCustomer") VALUES (${uid("upd")},${id},${status || null},${title},${message},${visible})`;
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("order update", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}
