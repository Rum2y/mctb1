import Link from 'next/link';
import { notFound } from 'next/navigation';
import { thread, contact as getContact, formatTime } from '@/lib/stats';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { replyAction } from '../../actions';

export const dynamic = 'force-dynamic';

const KIND_LABEL = { auto: 'Auto-text', manual: 'You', reply: 'Customer' };

export default async function Conversation({ params, searchParams }) {
  const { phone: raw } = await params;
  const { error } = await searchParams;
  const phone = normalizePhone(decodeURIComponent(raw));
  if (!phone) notFound();

  const [messages, contact] = await Promise.all([thread(phone), getContact(phone)]);

  return (
    <main>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/dashboard">&larr; Overview</Link>
      </p>
      <h1>{formatPhone(phone)}</h1>
      <p className="sub">
        <a href={`tel:${phone}`}>Call</a>
        {contact?.opted_out && <span className="tag bad" style={{ marginLeft: 10 }}>Opted out (replied STOP)</span>}
      </p>

      <div className="card">
        {messages.length === 0 ? (
          <div className="empty">No messages with this number yet.</div>
        ) : (
          <div className="thread">
            {messages.map((m) => {
              if (m.kind === 'owner_alert') {
                return (
                  <div key={m.id} className="bubble alert">
                    Alert to owner: {m.body}
                  </div>
                );
              }
              const status =
                m.status === 'simulated' ? ' · test mode, not sent' : m.status === 'failed' ? ` · FAILED: ${m.error}` : '';
              return (
                <div key={m.id} className={`bubble ${m.direction}`}>
                  {m.body}
                  <span className="meta">
                    {KIND_LABEL[m.kind] || m.kind} · {formatTime(m.created_at)}
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2>Reply</h2>
      {error && <div className="notice bad">{error}</div>}
      <form action={replyAction} className="stack card pad">
        <input type="hidden" name="phone" value={phone} />
        <label>
          Message
          <textarea name="body" required maxLength={1000} disabled={contact?.opted_out} placeholder="Type your reply..." />
        </label>
        <button className="btn" type="submit" disabled={contact?.opted_out}>Send text</button>
      </form>
    </main>
  );
}
