// Twilio calls this when a phone call reaches the Twilio number.
// Set it in the Twilio console: Phone Numbers > your number > "A call comes in" > Webhook (POST).
import { readTwilioRequest, twiml, VoiceResponse, forbidden } from '@/lib/twilio';
import { handleMissedCall, baseUrl } from '@/lib/textback';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const FALLBACK_VOICE = "Sorry we couldn't get to the phone right now. Please try us again a little later. Goodbye.";

export async function POST(request) {
  const params = await readTwilioRequest(request);
  if (!params) return forbidden();

  const settings = await getSettings();
  const response = new VoiceResponse();
  const mode = (process.env.CALL_MODE || 'forward').toLowerCase();
  const owner = normalizePhone(settings.owner_phone);

  if (mode === 'dial' && owner) {
    // Twilio is the public number: ring the owner first. If they don't pick up,
    // Twilio calls /api/twilio/dial-status and we text the caller there.
    const dial = response.dial({
      timeout: Number(settings.ring_seconds) || 20,
      answerOnBridge: true,
      callerId: params.From,
      action: `${baseUrl()}/api/twilio/dial-status`,
      method: 'POST',
    });
    dial.number(owner);
    return twiml(response.toString());
  }

  // Forward mode: the business's own phone already rang and wasn't answered,
  // so reaching this number means the call was missed.
  const result = await handleMissedCall({ callSid: params.CallSid, caller: params.From });
  response.say({ voice: 'Polly.Joanna' }, result.texted ? settings.voice_message : FALLBACK_VOICE);
  response.hangup();
  return twiml(response.toString());
}
