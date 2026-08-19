export type Attribution = {
  source: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

function clean(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined;
}

export function classifySource(input: Record<string, unknown>): Attribution {
  const referrer = clean(input.referrer);
  const utmSource = clean(input.utmSource)?.toLowerCase();
  const utmMedium = clean(input.utmMedium);
  const utmCampaign = clean(input.utmCampaign);
  const utmContent = clean(input.utmContent);
  const utmTerm = clean(input.utmTerm);

  const raw = (utmSource || "").replace(/[^a-z0-9._-]/g, "");
  let source = "direct";

  if (raw) {
    if (raw.includes("instagram") || raw === "ig") source = "instagram";
    else if (raw.includes("facebook") || raw === "fb" || raw.includes("meta")) source = "facebook";
    else if (raw.includes("google")) source = "google";
    else if (raw.includes("youtube")) source = "youtube";
    else if (raw.includes("whatsapp") || raw === "wa") source = "whatsapp";
    else source = raw;
  } else if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
      if (host.includes("google.")) source = "google";
      else if (host === "instagram.com" || host.endsWith(".instagram.com")) source = "instagram";
      else if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com") source = "facebook";
      else if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") source = "youtube";
      else if (host === "whatsapp.com" || host.endsWith(".whatsapp.com") || host === "wa.me") source = "whatsapp";
      else if (host === "petrocrib.in" || host.endsWith(".petrocrib.in")) source = "direct";
      else source = "referral";
    } catch {
      source = "referral";
    }
  }

  return { source, referrer, utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
}
