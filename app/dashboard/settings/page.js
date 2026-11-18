import { getSettings } from '@/lib/settings';
import { twilioConfigured } from '@/lib/twilio';
import { formatPhone } from '@/lib/phone';
import { renderTemplate, baseUrl } from '@/lib/textback';
import { saveSettingsAction, testMissedCallAction } from '../actions';

export const dynamic = 'force-dynamic';

const ERRORS = {
  owner: 'The owner phone number does not look right. Use a 10-digit number.',
  link: 'The booking link must start with https://',
  test: 'Enter a valid 10-digit phone number for the test.',
};

function previewText(s) {
  return renderTemplate(s, s.intake_enabled === 'on' ? `${baseUrl()}/enquiry/your-private-link` : s.booking_url ? `${baseUrl()}/r/ab12Cd3` : null);
}

export default async function SettingsPage({ searchParams }) {
  const s = await getSettings();
  const { saved, error, test } = await searchParams;
  const mode = (process.env.CALL_MODE || 'forward').toLowerCase();

  return (
    <main>
      <h1>Settings</h1>
      <p className="sub">
        Call mode: <strong>{mode === 'dial' ? 'Twilio rings the owner first' : 'Carrier forwards unanswered calls'}</strong>
        {process.env.TWILIO_PHONE_NUMBER && <> · Twilio number {formatPhone(process.env.TWILIO_PHONE_NUMBER)}</>}
      </p>

      {saved && <div className="notice">Settings saved.</div>}
      {error && <div className="notice bad">{ERRORS[error] || 'Something went wrong.'}</div>}
      {test === 'sent' && (
        <div className="notice">
          Test ran. {twilioConfigured() ? 'Check that phone for the text.' : 'Test mode: see it on the Overview page.'}
        </div>
      )}
      {test && test !== 'sent' && <div className="notice bad">Test did not send a text: {test}</div>}

      <form action={saveSettingsAction} className="stack card pad">
        <div className="row">
          <label>
            Business name
            <input type="text" name="business_name" defaultValue={s.business_name} required />
          </label>
          <label>
            Owner&apos;s cell
            <span className="hint">Gets an alert for every missed call and reply.</span>
            <input type="tel" name="owner_phone" defaultValue={s.owner_phone} placeholder="780 555 0123" />
          </label>
        </div>

        <label className="check"><input type="checkbox" name="intake_enabled" defaultChecked={s.intake_enabled==='on'} /> Send the project enquiry form in missed-call texts</label>
        <p className="muted">With this enabled, {'{link}'} opens the private enquiry form. Review and confirm bookings in Enquiries & quotes. If you use an older custom message, update its wording to invite project details.</p>
        <label>
          Booking link
          <span className="hint">Used when the enquiry form is turned off. A click is not a confirmed booking.</span>
          <input type="url" name="booking_url" defaultValue={s.booking_url} placeholder="https://..." />
        </label>

        <label>
          Text message
          <span className="hint">
            Use {'{business}'} for the business name and {'{link}'} for the enquiry form (or booking link when the form is off).
          </span>
          <textarea name="message_template" defaultValue={s.message_template} maxLength={600} required />
        </label>

        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>What customers will see (last saved version):</div>
          <div className="preview">{previewText(s)}</div>
        </div>

        <label>
          What callers hear before hanging up
          <textarea name="voice_message" defaultValue={s.voice_message} maxLength={400} style={{ minHeight: 70 }} />
        </label>

        <div className="row">
          <label>
            Don&apos;t re-text the same caller within (hours)
            <input type="number" name="cooldown_hours" min="0" max="720" defaultValue={s.cooldown_hours} />
          </label>
          {mode === 'dial' && (
            <label>
              Ring the owner for (seconds)
              <input type="number" name="ring_seconds" min="5" max="60" defaultValue={s.ring_seconds} />
            </label>
          )}
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
          <input type="checkbox" name="owner_alerts" defaultChecked={s.owner_alerts === 'on'} />
          Text the owner about missed calls and replies
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
          <input type="checkbox" name="enabled" defaultChecked={s.enabled === 'on'} />
          Auto-text is on
        </label>

        <button className="btn" type="submit">Save settings</button>
      </form>

      <h2>Send a test</h2>
      <form action={testMissedCallAction} className="stack card pad">
        <label>
          Pretend this number just called and was missed
          <span className="hint">
            {twilioConfigured()
              ? 'This sends a real text, so use your own phone.'
              : 'Test mode: nothing is sent, the result appears on Overview.'}
          </span>
          <input type="tel" name="test_phone" placeholder="780 555 0199" required />
        </label>
        <button className="btn secondary" type="submit">Run test</button>
      </form>
    </main>
  );
}
