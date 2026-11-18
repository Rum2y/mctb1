// Pretends to be Twilio so you can test without a real phone call.
// Start the app with `npm run dev`, then in another terminal run:
//
//   npm run simulate -- call  7805550199        (a missed call from that number)
//   npm run simulate -- text  7805550199 "Do you have time Saturday?"
//
// Only works when Twilio signature checks are off (no Twilio credentials in
// .env.local, or TWILIO_VALIDATE_SIGNATURE=false).

const base = process.env.SIM_BASE_URL || 'http://localhost:3000';
const [, , kind, number, ...rest] = process.argv;

function e164(n) {
  const d = String(n || '').replace(/\D/g, '');
  return d.length === 10 ? `+1${d}` : `+${d}`;
}

async function post(path, params) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  console.log(`${res.status} ${path}\n${await res.text()}\n`);
}

if (!number || !['call', 'text'].includes(kind)) {
  console.log('Usage: npm run simulate -- call <number>   |   npm run simulate -- text <number> "message"');
  process.exit(1);
}

const from = e164(number);
const to = process.env.TWILIO_PHONE_NUMBER || '+15875550100';

if (kind === 'call') {
  await post('/api/twilio/voice', {
    CallSid: `CAsim${Date.now()}`,
    From: from,
    To: to,
    CallStatus: 'ringing',
    Direction: 'inbound',
  });
} else {
  await post('/api/twilio/sms', {
    MessageSid: `SMsim${Date.now()}`,
    From: from,
    To: to,
    Body: rest.join(' ') || 'Hi, saw your text. Can I book for Saturday?',
  });
}
