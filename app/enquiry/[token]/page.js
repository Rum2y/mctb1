import { notFound } from 'next/navigation';
import { intakeState } from '@/lib/enquiries';
import { getSettings } from '@/lib/settings';
import IntakeForm from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tell us about your project', robots: { index:false, follow:false }, referrer:'no-referrer' };
export default async function EnquiryPage({ params }) {
  const { token } = await params;
  const enquiry = await intakeState(token);
  if (!enquiry) notFound();
  const settings = await getSettings();
  return <main className="intake"><p className="eyebrow">{settings.business_name}</p>
    {enquiry.submitted_at ? <div className="card pad"><h1>Thanks — your enquiry is with us.</h1><p>The team will review your details and contact you. A booking is only confirmed once agreed with the team.</p></div> : <><h1>Let’s talk about your project</h1><p className="sub">A few details will help us prepare for your callback.</p><IntakeForm token={token} /></>}
  </main>;
}
