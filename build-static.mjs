import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const out = "dist";
const SITE_URL = "https://petrocrib.in";
const BRAND = "Petrocrib";

const rootFiles = [
  "index.html",
  "product.html",
  "cart.html",
  "contact.html",
  "policies.html",
  "config.js",
  "products.js",
  "products.json",
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of rootFiles) {
  await cp(file, path.join(out, file));
}
await cp("assets", path.join(out, "assets"), { recursive: true });

// Keep the deployed copy accurate after the hosting move.
const policyPath = path.join(out, "policies.html");
let policy = await readFile(policyPath, "utf8");
policy = policy.replace(
  "This website is hosted on GitHub Pages and our administration/backend services may be hosted by cloud service providers;",
  "This website is hosted on Vercel and our administration/backend services may be hosted by cloud service providers;"
);
await writeFile(policyPath, policy);

// The source currently references this optional file, but it is not present in the repo.
const indexPath = path.join(out, "index.html");
let index = await readFile(indexPath, "utf8");
index = index.replace('<script src="assets/js/bee3d.js"></script>', "");
await writeFile(indexPath, index);

// --- Generate Google Merchant Center XML Feed (dist/feed.xml) ---
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";
}

function normalizeTypeCode(type) {
  const t = type.toLowerCase();
  if (t.includes("oversized")) return "OVS";
  if (t.includes("hoodie")) return "HD";
  return "REG";
}

const rawProducts = await readFile("products.json", "utf8");
const products = JSON.parse(rawProducts);

const xmlItems = [];

for (const product of products) {
  const cleanDescription =
    stripHtml(product.body) ||
    `${product.title} - Official Petrocrib 100% Cotton Malayalam Pop-Culture Apparel.`;
  const mainImage = product.images?.[0] || "";
  const additionalImages = (product.images || []).slice(1, 10);

  for (const type of product.types || []) {
    const price = product.typePrices?.[type] ?? product.minPrice;
    if (!price || !mainImage) continue;

    const isHoodie = type.toLowerCase().includes("hoodie");
    const googleCategory = isHoodie
      ? "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets"
      : "Apparel & Accessories > Clothing > Shirts & Tops";

    // Group variants by design + garment fit (Regular vs Oversized vs Hoodie)
    const groupId = `${product.handle}-${normalizeTypeCode(type)}`.toUpperCase();

    for (const color of product.colors || []) {
      const colorLabel = capitalize(color);

      for (const size of product.sizes || []) {
        const sku = `${groupId}-${color.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`;
        const variantTitle = `${product.title} - ${type} (${colorLabel}, ${size})`;
        // Matches standard product.html?handle=... routing; adjust if your product.html uses ?id=
        const productUrl = `${SITE_URL}/product.html?handle=${encodeURIComponent(product.handle)}`;

        const extraImgTags = additionalImages
          .map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
          .join("\n");

        xmlItems.push(`    <item>
      <g:id>${escapeXml(sku)}</g:id>
      <g:item_group_id>${escapeXml(groupId)}</g:item_group_id>
      <title>${escapeXml(variantTitle)}</title>
      <description>${escapeXml(cleanDescription.slice(0, 4900))}</description>
      <link>${escapeXml(productUrl)}</link>
      <g:image_link>${escapeXml(mainImage)}</g:image_link>
${extraImgTags}
      <g:availability>in_stock</g:availability>
      <g:price>${Number(price).toFixed(2)} INR</g:price>
      <g:brand>${escapeXml(BRAND)}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>false</g:identifier_exists>
      <g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>
      <g:color>${escapeXml(colorLabel)}</g:color>
      <g:size>${escapeXml(size.toUpperCase())}</g:size>
      <g:gender>unisex</g:gender>
      <g:age_group>adult</g:age_group>
    </item>`);
      }
    }
  }
}

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Petrocrib Storefront</title>
    <link>${SITE_URL}</link>
    <description>Official Petrocrib Product Feed</description>
${xmlItems.join("\n")}
  </channel>
</rss>
`;

await writeFile(path.join(out, "feed.xml"), feedXml, "utf8");
console.log(`PETROCRIB storefront prepared in dist/ (${xmlItems.length} product variants in feed.xml)`);
