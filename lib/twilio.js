import twilio from 'twilio';

export function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

let client;
function getClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

// Sends a text. Without Twilio credentials it runs in dry-run mode:
// nothing is sent, and the message is marked 'simulated' in the dashboard.
export async function sendSms(to, body) {
  if (!twilioConfigured()) {
    console.log(`[dry run] SMS to ${to}: ${body}`);
    return { status: 'simulated', sid: null, error: null };
  }
  try {
    const msg = await getClient().messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body,
    });
    return { status: 'sent', sid: msg.sid, error: null };
  } catch (err) {
    console.error('SMS failed:', err?.message);
    return { status: 'failed', sid: null, error: err?.message || 'Unknown error' };
  }
}

// Reads a Twilio webhook (form-encoded POST) and checks it really came from
// Twilio, using the X-Twilio-Signature header. Returns the params, or null
// if the signature is invalid.
export async function readTwilioRequest(request) {
  const form = await request.formData();
  const params = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const mustValidate =
    process.env.TWILIO_VALIDATE_SIGNATURE !== 'false' && twilioConfigured();
  if (!mustValidate) return params;

  const signature = request.headers.get('x-twilio-signature') || '';
  const { pathname, search } = new URL(request.url);
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const url = `${base}${pathname}${search}`;
  const ok = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, params);
  if (!ok && process.env.NODE_ENV !== 'production') {
    // Never log credentials, signatures, query values, or caller details.
    const validationUrl = new URL(url);
    console.warn('[twilio] Webhook rejected:', {
      reason: signature ? 'signature_mismatch' : 'missing_signature',
      validationUrl: `${validationUrl.origin}${validationUrl.pathname}`,
      hasQuery: Boolean(search),
      accountSidMatches: params.AccountSid
        ? params.AccountSid === process.env.TWILIO_ACCOUNT_SID
        : null,
    });
  }
  return ok ? params : null;
}

export function twiml(xml) {
  return new Response(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export const VoiceResponse = twilio.twiml.VoiceResponse;
export const MessagingResponse = twilio.twiml.MessagingResponse;

export function forbidden() {
  return new Response('Invalid Twilio signature', { status: 403 });
}
