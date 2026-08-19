import { db, uid } from "./db";

export type ProductRecord = {
  id: string;
  handle: string;
  title: string;
  body: string;
  images: string[];
  types: string[];
  typePrices: Record<string, number>;
  colors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function slugify(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function cleanList(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [] as string[];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const v = String(item || "").trim().slice(0, 80);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    result.push(v);
    if (result.length >= max) break;
  }
  return result;
}

function trustedImageUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "cdn.shopify.com" ||
      host === "petrocrib.in" ||
      host === "www.petrocrib.in" ||
      host.endsWith(".public.blob.vercel-storage.com");
    return allowed ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanImages(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(trustedImageUrl).filter(Boolean).slice(0, 24);
}

function sanitizeBody(value: unknown) {
  let html = String(value || "").slice(0, 120_000);
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link|svg|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|button|meta|link|svg|math)\b[^>]*\/?\s*>/gi, "");
  html = html.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
  return html.trim();
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function rowToProduct(row: any): ProductRecord {
  return {
    id: String(row.id),
    handle: String(row.handle),
    title: String(row.title),
    body: String(row.body || ""),
    images: jsonValue<string[]>(row.images, []),
    types: jsonValue<string[]>(row.types, []),
    typePrices: jsonValue<Record<string, number>>(row.typePrices, {}),
    colors: jsonValue<string[]>(row.colors, []),
    sizes: jsonValue<string[]>(row.sizes, []),
    minPrice: Number(row.minPrice || 0),
    maxPrice: Number(row.maxPrice || 0),
    isActive: Boolean(row.isActive),
    sortOrder: Number(row.sortOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeProduct(input: any) {
  const title = String(input?.title || "").trim().slice(0, 180);
  const handle = slugify(input?.handle || title);
  const body = sanitizeBody(input?.body);
  const images = cleanImages(input?.images);
  const types = cleanList(input?.types, 20);
  const rawPrices = input?.typePrices && typeof input.typePrices === "object" ? input.typePrices : {};
  const typePrices: Record<string, number> = {};
  for (const type of types) {
    const price = Math.round(Number(rawPrices[type]));
    if (!Number.isFinite(price) || price < 1 || price > 1_000_000) throw new Error(`Enter a valid price for ${type}`);
    typePrices[type] = price;
  }
  const prices = Object.values(typePrices);
  const colors = cleanList(input?.colors, 30);
  const sizes = cleanList(input?.sizes, 30);
  const sortOrder = Math.max(-10_000, Math.min(10_000, Math.round(Number(input?.sortOrder) || 0)));
  const isActive = input?.isActive !== false;

  if (!title) throw new Error("Product title is required");
  if (!handle) throw new Error("Product handle is required");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) throw new Error("Product handle can only contain lowercase letters, numbers and hyphens");
  if (!types.length) throw new Error("Add at least one clothing type and price");

  return {
    handle, title, body, images, types, typePrices, colors, sizes,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    isActive, sortOrder,
  };
}

async function insertProduct(product: ReturnType<typeof normalizeProduct>, id = uid("prd")) {
  const sql = db();
  const images = JSON.stringify(product.images);
  const types = JSON.stringify(product.types);
  const typePrices = JSON.stringify(product.typePrices);
  const colors = JSON.stringify(product.colors);
  const sizes = JSON.stringify(product.sizes);
  const rows = await sql`
    INSERT INTO "Product" (
      "id","handle","title","body","images","types","typePrices","colors","sizes",
      "minPrice","maxPrice","isActive","sortOrder","createdAt","updatedAt"
    ) VALUES (
      ${id}, ${product.handle}, ${product.title}, ${product.body}, ${images}::jsonb, ${types}::jsonb,
      ${typePrices}::jsonb, ${colors}::jsonb, ${sizes}::jsonb, ${product.minPrice}, ${product.maxPrice},
      ${product.isActive}, ${product.sortOrder}, now(), now()
    )
    ON CONFLICT ("handle") DO NOTHING
    RETURNING *
  `;
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export async function ensureCatalogSeeded() {
  const sql = db();
  const counts = await sql`SELECT COUNT(*)::int AS count FROM "Product"`;
  if (Number(counts[0]?.count || 0) > 0) return;

  const response = await fetch("https://www.petrocrib.in/products.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not import the existing Petrocrib catalogue");
  const existing = await response.json();
  if (!Array.isArray(existing) || !existing.length) throw new Error("Existing Petrocrib catalogue is empty");

  for (let i = 0; i < existing.length; i++) {
    const normalized = normalizeProduct({ ...existing[i], isActive: true, sortOrder: i });
    await insertProduct(normalized);
  }
}

export async function listAdminProducts() {
  await ensureCatalogSeeded();
  const sql = db();
  const rows = await sql`SELECT * FROM "Product" ORDER BY "isActive" DESC, "sortOrder" ASC, "title" ASC`;
  return rows.map(rowToProduct);
}

export async function listStoreProducts() {
  await ensureCatalogSeeded();
  const sql = db();
  const rows = await sql`
    SELECT * FROM "Product"
    WHERE "isActive" = true
    ORDER BY "sortOrder" ASC, "title" ASC
  `;
  return rows.map(rowToProduct).map(({ id, isActive, sortOrder, createdAt, updatedAt, ...product }) => product);
}

export async function createProduct(input: any) {
  const product = normalizeProduct(input);
  const created = await insertProduct(product);
  if (!created) throw new Error("A product with this handle already exists");
  return created;
}

export async function updateProduct(id: string, input: any) {
  const product = normalizeProduct(input);
  const sql = db();
  const images = JSON.stringify(product.images);
  const types = JSON.stringify(product.types);
  const typePrices = JSON.stringify(product.typePrices);
  const colors = JSON.stringify(product.colors);
  const sizes = JSON.stringify(product.sizes);
  const rows = await sql`
    UPDATE "Product" SET
      "handle"=${product.handle}, "title"=${product.title}, "body"=${product.body},
      "images"=${images}::jsonb, "types"=${types}::jsonb, "typePrices"=${typePrices}::jsonb,
      "colors"=${colors}::jsonb, "sizes"=${sizes}::jsonb,
      "minPrice"=${product.minPrice}, "maxPrice"=${product.maxPrice},
      "isActive"=${product.isActive}, "sortOrder"=${product.sortOrder}, "updatedAt"=now()
    WHERE "id"=${id}
    RETURNING *
  `;
  if (!rows[0]) throw new Error("Product not found");
  return rowToProduct(rows[0]);
}

export async function archiveProduct(id: string) {
  const sql = db();
  const rows = await sql`
    UPDATE "Product" SET "isActive"=false, "updatedAt"=now()
    WHERE "id"=${id}
    RETURNING *
  `;
  if (!rows[0]) throw new Error("Product not found");
  return rowToProduct(rows[0]);
}
