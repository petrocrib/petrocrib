/* ============================================================
   PETROCRIB STORE CONFIG
   ============================================================ */

const STORE_CONFIG = {
  // Analytics/admin backend.
  BACKEND_URL: "https://petrocrib-admin.vercel.app",

  // Direct payment backend. Razorpay order creation and verification now run
  // in the Vercel backend; the legacy Cloudflare Worker is no longer in the
  // storefront payment path.
  WORKER_URL: "https://petrocrib-admin.vercel.app/api/store",

  storeName: "PETROCRIB",

  razorpayLinks: {
    500:  "",
    700:  "",
    800:  "",
    1000: "",
    1300: "",
  },

  whatsappNumber: "",

  instagram: "petrocrib_",
  email: "petrocrib@gmail.com",
  phone: "",
  address: "",
};
