import Link from 'next/link';
import { requireLogin } from '@/lib/auth';
import { listEnquiries, enquiryStats, STAGES } from '@/lib/enquiries';
import { formatPhone } from '@/lib/phone';
export const dynamic='force-dynamic';
const FILTERS={active:'Active',waiting:'Awaiting response',due:'Due quotes',booked:'Booked',all:'All live',test:'Test enquiries'};
export default async function EnquiriesPage({ searchParams }) {
  await requireLogin();
  const { filter='active' }=await searchParams;
  const [rows,stats]=await Promise.all([listEnquiries(filter),enquiryStats()]);
  return <main><h1>Enquiries & quotes</h1><p className="sub">Keep every next step visible, from missed call to confirmed booking.</p>
    <div className="stats">{[['Awaiting your response',stats.waiting],['Quotes due today or overdue',stats.due],['Bookings confirmed this month',stats.booked]].map(([label,value])=><div className="stat" key={label}><div className="label">{label}</div><div className="value">{value}</div></div>)}</div>
    {stats.due>0 && <div className="banner" style={{marginTop:16}}>You have {stats.due} quote(s) due. <Link href="/dashboard/enquiries?filter=due">Review promised quotes</Link></div>}
    <nav className="filters" aria-label="Enquiry filter">{Object.entries(FILTERS).map(([k,v])=><Link className={filter===k?'selected':''} key={k} href={`/dashboard/enquiries?filter=${k}`}>{v}</Link>)}</nav>
    <div className="card table-wrap">{!rows.length ? <p className="empty">No enquiries in this view. Eligible missed calls create enquiries automatically.</p> : <table><thead><tr><th>Customer</th><th>Project</th><th>Stage</th><th>Next step</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td><Link href={`/dashboard/enquiries/${e.id}`}>{e.customer_name||formatPhone(e.phone)}</Link><div className="muted">{formatPhone(e.phone)}</div></td><td>{e.job_type||'Details not submitted'}<div className="muted">{e.area}</div></td><td><span className={`tag ${e.stage==='booked'?'good':''}`}>{STAGES[e.stage]}</span>{e.is_test&&<span className="tag warn">Test</span>}</td><td>{e.awaiting_owner&&!['booked','closed'].includes(e.stage)&&<div>Owner response needed</div>}{e.quote_due&&<div className={e.quote_overdue?'due':''}>Quote due {e.quote_due}</div>}{e.booking_date&&<div>Booked for {e.booking_date}</div>}</td></tr>)}</tbody></table>}</div><p className="muted">Up to 200 enquiries per view. Booking totals are owner-confirmed, not inferred from clicks.</p>
  </main>;
}
