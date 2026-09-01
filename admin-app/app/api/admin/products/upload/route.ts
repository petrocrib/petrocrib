import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { isSameOriginRequest } from "../../../../../lib/http";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function safePart(value: unknown, fallback: string) {
  const cleaned = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const form = await request.formData();
    const file = form.get("file");
    const handle = safePart(form.get("handle"), "new-product");

    if (!(file instanceof File)) throw new Error("Choose an image to upload");
    if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use a JPG, PNG or WebP image");
    if (file.size < 1) throw new Error("The selected image is empty");
    if (file.size > MAX_FILE_BYTES) throw new Error("Image is still too large after optimisation. Please choose a smaller image.");

    const filename = safePart(file.name, `image-${Date.now()}.webp`);
    const blob = await put(`products/${handle}/${Date.now()}-${filename}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json(
      { url: blob.url, pathname: blob.pathname, contentType: blob.contentType },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
