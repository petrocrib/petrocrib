# PETROCRIB — static store

Your Shopify store rebuilt as a free static website: 19 products, variant picker (type / color / size), Razorpay-ready checkout.

> Production storefront deployment is now managed through Vercel from the `main` branch. The existing payment backend remains unchanged during the hosting migration.

## 1. Save your images first (important!)

Product photos still point to Shopify's CDN. **Once your Shopify store closes, those links die.** Before that happens, run this once on your computer (needs Python 3, nothing else):

```
python3 download_images.py
```

It downloads all 95 photos into `images/` and updates `products.json` to use them.

## 2. Set up payments (Razorpay)

The current storefront uses the existing Razorpay-compatible checkout backend configured in `config.js`.

Optional: put your WhatsApp number in `config.js` as a fallback ordering method.

## 3. Hosting

The production storefront is deployed to Vercel from the repository root. Vercel runs the root `npm run build` command and publishes the generated `dist/` directory.

## Editing later

- **Prices / products**: edit `products.json`
- **Payment links / WhatsApp**: edit `config.js`
- **Colors / fonts / styling**: edit `assets/css/style.css`

Every commit to `main` can trigger a new production deployment in Vercel.
