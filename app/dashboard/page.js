import Link from "next/link";
import { enquiryStats } from "@/lib/enquiries";
import { requireLogin } from "@/lib/auth";
import {
  monthStats,
  recentCalls,
  unansweredReplies,
  formatTime,
  TIMEZONE,
} from "@/lib/stats";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

function Stat({ label, value, hero }) {
  return (
    <div className={`stat${hero ? " hero" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function CallTags({ call }) {
  if (call.status === "answered") return <span className="tag">Answered</span>;
  return (
    <>
      {call.texted ? (
        <span className="tag good">Texted back</span>
      ) : (
        <span
          className={`tag ${call.skipped_reason?.startsWith("Text failed") ? "bad" : "warn"}`}
        >
          Not texted
        </span>
      )}
      {call.texted && call.replied && <span className="tag good">Replied</span>}
      {call.texted && call.clicked && (
        <span className="tag good">Clicked link</span>
      )}
    </>
  );
}

export default async function Overview() {
  await requireLogin();
  const pipeline = await enquiryStats();
  const [stats, calls, waiting] = await Promise.all([
    monthStats(),
    recentCalls(),
    unansweredReplies(),
  ]);
  const month = new Date().toLocaleString("en-CA", {
    month: "long",
    timeZone: TIMEZONE,
  });

  return (
    <main>
      <h1>Overview</h1>
      <p className="sub">{month} so far</p>

      <section className="stats">
        <Stat label="Callers who engaged" value={stats.recovered} hero />
        <Stat label="Missed calls" value={stats.missed} />
        <Stat label="Texted back" value={stats.texted} />
        <Stat label="Replied" value={stats.replied} />
        <Stat label="Clicked booking link" value={stats.clicked} />
      </section>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        Engaged means a caller replied or clicked a tracked booking link. It
        does not mean a confirmed booking.
      </p>

      <section className="card pad" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Enquiry follow-through</h2>
        <p>
          <strong>{pipeline.waiting}</strong> awaiting owner response ·{" "}
          <strong>{pipeline.due}</strong> quotes due ·{" "}
          <strong>{pipeline.booked}</strong> bookings confirmed this month
        </p>
        <Link href="/dashboard/enquiries">Open enquiries & quotes →</Link>
        {pipeline.due > 0 && (
          <p className="due">
            <Link href="/dashboard/enquiries?filter=due">
              Reminder: review your promised quotes
            </Link>
          </p>
        )}
      </section>
      {waiting.length > 0 && (
        <>
          <h2>Waiting for your reply</h2>
          <div className="card table-wrap">
            <table>
              <tbody>
                {waiting.map((w) => (
                  <tr key={w.phone}>
                    <td>
                      <Link
                        href={`/dashboard/c/${encodeURIComponent(w.phone)}`}
                      >
                        {formatPhone(w.phone)}
                      </Link>
                    </td>
                    <td className="muted">texted {formatTime(w.last_in)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Recent calls</h2>
      <div className="card table-wrap">
        {calls.length === 0 ? (
          <div className="empty">
            No calls yet. Try a test from{" "}
            <Link href="/dashboard/settings">Settings</Link>.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Caller</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {formatTime(c.created_at)}
                  </td>
                  <td>
                    {c.caller.startsWith("+") ? (
                      <Link
                        href={`/dashboard/c/${encodeURIComponent(c.caller)}`}
                      >
                        {formatPhone(c.caller)}
                      </Link>
                    ) : (
                      <span className="muted">{c.caller}</span>
                    )}
                  </td>
                  <td>
                    <CallTags call={c} />
                    {!c.texted && c.skipped_reason && (
                      <div className="muted" style={{ fontSize: 13 }}>
                        {c.skipped_reason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
