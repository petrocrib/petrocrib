import { sendNotification } from "web-push";
import { db } from "@/lib/db";

export function pushConfig() {
  const publicKey = process.env.ADMIN_PUSH_PUBLIC_KEY;
  const privateKey = process.env.ADMIN_PUSH_PRIVATE_KEY;
  const subject = process.env.ADMIN_PUSH_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function isChromeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.origin === "https://fcm.googleapis.com" && !url.username && !url.password &&
      /^\/(?:fcm\/send|wp)\/[A-Za-z0-9:_-]+$/.test(url.pathname) && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export async function sendAdminPush(endpoint: string, orderId?: string) {
  const config = pushConfig();
  if (!config || !isChromeEndpoint(endpoint)) return false;

  const sql = db();
  const [row] = await sql`SELECT "endpoint","p256dh","auth","updatedAt"
    FROM "AdminPushSubscription" WHERE "endpoint"=${endpoint}`;
  if (!row) return false;

  try {
    await sendNotification(
      { endpoint, keys: { p256dh: String(row.p256dh), auth: String(row.auth) } },
      JSON.stringify({ orderId }),
      { vapidDetails: config, TTL: 300, timeout: 4000 }
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await sql`DELETE FROM "AdminPushSubscription"
        WHERE "endpoint"=${endpoint} AND "p256dh"=${row.p256dh} AND "auth"=${row.auth} AND "updatedAt"=${row.updatedAt}`;
    }
    console.error("Admin push delivery failed", status ?? "transport error");
    return false;
  }
}

export async function notifyAdminOfPaidOrder(orderId: string) {
  if (!pushConfig()) return;
  try {
    const sql = db();
    const rows = await sql`SELECT "endpoint" FROM "AdminPushSubscription"`;
    const results = await Promise.allSettled(rows.map(row => sendAdminPush(String(row.endpoint), orderId)));
    if (results.some(result => result.status === "rejected")) console.error("Admin push subscription lookup failed");
  } catch {
    console.error("Could not load admin push subscriptions");
  }
}
