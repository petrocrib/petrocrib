import { NextResponse } from "next/server";

const productionStoreOrigins = new Set([
  "https://petrocrib.in",
  "https://www.petrocrib.in"
]);

const developmentOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:5500"
]);

export function isStoreOriginAllowed(origin: string | null) {
  if (!origin) return false;
  if (productionStoreOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== "production" && developmentOrigins.has(origin);
}

export function isStoreRequestAllowed(req: Request) {
  return isStoreOriginAllowed(req.headers.get("origin"));
}

export function isSameOriginRequest(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
  if (isStoreOriginAllowed(origin)) headers["Access-Control-Allow-Origin"] = origin!;
  return headers;
}

export function preflight(req: Request) {
  const origin = req.headers.get("origin");
  if (!isStoreOriginAllowed(origin)) return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export function json(req: Request, data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    status: init.status,
    statusText: init.statusText,
    headers: corsHeaders(req.headers.get("origin"))
  });
}
