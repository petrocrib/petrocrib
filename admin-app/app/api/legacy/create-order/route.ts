import { json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_WORKER = "https://petrocrib-pay.petrocrib.workers.dev";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const upstream = await fetch(`${LEGACY_WORKER}/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://petrocrib.in"
      },
      body,
      cache: "no-store"
    });

    const text = await upstream.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || "Payment service returned an invalid response" };
    }

    return json(req, data, { status: upstream.status });
  } catch (error) {
    console.error("legacy create-order proxy", error);
    return json(req, { error: "Payment service temporarily unavailable" }, { status: 502 });
  }
}
