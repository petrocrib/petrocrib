import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string, token: string) {
  const safeToken = token.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html = "<!doctype html><html><meta name='viewport' content='width=device-width'><title>Petrocrib email preferences</title><body style='font:16px Arial;background:#080808;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px'><main style='max-width:440px'><h1 style='color:#fcd019'>Email preferences</h1><p>" + message + "</p><form method='post'><input type='hidden' name='token' value='" + safeToken + "'><button style='background:#fcd019;color:#080808;border:0;border-radius:8px;padding:13px 20px;font-weight:bold'>Confirm unsubscribe</button></form><p><a style='color:#fcd019' href='https://www.petrocrib.in'>Back to Petrocrib</a></p></main></body></html>";
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.slice(0, 100) || "";
  if (!token) return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  return page("If you no longer want promotional emails from Petrocrib, confirm below. Opening this page alone will not change your preferences.", token);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const token = (url.searchParams.get("token") || String(form?.get("token") || "")).slice(0, 100);
  if (!token) return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  try {
    const sql = db();
    const rows = await sql`UPDATE "Customer" SET "marketingUnsubscribedAt"=NOW(), "updatedAt"=NOW() WHERE "marketingUnsubscribeToken"=${token} RETURNING "id"`;
    if (!rows.length) return new NextResponse("Invalid unsubscribe link.", { status: 404 });
    return new NextResponse("<!doctype html><html><meta name='viewport' content='width=device-width'><body style='font:16px Arial;background:#080808;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center'><main><h1 style='color:#fcd019'>You're unsubscribed.</h1><p>You will no longer receive Petrocrib promotional emails.</p><a style='color:#fcd019' href='https://www.petrocrib.in'>Back to Petrocrib</a></main></body></html>", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("unsubscribe", error);
    return new NextResponse("Could not process unsubscribe. Please contact support.", { status: 500 });
  }
}
