import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { adminCookie, makeAdminToken } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";

function sameSecret(a: string, b: string) {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  try { return timingSafeEqual(ah, bh); } catch { return false; }
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const { password } = await req.json();
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 });
    if (typeof password !== "string" || !sameSecret(password, expected)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set(adminCookie.name, makeAdminToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: adminCookie.maxAge
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
