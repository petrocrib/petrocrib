/* PETROCRIB cart image resolver — use the trusted product catalogue for cart thumbnails. */
(function () {
  if (typeof PRODUCTS === "undefined" || !Array.isArray(PRODUCTS)) return;

  function productForRow(row) {
    const link = row.querySelector(".cp-thumb");
    const img = row.querySelector(".cp-thumb img");
    if (!img) return null;

    const href = link ? (link.getAttribute("href") || "") : "";
    const match = href.match(/[?&]handle=([^&]+)/);
    const handle = match ? decodeURIComponent(match[1]) : "";
    if (handle) {
      const byHandle = PRODUCTS.find((p) => p.handle === handle);
      if (byHandle) return byHandle;
    }

    const title = (img.getAttribute("alt") || "").trim().toLowerCase();
    return PRODUCTS.find((p) => String(p.title || "").trim().toLowerCase() === title) || null;
  }

  function fixCartImages() {
    document.querySelectorAll(".cp-item").forEach((row) => {
      const img = row.querySelector(".cp-thumb img");
      if (!img) return;
      const product = productForRow(row);
      const src = product && Array.isArray(product.images) ? product.images[0] : "";
      if (src && /^https:\/\/cdn\.shopify\.com\//i.test(src)) {
        img.src = src;
      }
    });
  }

  const items = document.getElementById("cpItems");
  if (items) {
    new MutationObserver(fixCartImages).observe(items, { childList: true, subtree: true });
  }
  fixCartImages();
})();
