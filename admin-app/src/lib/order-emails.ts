import { Resend } from "resend";

type OrderEmailItem = {
  title: string;
  variant?: string | null;
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] || character)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function emailShell(title: string, content: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + escapeHtml(title) + "</title></head>" +
    '<body style="margin:0;padding:0;background:#f1f0e9;font-family:Arial,Helvetica,sans-serif;color:#171717">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f0e9" style="width:100%;background:#f1f0e9">' +
    '<tr><td align="center" style="padding:30px 12px">' +
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;border-collapse:separate;border-spacing:0">' +
    '<tr><td height="6" bgcolor="#f4c928" style="height:6px;background:#f4c928;font-size:0;line-height:0">&nbsp;</td></tr>' +
    '<tr><td bgcolor="#111111" style="padding:24px 28px;background:#111111">' +
    '<div style="font-size:25px;line-height:1;font-weight:900;letter-spacing:1px;color:#ffffff">PETRO<span style="color:#f4c928">CRIB</span></div>' +
    '<div style="margin-top:7px;font-size:9px;line-height:1.2;font-weight:700;letter-spacing:3px;color:#d0d0d0">OFFICIAL STORE</div>' +
    '</td></tr>' +
    '<tr><td style="padding:30px 28px 26px;background:#ffffff">' + content + "</td></tr>" +
    '<tr><td bgcolor="#111111" style="padding:20px 28px;background:#111111;border-top:4px solid #f4c928">' +
    '<div style="font-size:11px;line-height:1.6;color:#ffffff;font-weight:700">THANK YOU FOR SHOPPING WITH PETROCRIB</div>' +
    '<div style="margin-top:5px;font-size:10px;line-height:1.6;color:#bdbdbd">For order support, reply to this email or contact petrocrib@gmail.com.</div>' +
    '<div style="margin-top:12px;font-size:10px;line-height:1.5;color:#f4c928">PETROCRIB.IN</div>' +
    '</td></tr></table></td></tr></table></body></html>'
  );
}

function orderItemsHtml(items: OrderEmailItem[], total: number | string): string {
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const title = escapeHtml(item.title || "Item");
    const variant = item.variant
      ? '<div style="margin-top:4px;color:#777777;font-size:11px;line-height:1.4">' + escapeHtml(item.variant) + "</div>"
      : "";
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return (
      '<tr><td style="padding:13px 9px;border-bottom:1px solid #ecebe5;color:#222222;font-size:12px;line-height:1.4">' + title + variant + "</td>" +
      '<td align="center" style="padding:13px 7px;border-bottom:1px solid #ecebe5;color:#555555;font-size:12px">' + quantity + "</td>" +
      '<td align="right" style="padding:13px 9px;border-bottom:1px solid #ecebe5;color:#222222;font-size:12px;font-weight:700">' +
      formatCurrency(unitPrice * quantity) + "</td></tr>"
    );
  }).join("");

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:23px 0 20px;border-collapse:collapse">' +
    '<tr><td colspan="3" bgcolor="#111111" style="padding:11px 10px;background:#111111;color:#f4c928;font-size:10px;font-weight:800;letter-spacing:1.5px">ORDER DETAILS</td></tr>' +
    '<tr bgcolor="#f5f4ef"><th align="left" style="padding:9px;font-size:9px;letter-spacing:1px;color:#666666">ITEM</th>' +
    '<th align="center" style="padding:9px;font-size:9px;letter-spacing:1px;color:#666666">QTY</th>' +
    '<th align="right" style="padding:9px;font-size:9px;letter-spacing:1px;color:#666666">AMOUNT</th></tr>' +
    (rows || '<tr><td colspan="3" style="padding:13px 9px;color:#777777;font-size:12px">Order items unavailable</td></tr>') +
    '<tr bgcolor="#fff8d9"><td colspan="2" style="padding:15px 9px;border-top:2px solid #f4c928;color:#171717;font-size:12px;font-weight:800">ORDER TOTAL</td>' +
    '<td align="right" style="padding:15px 9px;border-top:2px solid #f4c928;color:#171717;font-size:14px;font-weight:900">' + formatCurrency(total) + "</td></tr>" +
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

