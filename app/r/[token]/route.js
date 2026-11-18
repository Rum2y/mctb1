// Tracked booking link: logs the click, then sends the customer to the real booking page.
import { recordLinkClick, baseUrl } from '@/lib/textback';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { token } = await params;
  const settings = await getSettings();
  try {
    await recordLinkClick(token);
  } catch (err) {
    console.error('Could not record click:', err?.message);
  }
  const target = settings.booking_url || baseUrl();
  return Response.redirect(target, 302);
}
