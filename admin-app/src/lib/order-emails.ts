import { Resend } from "resend";

type OrderEmailItem = {
  title: string;
  variant?: string | null;
  image?: string | null;
  unitPrice: number | string;
  quantity: number | string;
};

type OrderEmailDetails = {
  id: string;
  reference: string;
  total: number | string;
  customerName?: string | null;
  customerEmail?: string | null;
  items: OrderEmailItem[];
};

type ShippedEmailDetails = OrderEmailDetails & {
  courier?: string | null;
  trackingNumber?: string | null;
};

const YELLOW = "#fcd019";
const BLACK = "#080808";
const INK = "#171717";
const MUTED = "#686868";
const LOGO_URL = "https://www.petrocrib.in/assets/img/logo.png";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeImageUrl(value?: string | null): string {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "";
}

function formatCurrency(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function emailShell(title: string, content: string, accent = YELLOW): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="x-apple-disable-message-reformatting">' +
    '<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Bayon&display=swap" rel="stylesheet">' +
    "<title>" + escapeHtml(title) + "</title>" +
    '<style>body,table,td,p,a{font-family:Bayon,Arial,Helvetica,sans-serif}h1,h2,.pc-display{font-family:Bungee,Impact,Arial,sans-serif}@media screen and (max-width:620px){.pc-wrap{padding:12px 8px!important}.pc-card{width:100%!important}.pc-pad{padding-left:19px!important;padding-right:19px!important}.pc-product-img{width:64px!important;height:64px!important}}</style>' +
    "</head><body style=\"margin:0;padding:0;background:#f0eee7;color:" + INK + ";font-family:Bayon,Arial,Helvetica,sans-serif\">" +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0eee7" style="width:100%;background:#f0eee7">' +
    '<tr><td class="pc-wrap" align="center" style="padding:34px 14px">' +
    '<table class="pc-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden">' +
    '<tr><td height="7" bgcolor="' + accent + '" style="height:7px;background:' + accent + ';font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td class="pc-pad" bgcolor="' + BLACK + '" style="padding:24px 30px;background:' + BLACK + '">' +
    '<a href="https://www.petrocrib.in" style="display:inline-block;text-decoration:none"><img src="' + LOGO_URL + '" width="164" alt="Petrocrib" style="display:block;width:164px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none"></a>' +
    '</td></tr>' +
    '<tr><td class="pc-pad" style="padding:32px 30px 29px;background:#ffffff">' + content + "</td></tr>" +
    '<tr><td class="pc-pad" bgcolor="' + BLACK + '" style="padding:21px 30px;background:' + BLACK + ';border-top:5px solid ' + accent + '">' +
    '<div style="font-family:Bungee,Impact,Arial,sans-serif;font-size:12px;line-height:1.5;color:#ffffff">GOOD TASTE. GREAT CHOICE.</div>' +
    '<div style="margin-top:7px;font-family:Bayon,Arial,sans-serif;font-size:14px;line-height:1.6;color:#d0d0d0">Need a hand? Just reply to this email or write to petrocrib@gmail.com.</div>' +
    '<div style="margin-top:11px;font-family:Bungee,Impact,Arial,sans-serif;font-size:10px;letter-spacing:1px;color:' + accent + '">PETROCRIB.IN</div>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

function orderReferenceHtml(reference: string, accent = YELLOW): string {
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;border-collapse:separate;border-spacing:0">' +
    '<tr><td bgcolor="#f7f5ed" style="padding:15px 17px;border-left:5px solid ' + accent + ';border-radius:5px">' +
    '<div style="font-family:Bayon,Arial,sans-serif;font-size:12px;line-height:1.3;color:' + MUTED + ';letter-spacing:1px">YOUR ORDER REFERENCE</div>' +
    '<div style="margin-top:5px;font-family:Bungee,Impact,Arial,sans-serif;font-size:18px;line-height:1.5;color:' + BLACK + '">' + escapeHtml(reference) + '</div>' +
    '</td></tr></table>'
  );
}

