import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export function uid(prefix = "pc") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}
