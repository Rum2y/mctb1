'use client';
import { useActionState } from 'react';
import { submitEnquiryAction } from './actions';
import { JOB_TYPES } from '@/lib/enquiry-validation';
export default function IntakeForm({ token }) {
  const [state, action, pending] = useActionState(submitEnquiryAction.bind(null,token), null);
  return <form action={action} className="stack card pad">
    {state?.error && <div role="alert" className="notice bad">{state.error} Please reselect photos if needed.</div>}
    <label>Your name<input type="text" name="customer_name" required maxLength={100} autoComplete="name" /></label>
    <label>What do you need help with?<select name="job_type" required defaultValue=""><option value="" disabled>Select a job type</option>{JOB_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Neighbourhood or service area<input type="text" name="area" required maxLength={160} placeholder="e.g. Windermere, Edmonton" /></label>
    <label>Best time to call you<input type="text" name="callback_time" required maxLength={200} placeholder="e.g. Tuesday after 4 pm, Edmonton time" /><span className="hint">A preference, not a confirmed appointment.</span></label>
    <label>Tell us a little about the job<textarea name="description" maxLength={2000} /></label>
    <label>Project photos (optional)<input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" /><span className="hint">Up to 3 photos, 1 MB each. JPEG, PNG or WebP. Only the business owner can view them. Avoid personal documents or sensitive information.</span></label>
    <label className="check"><input name="permission" type="checkbox" required /> I agree to be contacted about this enquiry using the number I called from.</label>
    <button className="btn" disabled={pending}>{pending ? 'Submitting…' : 'Send enquiry'}</button>
    <p className="muted">This requests a callback or quote. It does not confirm a booking. Keep this personal link private.</p>
  </form>;
}
