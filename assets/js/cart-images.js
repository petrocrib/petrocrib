/* PETROCRIB cart image resolver — use the live trusted product catalogue for thumbnails. */
(function () {
  let cataloguePromise = null;

  function trusted(src) {
    try {
      const u = new URL(String(src || ""), location.origin);
      const host = u.hostname.toLowerCase();
      if (u.origin === location.origin && u.pathname.startsWith("/assets/")) return u.href;
      if (u.protocol !== "https:") return "";
      if (host === "cdn.shopify.com" || host === "petrocrib.in" || host === "www.petrocrib.in" || host.endsWith(".public.blob.vercel-storage.com")) return u.href;
    } catch (e) {}
    return "";
  }

  async function catalogue() {
    if (cataloguePromise) return cataloguePromise;
    cataloguePromise = (async () => {
      try {
        const base = (typeof STORE_CONFIG !== "undefined" && STORE_CONFIG.BACKEND_URL) ? STORE_CONFIG.BACKEND_URL.replace(/\/$/, "") : "";
        if (base) {
          const r = await fetch(base + "/api/store/products", { cache: "no-store" });
          if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data.products)) return data.products;
          }
        }
      } catch (e) {}
      return typeof PRODUCTS !== "undefined" && Array.isArray(PRODUCTS) ? PRODUCTS : [];
    })();
    return cataloguePromise;
  }

  function handleForRow(row) {
    const link = row.querySelector(".cp-thumb");
    const href = link ? (link.getAttribute("href") || "") : "";
    const match = href.match(/[?&]handle=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function fixCartImages() {
    const products = await catalogue();
    document.querySelectorAll(".cp-item").forEach((row) => {
      const img = row.querySelector(".cp-thumb img");
      if (!img) return;
      const handle = handleForRow(row);
      const title = (img.getAttribute("alt") || "").trim().toLowerCase();
      const product = products.find((p) => p.handle === handle) || products.find((p) => String(p.title || "").trim().toLowerCase() === title);
      const src = trusted(product && Array.isArray(product.images) ? product.images[0] : "");
      if (src) img.src = src;
    });
  }

  const items = document.getElementById("cpItems");
  if (items) new MutationObserver(() => fixCartImages()).observe(items, { childList: true, subtree: true });
  fixCartImages();
})();
