/* ============================================================
   PETROCRIB STORE CONFIG — EDIT THIS FILE
   ============================================================
   HOW PAYMENTS WORK (no server needed on GitHub Pages):

   1. Log in to https://dashboard.razorpay.com
   2. Go to  Payment Pages  →  Create Payment Page
      (or Payment Links for a quicker setup)
   3. Create ONE page/link per price point below.
      On each Payment Page, add these input fields so you know
      what to ship:  "Product name", "Size", "Color", plus the
      built-in Name / Phone / Address fields.
   4. Copy each page/link URL and paste it below.

   Price points in your catalog:
     ₹500  → Regular Tee (most products)
     ₹700  → Yeezus Regular Tee
     ₹800  → Oversized Tee
     ₹1000 → Hoodie / Yeezus Oversized
     ₹1300 → Yeezus Hoodie
   ============================================================ */

const STORE_CONFIG = {
  // CART CHECKOUT (recommended): paste your Cloudflare Worker URL here,
  // e.g. "https://petrocrib-pay.yourname.workers.dev"
  // When set, the site uses a real cart + Razorpay popup.
  // When empty, it falls back to the razorpayLinks below.
  WORKER_URL: "https://petrocrib-pay.petrocrib.workers.dev/",

  storeName: "PETROCRIB",

  // Paste your Razorpay Payment Page / Payment Link URLs here:
  razorpayLinks: {
    500:  "",   // e.g. "https://pages.razorpay.com/petrocrib-500"
    700:  "",
    800:  "",
    1000: "",
    1300: "",
  },

  // Fallback if a Razorpay link above is empty:
  // customers can order via WhatsApp instead. Use country code,
  // digits only. Example: "919876543210". Leave "" to disable.
  whatsappNumber: "",

  // Contact details shown in footer & policies (fill these in!)
  instagram: "petrocrib_",
  email: "petrocrib@gmail.com",
  phone: "",            // e.g. "+91 98765 43210"
  address: "",          // e.g. "Kochi, Kerala, India"
};
