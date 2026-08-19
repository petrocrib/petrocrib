import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { isSameOriginRequest } from "../../../../../lib/http";
import { archiveProduct, updateProduct } from "../../../../../lib/products";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 });
  try {
    const { id } = await context.params;
    const product = await updateProduct(id, await req.json());
    return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update product";
    const status = /duplicate key|already exists/i.test(message) ? 409 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const { id } = await context.params;
    const product = await archiveProduct(id);
    return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not archive product";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