function orderItemsHtml(items: OrderEmailItem[], total: number | string, accent = YELLOW): string {
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const title = escapeHtml(item.title || "Item");
    const variant = item.variant
      ? '<div style="margin-top:3px;font-family:Bayon,Arial,sans-serif;color:#777777;font-size:13px;line-height:1.35">' + escapeHtml(item.variant) + "</div>"
      : "";
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const image = safeImageUrl(item.image);
    const imageCell = image
      ? '<img class="pc-product-img" src="' + image + '" width="76" height="76" alt="' + title + '" style="display:block;width:76px;height:76px;object-fit:cover;border-radius:7px;border:1px solid #ece9df">'
      : '<div class="pc-product-img" style="width:76px;height:76px;border-radius:7px;background:#f2f0e8;text-align:center;line-height:76px;color:#888888;font-size:11px">PETROCRIB</div>';
    return (
      '<tr><td width="92" valign="middle" style="width:92px;padding:13px 8px;border-bottom:1px solid #ece9df">' + imageCell + "</td>" +
      '<td valign="middle" style="padding:13px 8px;border-bottom:1px solid #ece9df;color:' + INK + ';font-family:Bayon,Arial,sans-serif;font-size:15px;line-height:1.4">' +
      '<div style="font-weight:700">' + title + "</div>" + variant +
      '<div style="margin-top:5px;color:#777777;font-size:12px">Qty: ' + quantity + "</div></td>" +
      '<td width="100" align="right" valign="middle" style="width:100px;padding:13px 8px;border-bottom:1px solid #ece9df;color:' + INK + ';font-family:Bayon,Arial,sans-serif;font-size:15px;font-weight:700">' +
      formatCurrency(unitPrice * quantity) + "</td></tr>"
    );
  }).join("");

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:25px 0 20px;border-collapse:collapse">' +
    '<tr><td colspan="3" bgcolor="' + BLACK + '" style="padding:12px 13px;background:' + BLACK + ';color:' + accent + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:11px;letter-spacing:.5px">THE GOOD STUFF IN YOUR ORDER</td></tr>' +
    (rows || '<tr><td colspan="3" style="padding:15px 9px;color:#777777;font-size:13px">Order items unavailable</td></tr>') +
    '<tr bgcolor="#fff9df"><td colspan="2" style="padding:15px 10px;border-top:2px solid ' + accent + ';color:' + INK + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:11px">ORDER TOTAL</td>' +
    '<td align="right" style="padding:15px 10px;border-top:2px solid ' + accent + ';color:' + INK + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:14px">' + formatCurrency(total) + "</td></tr>" +
    "</table>"
  );
}

function orderItemsText(items: OrderEmailItem[]): string {
  const lines = (Array.isArray(items) ? items : []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const variant = item.variant ? " (" + item.variant + ")" : "";
    return "- " + item.title + variant + " x " + quantity + " — " + formatCurrency(unitPrice * quantity);
  });
  return lines.length ? lines.join("\n") : "- Order items unavailable";
}

async function deliverEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  idempotencyKey?: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!from) throw new Error("FROM_EMAIL is not configured");
  if (!to.trim()) throw new Error("Customer email address is missing");

  const resend = new Resend(apiKey);
  const payload = {
    from,
    to: to.trim(),
    replyTo: process.env.REPLY_TO_EMAIL || undefined,
    subject,
    html,
    text,
  };
  const result = idempotencyKey
    ? await resend.emails.send(payload, { idempotencyKey })
    : await resend.emails.send(payload);

  if (result.error) throw new Error("Resend delivery failed: " + result.error.message);
  console.info("Resend accepted transactional email", { emailId: result.data?.id, subject });
}

