# Enquiry & Quote Follow-up — added workflow

This update extends the existing missed-call app. It remains one business per deployment.

## What is new

1. An eligible missed call creates an enquiry and the automatic text includes its private project form link (enabled by default).
2. The customer supplies their name, job type, area, preferred callback time, optional description and up to 3 project photos.
3. **Enquiries & quotes** lists active enquiries, those awaiting an owner response, due quotes, confirmed bookings and test enquiries.
4. The owner records a stage: New enquiry → Contacted → Quote to prepare → Quote sent → Booking confirmed (or Closed).
5. Choosing **Quote to prepare** requires a promised date. A reminder appears on Overview and the enquiry queue when that date arrives or is overdue, in `APP_TIMEZONE` (default America/Edmonton).
6. Booking confirmed requires an agreed booking date. Confirmed bookings are counted separately from replies or clicks. There is no automatic calendar booking or revenue attribution.

**Reminders in this version are dashboard reminders, not scheduled SMS/email notifications.** Open the dashboard daily. No scheduler is required. The owner still sends the actual quote outside the app and records its progress here.

## Upgrade an existing deployment

- Replace the source with this project and run `npm ci`, `npm test`, then `npm run build`.
- Keep your existing environment variables and database. The additive schema creates `enquiries` and `enquiry_events` without deleting existing tables or messages. Back up your production database before deploying.
- Keep `DATABASE_URL` pointed at a server-only PostgreSQL connection. The database role must own or be able to create/alter these tables. New tables enable row-level security with no public policies: access is through the authenticated app/server connection, not a browser database client.
- Ensure `PUBLIC_BASE_URL` is the deployed HTTPS address so SMS links work.
- Open **Settings**, leave **Send the project enquiry form** enabled, and update any previously saved custom template to say: `Hi, this is {business}. Sorry we missed your call! Tell us about your enquiry here: {link} or reply with what you need.` Existing saved custom templates are preserved, so change old “book here” wording yourself.
- If you turn off the enquiry form, `{link}` uses the existing booking URL instead. Enquiries are still tracked in the dashboard.
- Enquiries are created for new eligible calls, not backfilled for old call records. Repeat calls within the cooldown create an owner-visible enquiry but do not send another text.

## Photos, access and limits

- Personal form links contain 192 random bits, expire after 30 days and accept one submission. The confirmation page does not display previously submitted customer details. Treat each link as private: whoever has it can submit before the customer does.
- Forms have no customer login. They use the caller’s number; owners must verify the contact and scope during the callback.
- Uploads allow JPEG, PNG and WebP signatures only: 3 images, each up to 1 MiB. HEIC must be converted first. The request body cap is 4 MB; oversized requests can be rejected before form validation.
- Photos are stored as base64 in the database, not local disk, and served only after owner authentication with no caching. This is a small-pilot storage choice; budget for storage/backups and move to private object storage for larger volumes. Original image metadata is preserved.
- No automatic deletion is implemented. Include enquiries, messages and photos in your business retention/deletion process. A link expiring does not delete the data.
- Forms and owner updates use parameterized SQL. Form submissions are atomic and cannot overwrite a previous submission. Owner edits use a version check so stale windows do not overwrite new information.

## Check the workflow locally

1. Leave Twilio credentials empty; set `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `BUSINESS_NAME`, and `PUBLIC_BASE_URL=http://localhost:3000` in `.env.local`.
2. Run `npm run dev`, then `npm run simulate -- call 7805550199` in another terminal.
3. Copy the `/enquiry/...` URL printed in the server terminal. Submit a project and an optional photo from a phone or browser. (For a phone, use your accessible tunnel/base URL.)
4. Log in → Enquiries & quotes → **Test enquiries**. Open the enquiry and inspect the details/photo.
5. Set Quote to prepare and a past date. The detail retains the date, but test entries intentionally do not appear in live due/booking totals.
6. Set Booking confirmed with an agreed date. It appears in the test record without inflating live totals.
7. The automated `npm test` suite creates an isolated temporary database and exercises the live counters too. It does not send real SMS.

## Known boundaries retained from the original prototype

This is a feature extension, not a complete production-hardening release. The original send flow still treats API acceptance as sent, lacks delivery callbacks and robust outbound retry/cooldown locking, and does not deduplicate inbound SMS webhooks. Login rate limiting and stricter production configuration are still needed. The existing database TLS configuration also needs review before production. Failed manual replies now remain in the unanswered-reply list. No payment processing, multi-tenant accounts or calendar integration is included.

The public form is a request for contact, never a promise of a quote price, response time or booking. Phone forwarding and voicemail limitations below still apply.

---

# Missed Call Text-Back

When a business misses a call, this app texts the caller within seconds with a booking link and an invitation to reply. The owner gets an alert, and a small dashboard shows every missed call, every reply and every booking-link click.

The dashboard distinguishes **Callers who engaged** (a reply or tracked booking-link click) from **Bookings confirmed this month** (explicitly confirmed by the owner). Neither is a revenue claim.

## How calls reach the app

There are two ways to set it up for a business. You choose with `CALL_MODE`.

| Mode | How it works | Best for |
| --- | --- | --- |
| `forward` (recommended) | The business keeps its number. On their phone carrier they turn on "forward when unanswered" to your Twilio number. A call that reaches Twilio has already been missed, so the app texts the caller back. | Almost everyone. No change for their customers. |
| `dial` | Your Twilio number becomes the business's public number. Twilio rings the owner's cell first, and texts the caller back if nobody picks up. | New businesses, or ones whose phone can't forward. |

In `dial` mode, if the owner's voicemail answers, Twilio counts the call as answered and no text is sent. Set **Ring the owner for** in Settings shorter than the time it takes their voicemail to pick up (usually 20–25 seconds).

