import { NextResponse } from "next/server";
import { corsHeaders, isStoreRequestAllowed, preflight } from "../../../../lib/http";
import { listStoreProducts } from "../../../../lib/products";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !isStoreRequestAllowed(req)) return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json({ products: await listStoreProducts() }, { headers: corsHeaders(origin) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Catalogue unavailable" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
