// Only used in CALL_MODE=dial. Twilio calls this when ringing the owner ends.
import { readTwilioRequest, twiml, VoiceResponse, forbidden } from '@/lib/twilio';
import { handleMissedCall, recordAnsweredCall } from '@/lib/textback';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const FALLBACK_VOICE = "Sorry we couldn't get to the phone right now. Please try us again a little later. Goodbye.";

export async function POST(request) {
  const params = await readTwilioRequest(request);
  if (!params) return forbidden();

  const response = new VoiceResponse();

  if (params.DialCallStatus === 'completed') {
    await recordAnsweredCall({ callSid: params.CallSid, caller: params.From });
    response.hangup();
    return twiml(response.toString());
  }

  // no-answer, busy, failed or canceled: text them back.
  const result = await handleMissedCall({ callSid: params.CallSid, caller: params.From });
  const settings = await getSettings();
  response.say({ voice: 'Polly.Joanna' }, result.texted ? settings.voice_message : FALLBACK_VOICE);
  response.hangup();
  return twiml(response.toString());
}
