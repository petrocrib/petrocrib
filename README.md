# PETROCRIB — static store

Your Shopify store rebuilt as a free static website: 19 products, variant picker (type / color / size), Razorpay-ready checkout. Hosted free on GitHub Pages.

## 1. Save your images first (important!)

Product photos still point to Shopify's CDN. **Once your Shopify store closes, those links die.** Before that happens, run this once on your computer (needs Python 3, nothing else):

```
python3 download_images.py
```

It downloads all 95 photos into `images/` and updates `products.json` to use them.

## 2. Set up payments (Razorpay)

GitHub Pages can't run server code, so use **Razorpay Payment Pages** (free, no code):

1. Log in at dashboard.razorpay.com → **Payment Pages** → Create
2. Create one page per price: ₹500, ₹700, ₹800, ₹1000, ₹1300
3. On each page add input fields: **Product name, Size, Color** (plus name/phone/address)
4. Open `config.js` and paste each page URL next to its price

When a customer taps **Buy now**, their selection ("Rizz Khan | Oversized Tee | Black | Size L") is copied to their clipboard and the Razorpay page opens — they paste it in the product field and pay.

Optional: put your WhatsApp number in `config.js` as a fallback ordering method.

## 3. Put it on GitHub Pages (free hosting)

1. Create an account at github.com if you don't have one
2. Click **+** (top right) → **New repository** → name it `petrocrib` → Create
3. On the repo page click **uploading an existing file**, drag **all files and folders** from this folder in, and click **Commit changes**
   - If the `images/` folder is too big for one upload, upload it in batches
4. Go to **Settings → Pages** → under "Branch" choose `main` and `/ (root)` → **Save**
5. Wait ~2 minutes. Your store is live at:
   `https://YOUR-USERNAME.github.io/petrocrib/`

### Custom domain (optional)
If you own a domain (e.g. petrocrib.in), in **Settings → Pages** add it under Custom domain, then at your domain provider create a CNAME record pointing to `YOUR-USERNAME.github.io`.

## Editing later

- **Prices / products**: edit `products.json`
- **Payment links / WhatsApp**: edit `config.js`
- **Colors / fonts / styling**: edit `assets/css/style.css`

Every time you edit a file on GitHub (pencil icon → commit), the live site updates in ~1 minute.
