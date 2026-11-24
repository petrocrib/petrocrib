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
    '<body style="margin:0;padding:32px 12px;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#152238">' +
    '<div style="max-width:600px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px">' +
    '<div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#142b4a;margin-bottom:28px">PETROCRIB</div>' +
    content +
    '<p style="margin:28px 0 0;color:#718096;font-size:12px;line-height:1.6">Thank you for shopping with PETROCRIB.</p>' +
    "</div></body></html>"
  );
}

function orderItemsHtml(items: OrderEmailItem[], total: number | string): string {
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const title = escapeHtml(item.title || "Item");
    const variant = item.variant
      ? '<div style="margin-top:4px;color:#718096;font-size:12px">' + escapeHtml(item.variant) + "</div>"
      : "";
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return (
      '<tr><td style="padding:12px 8px;border-bottom:1px solid #e8edf3">' + title + variant + "</td>" +
      '<td style="padding:12px 8px;border-bottom:1px solid #e8edf3;text-align:center">' + quantity + "</td>" +
      '<td style="padding:12px 8px;border-bottom:1px solid #e8edf3;text-align:right">' +
      formatCurrency(unitPrice * quantity) + "</td></tr>"
    );
  }).join("");

  return (
    '<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">' +
    '<thead><tr style="color:#718096;font-size:12px;text-align:left">' +
    '<th style="padding:8px">ITEM</th><th style="padding:8px;text-align:center">QTY</th>' +
    '<th style="padding:8px;text-align:right">AMOUNT</th></tr></thead>' +
    "<tbody>" + (rows || '<tr><td colspan="3" style="padding:12px 8px;color:#718096">Order items unavailable</td></tr>') +
    '<tr><td colspan="2" style="padding:14px 8px;font-weight:700">Order total</td>' +
    '<td style="padding:14px 8px;text-align:right;font-weight:700">' + formatCurrency(total) + "</td></tr>" +
    "</tbody></table>"
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

async function deliverEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!from) throw new Error("FROM_EMAIL is not configured");
  if (!to.trim()) throw new Error("Customer email address is missing");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: to.trim(),
    replyTo: process.env.REPLY_TO_EMAIL || undefined,
    subject,
    html,
    text,
  });

  if (error) throw new Error("Resend delivery failed: " + error.message);
}

export async function sendOrderProcessingEmail(order: OrderEmailDetails): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const subject = "Order " + reference + " received — now processing";
  const content =
    '<h1 style="margin:0 0 12px;font-size:25px;color:#152238">We have received your order</h1>' +
    '<p style="margin:0 0 18px;color:#526176;line-height:1.6">Hi ' + escapeHtml(customerName) +
    ", your payment is confirmed and your order is now being processed.</p>" +
    '<div style="padding:14px 16px;background:#f3f6fa;border-radius:8px">' +
    '<div style="font-size:12px;color:#718096">ORDER REFERENCE</div>' +
    '<div style="margin-top:5px;font-size:18px;font-weight:700">' + escapeHtml(reference) + "</div></div>" +
    orderItemsHtml(order.items, order.total) +
    '<p style="color:#526176;line-height:1.6">We will send you another email when your order has been shipped.</p>';
  const text =
    "Hi " + customerName + ",\n\nYour payment is confirmed and order " + reference +
    " is now being processed.\n\nItems:\n" + orderItemsText(order.items) +
    "\n\nOrder total: " + formatCurrency(order.total) +
    "\n\nWe will email you when your order has shipped.\nPETROCRIB";

  await deliverEmail(order.customerEmail || "", subject, emailShell(subject, content), text);
}

export async function sendOrderShippedEmail(order: ShippedEmailDetails): Promise<void> {
  const reference = order.reference || order.id;
  const customerName = order.customerName || "there";
  const courier = order.courier || "Not provided";
  const trackingNumber = order.trackingNumber || "Not provided";
  const subject = "Order " + reference + " has shipped";
  const content =
    '<h1 style="margin:0 0 12px;font-size:25px;color:#152238">Your order is on its way</h1>' +
    '<p style="margin:0 0 18px;color:#526176;line-height:1.6">Hi ' + escapeHtml(customerName) +
    ", your PETROCRIB order has been shipped.</p>" +
    '<div style="padding:16px;background:#f3f6fa;border-radius:8px;line-height:1.8">' +
    '<div><span style="color:#718096">ORDER REFERENCE</span><br><strong>' + escapeHtml(reference) + "</strong></div>" +
    '<div style="margin-top:12px"><span style="color:#718096">COURIER</span><br><strong>' + escapeHtml(courier) + "</strong></div>" +
    '<div style="margin-top:12px"><span style="color:#718096">TRACKING NUMBER</span><br><strong>' + escapeHtml(trackingNumber) + "</strong></div>" +
    "</div>" +
    '<p style="margin-top:20px;color:#526176;line-height:1.6">Keep your tracking number handy for delivery updates.</p>' +
    orderItemsHtml(order.items, order.total);
  const text =
    "Hi " + customerName + ",\n\nYour PETROCRIB order " + reference + " has shipped." +
    "\nCourier: " + courier + "\nTracking number: " + trackingNumber +
    "\n\nItems:\n" + orderItemsText(order.items) +
    "\n\nOrder total: " + formatCurrency(order.total) + "\nPETROCRIB";

  await deliverEmail(order.customerEmail || "", subject, emailShell(subject, content), text);
}