export async function sendOrderProcessingEmail(
  order: OrderEmailDetails,
  idempotencyKey?: string
): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const subject = "PETROCRIB | Order confirmed " + reference;
  const content =
    '<div style="margin-bottom:17px"><span style="display:inline-block;padding:7px 11px;background:#f4c928;color:#111111;font-size:9px;line-height:1;font-weight:900;letter-spacing:1.2px">PAYMENT CONFIRMED</span></div>' +
    '<h1 style="margin:0 0 12px;color:#111111;font-size:27px;line-height:1.2;font-weight:900">Your order is confirmed.</h1>' +
    '<div style="width:46px;height:4px;background:#f4c928;margin:0 0 18px"></div>' +
    '<p style="margin:0 0 18px;color:#555555;font-size:14px;line-height:1.7">Hey ' + escapeHtml(customerName) +
    ', we have received your payment. Your PETROCRIB order is confirmed and is now being prepared.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border-collapse:collapse">' +
    '<tr><td width="5" bgcolor="#f4c928" style="width:5px;background:#f4c928;font-size:0">&nbsp;</td>' +
    '<td bgcolor="#fff8d9" style="padding:14px 16px;background:#fff8d9">' +
    '<div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:#77631a">ORDER REFERENCE</div>' +
    '<div style="margin-top:6px;color:#111111;font-size:19px;font-weight:900">' + escapeHtml(reference) + "</div>" +
    "</td></tr></table>" +
    orderItemsHtml(order.items, order.total) +
    '<p style="margin:20px 0 0;padding:14px 15px;background:#f5f4ef;border-left:3px solid #111111;color:#555555;font-size:12px;line-height:1.6">We will email you again as soon as your order is shipped, with courier and tracking details.</p>';
  const text =
    "PETROCRIB — PAYMENT CONFIRMED\n\nHi " + customerName +
    ", your payment has been received and order " + reference +
    " is confirmed and being prepared.\n\nItems:\n" + orderItemsText(order.items) +
    "\n\nOrder total: " + formatCurrency(order.total) +
    "\n\nWe will email you again when your order ships.\nPETROCRIB.IN";

  await deliverEmail(
    order.customerEmail || "",
    subject,
    emailShell(subject, content),
    text,
    idempotencyKey
  );
}

export async function sendOrderShippedEmail(order: ShippedEmailDetails): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const courier = order.courier || "Not provided";
  const trackingNumber = order.trackingNumber || "Not provided";
  const subject = "PETROCRIB | Order shipped " + reference;
  const content =
    '<div style="margin-bottom:17px"><span style="display:inline-block;padding:7px 11px;background:#f4c928;color:#111111;font-size:9px;line-height:1;font-weight:900;letter-spacing:1.2px">ORDER SHIPPED</span></div>' +
    '<h1 style="margin:0 0 12px;color:#111111;font-size:27px;line-height:1.2;font-weight:900">It is on its way.</h1>' +
    '<div style="width:46px;height:4px;background:#f4c928;margin:0 0 18px"></div>' +
    '<p style="margin:0 0 18px;color:#555555;font-size:14px;line-height:1.7">Hey ' + escapeHtml(customerName) +
    ', your PETROCRIB order has left us and is on its way to you.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border-collapse:collapse">' +
    '<tr><td width="5" bgcolor="#f4c928" style="width:5px;background:#f4c928;font-size:0">&nbsp;</td>' +
    '<td bgcolor="#fff8d9" style="padding:14px 16px;background:#fff8d9">' +
    '<div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:#77631a">ORDER REFERENCE</div>' +
    '<div style="margin-top:6px;color:#111111;font-size:19px;font-weight:900">' + escapeHtml(reference) + "</div>" +
    "</td></tr></table>" +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border-collapse:collapse">' +
    '<tr><td bgcolor="#111111" style="padding:11px 13px;background:#111111;color:#f4c928;font-size:10px;font-weight:800;letter-spacing:1.2px">DELIVERY INFORMATION</td></tr>' +
    '<tr><td style="padding:14px 15px;border:1px solid #e8e6dc;border-top:0">' +
    '<div style="font-size:9px;color:#777777;font-weight:800;letter-spacing:1px">COURIER</div>' +
    '<div style="margin:5px 0 14px;color:#111111;font-size:14px;font-weight:800">' + escapeHtml(courier) + "</div>" +
    '<div style="font-size:9px;color:#777777;font-weight:800;letter-spacing:1px">TRACKING / AWB NUMBER</div>' +
    '<div style="margin-top:5px;color:#111111;font-size:16px;font-weight:900;overflow-wrap:anywhere">' + escapeHtml(trackingNumber) + "</div>" +
    "</td></tr></table>" +
    orderItemsHtml(order.items, order.total) +
    '<p style="margin:20px 0 0;color:#555555;font-size:12px;line-height:1.6">Keep your tracking number handy for delivery updates. Thank you for being part of PETROCRIB.</p>';
  const text =
    "PETROCRIB — ORDER SHIPPED\n\nHi " + customerName + ", your order " + reference +
    " has shipped.\nCourier: " + courier + "\nTracking / AWB number: " + trackingNumber +
    "\n\nItems:\n" + orderItemsText(order.items) +
    "\n\nOrder total: " + formatCurrency(order.total) + "\nPETROCRIB.IN";

  await deliverEmail(order.customerEmail || "", subject, emailShell(subject, content), text);
}
