#!/usr/bin/env python3
"""
IMPORTANT — RUN THIS ONCE BEFORE YOUR SHOPIFY STORE CLOSES.

Your product photos currently live on Shopify's CDN
(cdn.shopify.com). When your Shopify store is closed, those
image links will stop working and your site will lose all photos.

This script:
  1. Downloads every product image into the local  images/  folder
  2. Rewrites products.json to point at the local copies

How to run (needs Python 3, no extra installs):
    python3 download_images.py        (Mac/Linux)
    py download_images.py             (Windows)

Then commit/upload the whole folder (including images/) to GitHub.
"""

import json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "products.json")
IMGDIR = os.path.join(HERE, "images")
os.makedirs(IMGDIR, exist_ok=True)

with open(DATA, encoding="utf-8") as f:
    products = json.load(f)

def ext_of(url):
    m = re.search(r"\.(png|jpe?g|webp|gif)", url.lower())
    return "." + (m.group(1) if m else "png")

total = sum(len(p["images"]) for p in products)
done = 0
failed = []

for p in products:
    new_srcs = []
    for i, url in enumerate(p["images"], start=1):
        if not url.startswith("http"):
            new_srcs.append(url)  # already local
            done += 1
            continue
        fname = f"{p['handle']}-{i}{ext_of(url)}"
        dest = os.path.join(IMGDIR, fname)
        rel = f"images/{fname}"
        if not os.path.exists(dest):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as out:
                    out.write(r.read())
                print(f"[{done+1}/{total}] downloaded {fname}")
            except Exception as e:
                print(f"[{done+1}/{total}] FAILED {url} -> {e}")
                failed.append(url)
                new_srcs.append(url)  # keep CDN url as fallback
                done += 1
                continue
        new_srcs.append(rel)
        done += 1
    p["images"] = new_srcs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(products, f, indent=1, ensure_ascii=False)

# also regenerate products.js (the file the website actually loads)
with open(os.path.join(HERE, "products.js"), "w", encoding="utf-8") as f:
    f.write("/* Auto-generated product data */\nconst PRODUCTS = ")
    json.dump(products, f, indent=1, ensure_ascii=False)
    f.write(";\n")

print()
if failed:
    print(f"Done with {len(failed)} failures — re-run the script to retry them.")
    sys.exit(1)
print("All images downloaded and products.json updated. You can now upload everything to GitHub.")
