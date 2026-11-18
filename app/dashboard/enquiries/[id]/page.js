import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireLogin } from '@/lib/auth';
import { getEnquiry } from '@/lib/enquiries';
import { query } from '@/lib/db';
import { formatTime } from '@/lib/stats';
import { formatPhone } from '@/lib/phone';
import Editor from './editor';
export const dynamic='force-dynamic';
export default async function Detail({ params, searchParams }) {
  await requireLogin();
  const { saved } = await searchParams;
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<1) notFound();
  const e=await getEnquiry(id); if(!e) notFound();
  const events=await query('SELECT id,label,created_at FROM enquiry_events WHERE enquiry_id=$1 ORDER BY id DESC LIMIT 30',[id]);
  return <main><p><Link href="/dashboard/enquiries">← Enquiries</Link></p><h1>{e.customer_name||formatPhone(e.phone)}</h1><p className="sub">Enquiry #{id} · {formatTime(e.created_at)} {e.is_test&&'· Test enquiry'}</p>
    {saved && <div className="notice" role="status">Enquiry updated.</div>}
    <div className="detail-grid"><section><div className="card pad"><h2 style={{marginTop:0}}>Project details</h2><dl><dt>Phone</dt><dd><a href={`tel:${e.phone}`}>{formatPhone(e.phone)}</a> · <Link href={`/dashboard/c/${encodeURIComponent(e.phone)}`}>Text conversation</Link></dd><dt>Job type</dt><dd>{e.job_type||'Not provided yet'}</dd><dt>Area</dt><dd>{e.area||'—'}</dd><dt>Preferred callback</dt><dd>{e.callback_time||'—'}</dd><dt>Description</dt><dd style={{whiteSpace:'pre-wrap'}}>{e.description||'—'}</dd></dl>{!e.submitted_at&&<p className="muted">The customer has not submitted the form yet. You can still call or text them.</p>}
    <div className="photos">{Array.from({length:e.photo_count},(_,i)=><a key={i} href={`/api/enquiries/${id}/photos/${i}`} target="_blank" rel="noreferrer"><img src={`/api/enquiries/${id}/photos/${i}`} alt={`Project photo ${i+1}`} /></a>)}</div></div>
    <h2>Activity</h2><div className="card pad">{events.length?events.map(event=><p key={event.id}>{event.label}<br/><small className="muted">{formatTime(event.created_at)}</small></p>):<p>Enquiry created from a missed call.</p>}</div></section><Editor enquiry={e}/></div>
  </main>;
}
