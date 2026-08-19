import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { isSameOriginRequest } from "../../../../lib/http";
import { createProduct, listAdminProducts } from "../../../../lib/products";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ products: await listAdminProducts() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load products" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 });
  try {
    const product = await createProduct(await req.json());
    return NextResponse.json({ product }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create product";
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
