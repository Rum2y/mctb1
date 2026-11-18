import Link from 'next/link';
import { requireLogin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { twilioConfigured } from '@/lib/twilio';
import { logoutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
  await requireLogin();
  const settings = await getSettings();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {settings.business_name}
          <small>Enquiry & quote follow-up</small>
        </div>
        <nav className="nav">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/enquiries">Enquiries & quotes</Link>
          <Link href="/dashboard/settings">Settings</Link>
          <form action={logoutAction}>
            <button type="submit">Log out</button>
          </form>
        </nav>
      </header>

      {!twilioConfigured() && (
        <div className="banner">
          Test mode: Twilio isn&apos;t connected yet, so texts are saved here but not actually sent.
        </div>
      )}
      {settings.enabled !== 'on' && (
        <div className="banner">Auto-text is paused. Turn it back on in Settings.</div>
      )}

      {children}
    </div>
  );
}
