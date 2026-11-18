import { randomBytes } from 'node:crypto';
import { query, one } from './db.js';
import { getSettings, DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_NO_LINK } from './settings.js';
import { normalizePhone, formatPhone } from './phone.js';
import { sendSms, twilioConfigured } from './twilio.js';
import { ensureEnquiry, markAwaiting } from './enquiries.js';

const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'arret'];
const START_WORDS = ['start', 'unstop', 'yes'];

export function baseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function logMessage({ phone, direction, kind, body, result }) {
  await query(
    `INSERT INTO messages (phone, direction, kind, body, twilio_sid, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [phone, direction, kind, body, result?.sid ?? null, result?.status ?? 'received', result?.error ?? null]
  );
}

async function recordCall(callSid, caller, status, extra = {}) {
  const rows = await query(
    `INSERT INTO calls (call_sid, caller, status, texted, skipped_reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (call_sid) DO NOTHING
     RETURNING id`,
    [callSid, caller, status, extra.texted ?? false, extra.skippedReason ?? null]
  );
  return rows[0]?.id ?? null; // null means Twilio retried a call we already handled
}

export function renderTemplate(settings, link) {
  let template = settings.message_template || DEFAULT_TEMPLATE;
  if (!link) {
    template = template === DEFAULT_TEMPLATE ? DEFAULT_TEMPLATE_NO_LINK : template;
  }
  return template
    .replaceAll('{business}', settings.business_name)
    .replaceAll('{link}', link || '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function recordAnsweredCall({ callSid, caller }) {
  const phone = normalizePhone(caller) || String(caller || 'unknown');
  await recordCall(callSid, phone, 'answered');
}

// The heart of the app: a call went unanswered, so text the caller back.
export async function handleMissedCall({ callSid, caller }) {
  const settings = await getSettings();
  const phone = normalizePhone(caller);
  const sid = callSid || `local-${Date.now()}`;

  const skip = async (reason, recorded = phone || String(caller || 'unknown')) => {
    await recordCall(sid, recorded, 'missed', { skippedReason: reason });
    return { texted: false, reason };
  };

  if (!phone) return skip('Blocked or unknown number');
  if (settings.enabled !== 'on') return skip('Auto-text is paused');

  const owner = normalizePhone(settings.owner_phone);
  const ownNumber = normalizePhone(process.env.TWILIO_PHONE_NUMBER);
  if (phone === owner || phone === ownNumber) return skip('Call from the business itself');

  await query(
    `INSERT INTO contacts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING`,
    [phone]
  );
  const contact = await one('SELECT * FROM contacts WHERE phone = $1', [phone]);
  if (contact.opted_out) return skip('Caller opted out of texts');

  const callId = await recordCall(sid, phone, 'missed');
  if (callId === null) return { texted: false, reason: 'Duplicate webhook' };
  const enquiry = await ensureEnquiry(callId, phone, !twilioConfigured() || /^(test-|local-|sim-|CAsim)/.test(sid));

  const cooldownHours = Number(settings.cooldown_hours) || 0;
  if (contact.last_texted_at && cooldownHours > 0) {
    const hoursSince = (Date.now() - new Date(contact.last_texted_at).getTime()) / 36e5;
    if (hoursSince < cooldownHours) {
      const reason = `Already texted in the last ${cooldownHours}h`;
      await query('UPDATE calls SET skipped_reason=$1 WHERE id=$2', [reason,callId]);
      return { texted:false, reason };
    }
  }

  // A tracked link lets the dashboard show who actually clicked to book.
  let link = `${baseUrl()}/enquiry/${enquiry.token}`;
  if (settings.intake_enabled !== 'on' && settings.booking_url) {
    const token = randomBytes(5).toString('base64url');
    await query('INSERT INTO links (token, phone, call_id) VALUES ($1, $2, $3)', [token, phone, callId]);
    link = `${baseUrl()}/r/${token}`;
  }

  if (settings.intake_enabled !== 'on' && !settings.booking_url) link = null;
  const body = renderTemplate(settings, link);
  const result = await sendSms(phone, body);
  await logMessage({ phone, direction: 'out', kind: 'auto', body, result });

  if (result.status !== 'failed') {
    await query('UPDATE contacts SET last_texted_at = now() WHERE phone = $1', [phone]);
    await query('UPDATE calls SET texted = true WHERE id = $1', [callId]);
  } else {
    await query('UPDATE calls SET skipped_reason = $1 WHERE id = $2', [`Text failed: ${result.error}`, callId]);
  }

  if (owner && settings.owner_alerts === 'on') {
    const alert =
      result.status === 'failed'
        ? `Missed call from ${formatPhone(phone)}. The auto-text FAILED, so please call them back.`
        : `Missed call from ${formatPhone(phone)}. We texted them back automatically.`;
    const alertResult = await sendSms(owner, alert);
    await logMessage({ phone, direction: 'out', kind: 'owner_alert', body: alert, result: alertResult });
  }

  return { texted: result.status !== 'failed', status: result.status };
}

// A text arrived at the Twilio number.
export async function handleInboundSms({ from, body }) {
  const settings = await getSettings();
  const phone = normalizePhone(from);
  if (!phone) return { reply: null };

  const owner = normalizePhone(settings.owner_phone);
  if (phone === owner) {
    return {
      reply: `To reply to a customer, open your dashboard: ${baseUrl()}/dashboard (or call them directly).`,
    };
  }

  const text = String(body || '').trim();
  await query(`INSERT INTO contacts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING`, [phone]);
  await logMessage({ phone, direction: 'in', kind: 'reply', body: text || '(empty message)', result: null });

  const word = text.toLowerCase();
  if (STOP_WORDS.includes(word)) {
    // Twilio also blocks further texts to this number automatically.
    await query('UPDATE contacts SET opted_out = true WHERE phone = $1', [phone]);
    return { reply: null };
  }
  await markAwaiting(phone, true);
  if (START_WORDS.includes(word)) {
    await query('UPDATE contacts SET opted_out = false WHERE phone = $1', [phone]);
  }

  if (owner && settings.owner_alerts === 'on') {
    const preview = text.length > 300 ? `${text.slice(0, 300)}...` : text;
    const alert = `New text from ${formatPhone(phone)}: "${preview}" (reply from your dashboard or call them)`;
    const alertResult = await sendSms(owner, alert);
    await logMessage({ phone, direction: 'out', kind: 'owner_alert', body: alert, result: alertResult });
  }
  return { reply: null };
}

// The owner replies to a customer from the dashboard.
export async function sendManualReply(phone, body) {
  const to = normalizePhone(phone);
  const text = String(body || '').trim();
  if (!to || !text) return { ok: false, error: 'Missing number or message' };

  const contact = await one('SELECT opted_out FROM contacts WHERE phone = $1', [to]);
  if (contact?.opted_out) return { ok: false, error: 'This customer replied STOP and has opted out of texts.' };

  const result = await sendSms(to, text);
  await logMessage({ phone: to, direction: 'out', kind: 'manual', body: text, result });
  if (result.status !== 'failed') await markAwaiting(to, false);
  return result.status === 'failed' ? { ok: false, error: result.error } : { ok: true };
}

export async function recordLinkClick(token) {
  const link = await one('SELECT * FROM links WHERE token = $1', [token]);
  if (!link) return null;
  await query('INSERT INTO link_clicks (token, phone) VALUES ($1, $2)', [token, link.phone]);
  return link;
}
