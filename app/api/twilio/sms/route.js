// Twilio calls this when someone texts the Twilio number.
// Set it in the Twilio console: Phone Numbers > your number > "A message comes in" > Webhook (POST).
import { readTwilioRequest, twiml, MessagingResponse, forbidden } from '@/lib/twilio';
import { handleInboundSms } from '@/lib/textback';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const params = await readTwilioRequest(request);
  if (!params) return forbidden();

  const { reply } = await handleInboundSms({ from: params.From, body: params.Body });
  const response = new MessagingResponse();
  if (reply) response.message(reply);
  return twiml(response.toString());
}
