import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { isSameOriginRequest } from "../../../../../lib/http";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAdmin())) throw new Error("Unauthorized");
        if (!isSameOriginRequest(request)) throw new Error("Invalid origin");
        if (!pathname.startsWith("products/") || pathname.includes("..")) throw new Error("Invalid upload path");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ scope: "product-image" }),
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = /Unauthorized/.test(message) ? 401 : /origin/.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
