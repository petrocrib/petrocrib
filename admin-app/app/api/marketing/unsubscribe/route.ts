import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.slice(0, 100) || "";
  if (!token) return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  try {
    const sql = db();
    const rows = await sql`
      UPDATE "Customer" SET "marketingUnsubscribedAt"=NOW(), "updatedAt"=NOW()
      WHERE "marketingUnsubscribeToken"=${token}
      RETURNING "email"
    `;
    if (!rows.length) return new NextResponse("This unsubscribe link is invalid or has already expired.", { status: 404 });
    return new NextResponse("<!doctype html><html><meta name='viewport' content='width=device-width'><title>Unsubscribed</title><body style='font:16px Arial;background:#080808;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center'><main><h1 style='color:#fcd019'>You're unsubscribed.</h1><p>You will no longer receive Petrocrib promotional emails.</p><a style='color:#fcd019' href='https://www.petrocrib.in'>Back to Petrocrib</a></main></body></html>", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("unsubscribe", error);
    return new NextResponse("Could not process unsubscribe. Please contact support.", { status: 500 });
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.slice(0, 100) || "";
  if (!token) return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  try {
    const sql = db();
    const rows = await sql`UPDATE "Customer" SET "marketingUnsubscribedAt"=NOW(), "updatedAt"=NOW() WHERE "marketingUnsubscribeToken"=${token} RETURNING "id"`;
    if (!rows.length) return new NextResponse("Invalid unsubscribe link.", { status: 404 });
    return new NextResponse("Unsubscribed", { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("unsubscribe one-click", error);
    return new NextResponse("Could not process unsubscribe.", { status: 500 });
  }
}
