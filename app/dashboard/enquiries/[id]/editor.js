'use client';
import { useActionState, useState } from 'react';
import { updateEnquiryAction } from '../actions';
import { STAGES } from '@/lib/enquiry-validation';
export default function Editor({ enquiry:e }) {
  const [state,action,pending]=useActionState(updateEnquiryAction.bind(null,e.id),null);
  const [stage,setStage]=useState(e.stage);
  return <form action={action} className="stack card pad">
    <h2 style={{margin:0}}>Follow-through</h2>
    {state?.error && <div className="notice bad" role="alert">{state.error}</div>}
    {state?.saved && <div className="notice" role="status">Enquiry updated.</div>}
    <input type="hidden" name="version" value={e.version} />
    <label>Stage<select name="stage" value={stage} onChange={event=>setStage(event.target.value)}>{Object.entries(STAGES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    {stage==='quote_due' && <label>Quote promised by<input type="date" name="quote_due" defaultValue={e.quote_due || ''} required /><span className="hint">Appears in Due quotes on this date, using the business timezone.</span></label>}
    {stage==='booked' && <label>Confirmed booking date<input type="date" name="booking_date" defaultValue={e.booking_date || ''} required /><span className="hint">Only mark confirmed after you and the customer agree.</span></label>}
    {!['booked','closed'].includes(stage) && <label className="check"><input type="checkbox" name="awaiting_owner" defaultChecked={e.awaiting_owner} /> Awaiting my response</label>}
    <label>Internal notes<textarea name="notes" defaultValue={e.notes} maxLength={4000} /></label>
    <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save progress'}</button>
  </form>;
}
