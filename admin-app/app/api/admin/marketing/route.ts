import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isAdmin } from "@/lib/auth";
import { db, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] || c));
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    const [audience, campaigns] = await Promise.all([
      sql`SELECT COUNT(*)::int AS "eligibleCount" FROM "Customer" WHERE "marketingConsent"=true AND "marketingUnsubscribedAt" IS NULL AND "email" IS NOT NULL AND "email" <> ''`,
      sql`SELECT * FROM "MarketingCampaign" ORDER BY "createdAt" DESC LIMIT 50`
    ]);
    return NextResponse.json({ eligibleCount: Number((audience[0] as any)?.eligibleCount || 0), campaigns });
  } catch (error) {
    console.error("marketing overview", error);
    return NextResponse.json({ error: "Marketing data unavailable. Apply the customer-retention migration first." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 180) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 12000) : "";
    if (subject.length < 3 || message.length < 5) return NextResponse.json({ error: "Add a subject and message before sending." }, { status: 400 });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL;
    if (!apiKey || !from) return NextResponse.json({ error: "Resend is not configured." }, { status: 503 });

    const sql = db();
    const recipients = await sql`
      SELECT "id","email","name","marketingUnsubscribeToken" FROM "Customer"
      WHERE "marketingConsent"=true AND "marketingUnsubscribedAt" IS NULL AND "email" IS NOT NULL AND "email" <> ''
      ORDER BY "createdAt" ASC
    `;
    if (!recipients.length) return NextResponse.json({ error: "No customers have opted in to promotional emails." }, { status: 400 });

    const resend = new Resend(apiKey);
    const origin = (process.env.NEXT_PUBLIC_ADMIN_URL || "https://petrocrib-admin.vercel.app").replace(/\/$/, "");
    const content = escapeHtml(message).replace(/\n/g, "<br>");
    let sentCount = 0, failedCount = 0;
    for (const row of recipients as any[]) {
      const unsubscribe = origin + "/api/marketing/unsubscribe?token=" + encodeURIComponent(String(row.marketingUnsubscribeToken || ""));
      const html = `<!doctype html><html><body style="margin:0;background:#f5f5f2;font-family:Arial,sans-serif;color:#111"><div style="max-width:620px;margin:28px auto;background:#080808;color:#fff;border-radius:16px;overflow:hidden"><div style="padding:24px;text-align:center;border-bottom:1px solid #333"><img src="https://www.petrocrib.in/assets/img/logo.png" alt="Petrocrib" style="max-width:180px;height:auto"></div><div style="padding:30px 26px"><p style="color:#fcd019;text-transform:uppercase;letter-spacing:2px;font-size:12px">A little something from Petrocrib</p><h1 style="font-size:24px;color:#fcd019">Hey ${escapeHtml(String(row.name || "there"))}!</h1><div style="font-size:16px;line-height:1.7;color:#eee">${content}</div><p style="margin-top:28px;color:#fcd019;font-weight:bold">Stay iconic. Stay cribbed.</p></div><div style="padding:18px 26px;background:#151515;color:#aaa;font-size:11px;line-height:1.6">You are receiving this because you opted in to Petrocrib promotional emails. <a href="${unsubscribe}" style="color:#fcd019">Unsubscribe</a>.</div></div></body></html>`;
      try {
        const result = await resend.emails.send({ from, to: String(row.email), subject, html, headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
        if ((result as any).error) failedCount++; else sentCount++;
      } catch { failedCount++; }
    }
    const campaignId = uid("cmp");
    await sql`INSERT INTO "MarketingCampaign" ("id","subject","bodyHtml","sentCount","failedCount") VALUES (${campaignId},${subject},${content},${sentCount},${failedCount})`;
    return NextResponse.json({ ok: true, campaignId, sentCount, failedCount });
  } catch (error) {
    console.error("marketing send", error);
    return NextResponse.json({ error: "Could not send campaign." }, { status: 500 });
  }
}
