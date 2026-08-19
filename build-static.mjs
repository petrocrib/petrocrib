import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const out = "dist";
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

console.log("PETROCRIB storefront prepared in dist/");