export async function sendOrderProcessingEmail(order: OrderEmailDetails, idempotencyKey?: string): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const subject = "PETROCRIB | Order confirmed " + reference;
  const content =
    '<div style="display:inline-block;padding:7px 12px;background:' + YELLOW + ';color:' + BLACK + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:10px;line-height:1.3">PAYMENT CONFIRMED ✓</div>' +
    '<img src="https://petrocrib-admin.vercel.app/api/email-heading?type=confirmed" width="540" height="74" alt="GOOD TASTE. GREAT CHOICE." style="display:block;width:100%;max-width:540px;height:auto;margin:20px 0 12px;border:0;outline:none;text-decoration:none">' +
    '<p style="margin:0;color:#555555;font-family:Bayon,Arial,sans-serif;font-size:17px;line-height:1.55">Hey ' + escapeHtml(customerName) +
    ', your payment is in and your Petrocrib order is officially on the list. We’re getting your picks ready!</p>' +
    orderReferenceHtml(reference) +
    orderItemsHtml(order.items, order.total) +
    '<p style="margin:20px 0 0;padding:14px 16px;background:#f5f3eb;border-radius:6px;color:#555555;font-family:Bayon,Arial,sans-serif;font-size:15px;line-height:1.55">We’ll drop you another email when your order ships. Until then, consider your wardrobe upgraded.</p>';
  const text =
    "PETROCRIB — PAYMENT CONFIRMED\n\nGood taste. Great choice.\n\nHey " + customerName +
    ", your payment is in and order " + reference + " is confirmed. We’re getting your picks ready!\n\nItems:\n" +
    orderItemsText(order.items) + "\n\nOrder total: " + formatCurrency(order.total) +
    "\n\nWe’ll email you when your order ships.\nPETROCRIB.IN";

  await deliverEmail(order.customerEmail || "", subject, emailShell(subject, content), text, idempotencyKey);
}

export async function sendOrderShippedEmail(order: ShippedEmailDetails): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const courier = order.courier || "Not provided";
  const trackingNumber = order.trackingNumber || "Not provided";
  const subject = "PETROCRIB | Your order is on its way " + reference;
  const content =
    '<div style="display:inline-block;padding:7px 12px;background:' + BLACK + ';color:' + YELLOW + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:10px;line-height:1.3">ORDER SHIPPED ↗</div>' +
    '<img src="https://petrocrib-admin.vercel.app/api/email-heading?type=shipped" width="540" height="74" alt="YOUR PETROCRIB PICK IS ON ITS WAY." style="display:block;width:100%;max-width:540px;height:auto;margin:20px 0 12px;border:0;outline:none;text-decoration:none">' +
    '<p style="margin:0;color:#555555;font-family:Bayon,Arial,sans-serif;font-size:17px;line-height:1.55">Hey ' + escapeHtml(customerName) +
    ', your order has left us. Keep an eye out — good things are headed your way!</p>' +
    orderReferenceHtml(reference, BLACK) +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;border-collapse:collapse">' +
    '<tr><td bgcolor="' + BLACK + '" style="padding:12px 13px;background:' + BLACK + ';color:' + YELLOW + ';font-family:Bungee,Impact,Arial,sans-serif;font-size:11px">DELIVERY TRACKING</td></tr>' +
    '<tr><td style="padding:15px;border:1px solid #e8e5da;border-top:0">' +
    '<div style="font-family:Bayon,Arial,sans-serif;font-size:12px;color:#777777">COURIER</div>' +
    '<div style="margin:3px 0 13px;font-family:Bayon,Arial,sans-serif;font-size:17px;color:' + INK + '">' + escapeHtml(courier) + "</div>" +
    '<div style="font-family:Bayon,Arial,sans-serif;font-size:12px;color:#777777">TRACKING / AWB NUMBER</div>' +
    '<div style="margin-top:3px;font-family:Bungee,Impact,Arial,sans-serif;font-size:16px;line-height:1.5;color:' + INK + ';overflow-wrap:anywhere">' + escapeHtml(trackingNumber) + "</div>" +
    "</td></tr></table>" +
    orderItemsHtml(order.items, order.total, BLACK) +
    '<p style="margin:20px 0 0;padding:14px 16px;background:#f5f3eb;border-radius:6px;color:#555555;font-family:Bayon,Arial,sans-serif;font-size:15px;line-height:1.55">Your tracking number is ready. Now the fun part: waiting for the doorbell.</p>';
  const text =
    "PETROCRIB — ORDER SHIPPED\n\nYour Petrocrib pick is on its way!\n\nHey " + customerName +
    ", your order " + reference + " has shipped.\nCourier: " + courier + "\nTracking / AWB number: " + trackingNumber +
    "\n\nItems:\n" + orderItemsText(order.items) + "\n\nOrder total: " + formatCurrency(order.total) + "\nPETROCRIB.IN";

  await deliverEmail(order.customerEmail || "", subject, emailShell(subject, content, BLACK), text);
}