In `forward` mode, forwarding unanswered calls replaces the carrier's voicemail. Callers get the text instead.

## Try it on your computer first (no Twilio needed)

1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env.local` and set at least:
   ```
   DASHBOARD_PASSWORD=pick-a-password
   SESSION_SECRET=any-long-random-text
   BUSINESS_NAME=Demo Barbers
   OWNER_PHONE=7805550123
   BOOKING_URL=https://example.com/book
   ```
   Leave the Twilio and database lines empty. That is **test mode**: texts are saved to the dashboard instead of sent, and data lives in a local `.data` folder.
4. Run `npm run dev` and open http://localhost:3000. Log in with your password.
5. In a second terminal, pretend to be Twilio:
   ```
   npm run simulate -- call 7805550199
   npm run simulate -- text 7805550199 "Can I book for Saturday?"
   ```
   Refresh the dashboard to see the missed call, the auto-text and the reply.

You can also use **Settings → Send a test** in the dashboard.

## Going live

### 1. Twilio

1. Create an account at twilio.com and upgrade it (trial accounts can only text verified numbers and add a trial message).
2. Buy a Canadian phone number with **Voice** and **SMS**. An Edmonton (780/587) or Calgary (403/587) number looks local to customers.
3. Twilio may ask you to register your business or the number before it allows texting. Follow its prompts, since unregistered numbers can have texts blocked.
4. Note your **Account SID** and **Auth Token** from the console home page. Keep them private.

### 2. Database (Supabase)

1. Create a free project at supabase.com.
2. Go to **Connect**, choose the **Transaction pooler** connection string (port 6543), and put your database password into it.
3. That string is your `DATABASE_URL`. The app creates its own tables on first run.

The local `.data` database does **not** work on Vercel, because Vercel doesn't keep files between requests. Production needs `DATABASE_URL`.

### 3. Deploy (Vercel)

1. Put this folder in a GitHub repository (the `.gitignore` already keeps secrets and local data out).
2. At vercel.com, choose **Add New → Project** and import the repo.
3. Under **Environment Variables**, add everything from `.env.example`:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (as `+1XXXXXXXXXX`)
   - `TWILIO_VALIDATE_SIGNATURE=true`
   - `DATABASE_URL`
   - `DASHBOARD_PASSWORD` and `SESSION_SECRET` (a long random string)
   - `BUSINESS_NAME`, `OWNER_PHONE`, `BOOKING_URL`, `CALL_MODE`
   - `PUBLIC_BASE_URL` — set this after the first deploy to the exact address Vercel gives you, such as `https://missed-call-textback.vercel.app`, then redeploy. Twilio's security check fails if this doesn't match exactly.
4. Deploy.

### 4. Point Twilio at the app

In the Twilio console, open **Phone Numbers → Manage → Active numbers →** your number:

- **A call comes in**: Webhook, `https://YOUR-APP/api/twilio/voice`, HTTP POST
- **A message comes in**: Webhook, `https://YOUR-APP/api/twilio/sms`, HTTP POST

Save.

### 5. Turn on forwarding at the business (forward mode)

On most Canadian mobile carriers you set "forward when unanswered" by dialing a code from the business phone, for example:

```
**61*+1XXXXXXXXXX#      (your Twilio number)
```

Codes and options differ by carrier and plan (and some charge for forwarding), so confirm with the carrier first. Office phone systems such as RingCentral or a VoIP provider have a "forward on no answer" setting in their admin page instead.

Also consider forwarding busy and unreachable calls (often `**67*` and `**62*`) so those callers get a text too.

### 6. Test it for real

1. In **Settings → Send a test**, enter your own cell. You should get the text within a few seconds.
2. From your own cell, call the business number and don't answer. You should get the text, and the owner's cell should get an alert.
3. Reply to the text. It should appear in the dashboard under **Waiting for your reply**, and the owner should get an alert.

## Everyday features

- **No repeat texts**: the same caller isn't texted again within 12 hours (changeable in Settings).
- **Opt-outs**: if a customer replies STOP, they are never texted again, and the dashboard blocks replies to them. Twilio also blocks texts to them automatically.
- **Owner alerts**: a text to the owner's cell for each missed call and each reply. The owner can't reply to customers by texting the Twilio number; they reply from the dashboard or call back.
- **Pause switch**: turn auto-text off in Settings without changing any phone setup.
- **Tracked booking link**: each text gets its own short link, so the dashboard knows who clicked.
- **Security**: Twilio requests are verified with Twilio's signature, and the dashboard is password protected.

## Costs to plan for

Twilio charges a small monthly fee for the number and a small fee per text and per forwarded call minute. Check current Canadian pricing on Twilio's website. Budget for production hosting and database storage. Vercel Hobby is for personal, non-commercial use; use a commercially permitted plan for paying clients.

## Texting rules in Canada

Replying to someone who just called the business is generally treated as answering their inquiry under Canada's anti-spam law (CASL). Don't add these callers to marketing or promotional texts without their consent. This isn't legal advice, so check the CRTC's CASL guidance before selling the service widely.

## Project layout

```
app/api/twilio/voice        incoming calls
app/api/twilio/dial-status  "dial" mode: did the owner answer?
app/api/twilio/sms          incoming texts
app/r/[token]               tracked booking links
app/dashboard               overview, conversations, settings
lib/textback.js             the main logic (who to text, when, alerts)
lib/db.js                   database (Supabase in production, local file for testing)
lib/settings.js             default message and settings
scripts/simulate.mjs        fake Twilio calls and texts for testing
```

## Next steps when you add more clients

This version serves one business per deployment. The simplest way to start is one deployment per client, each with its own Twilio number and database. Moving to one app for many clients means adding a `businesses` table, linking each Twilio number to a business, and adding a login per client.
