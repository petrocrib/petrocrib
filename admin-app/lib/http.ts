import { NextResponse } from "next/server";

const allowed = new Set([
  "https://petrocrib.in",
  "https://www.petrocrib.in",
  "http://localhost:3000",
  "http://localhost:5500"
]);

export function corsHeaders(origin: string | null) {
  const ok = origin && (allowed.has(origin) || origin.endsWith(".vercel.app"));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://petrocrib.in",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export function json(req: Request, data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders(req.headers.get("origin")), ...(init.headers || {}) }
  });
}
