# PETROCRIB Admin + Backend

This Next.js app is intentionally isolated inside `admin-app/` so the existing GitHub Pages storefront at `petrocrib.in` can continue running unchanged while the backend is tested.

## Vercel setup

Import the existing `petrocrib/petrocrib` repository as a new Vercel project and set the project **Root Directory** to:

`admin-app`

Suggested project name: `petrocrib-admin`.

## Required environment variables

- `DATABASE_URL` — Petrocrib Neon PostgreSQL pooled connection string
- `ADMIN_PASSWORD` — password used to enter the admin dashboard
- `ADMIN_SESSION_SECRET` — long random secret used to sign the admin session cookie
- `RAZORPAY_KEY_ID` — Razorpay key ID
- `RAZORPAY_KEY_SECRET` — Razorpay key secret

Keep all of these values secret in Vercel. Do not commit real credentials to GitHub.

## Rollout sequence

1. Deploy `admin-app` to Vercel and verify `/admin`.
2. Put the Vercel URL into `STORE_CONFIG.BACKEND_URL` in the static storefront. This enables first-party analytics only.
3. Confirm visitor, source, product-view and live-cart data appears in the dashboard.
4. Test the new `/api/store/create-order` and `/api/store/verify` payment backend with Razorpay test/live credentials.
5. Only after payment tests pass, change `STORE_CONFIG.WORKER_URL` from the existing Cloudflare Worker to `<BACKEND_URL>/api/store`.

This staged rollout prevents the working checkout from being replaced before the new backend is verified.

## Acquisition analytics

The tracker records both first-touch and latest-touch acquisition context. Sources are normalized into Direct, Google, Instagram, Facebook, YouTube, WhatsApp and Other Referral where possible. UTM source, medium, campaign, content and term values are retained for campaign reporting.

Git-connected deployments should use the repository `main` branch with `admin-app` as the Vercel Root Directory.
