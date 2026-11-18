import { query } from "./db.js";

// Every setting has a default (from .env), and can be overridden in the
// dashboard's Settings page. Overrides are stored in the `settings` table.

export const DEFAULT_TEMPLATE =
  "Hi, this is {business}. Sorry we missed your call! " +
  "Tell us about your enquiry here: {link} or just reply to this text and we'll get right back to you.";

export const DEFAULT_TEMPLATE_NO_LINK =
  "Hi, this is {business}. Sorry we missed your call! " +
  "Reply to this text with what you need and we'll get right back to you.";

function defaults() {
  return {
    business_name: process.env.BUSINESS_NAME || "our team",
    owner_phone: process.env.OWNER_PHONE || "",
    booking_url: process.env.BOOKING_URL || "",
    message_template: process.env.MESSAGE_TEMPLATE || DEFAULT_TEMPLATE,
    voice_message:
      process.env.VOICE_MESSAGE ||
      "Hi, this is {business}. Sorry we couldn't get to the phone. We're sending you a text right now so you can reach us. Thank you for your patience.",
    cooldown_hours: process.env.COOLDOWN_HOURS || "12",
    ring_seconds: process.env.RING_SECONDS || "20",
    owner_alerts: process.env.OWNER_ALERTS || "on",
    enabled: "on",
    intake_enabled: "on",
  };
}

export const SETTING_KEYS = Object.keys(defaults());

export async function getSettings() {
  const rows = await query("SELECT key, value FROM settings");
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...defaults(), ...saved };
}

export async function saveSettings(values) {
  for (const key of SETTING_KEYS) {
    if (!(key in values)) continue;
    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, String(values[key] ?? "")],
    );
  }
}
