import { listStoreProducts } from "./products";

type Product = {
  handle: string;
  title: string;
  images?: string[];
  types: string[];
  typePrices: Record<string, number>;
  colors?: string[];
  sizes?: string[];
};

export async function validateCart(raw: any[]) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) throw new Error("Invalid cart");
  const catalogue = await listStoreProducts() as Product[];
  const result = [] as any[];

  for (const input of raw) {
    const title = String(input?.title || "").trim();
    const variant = String(input?.variant || "").trim();
    const qty = Math.min(10, Math.max(1, Math.round(Number(input?.qty) || 1)));
    const p = catalogue.find(x => x.title === title);
    if (!p) throw new Error(`Unknown product: ${title}`);
    const parts = variant.split("/").map((x: string) => x.trim());
    const type = parts[0] || p.types[0];
    const color = parts[1] || "";
    const size = parts[2] || "";
    if (!p.types.includes(type) || typeof p.typePrices[type] !== "number") throw new Error(`Invalid variant: ${title}`);
    if (color && p.colors?.length && !p.colors.map(c => c.toLowerCase()).includes(color.toLowerCase())) throw new Error(`Invalid color: ${title}`);
    if (size && p.sizes?.length && !p.sizes.includes(size)) throw new Error(`Invalid size: ${title}`);
    result.push({
      productId: p.handle,
      title: p.title,
      variant,
      color,
      size,
      type,
      unitPrice: Math.round(p.typePrices[type]),
      quantity: qty,
      image: p.images?.[0] || ""
    });
  }
  return result;
}
