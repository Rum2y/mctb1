'use server';
import { requireLogin } from '@/lib/auth';
import { field, dateField } from '@/lib/enquiry-validation';
import { updateEnquiry } from '@/lib/enquiries';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
export async function updateEnquiryAction(id, _previous, form) {
  await requireLogin();
  try {
    const version = Number(form.get('version'));
    if (!Number.isSafeInteger(version) || version < 0) throw new Error('Reload the enquiry before saving.');
    const result = await updateEnquiry(id,version,{stage:field(form,'stage',30,true),quoteDue:dateField(form,'quote_due'),bookingDate:dateField(form,'booking_date'),notes:field(form,'notes',4000),awaiting:form.get('awaiting_owner')==='on'});
    if (!result) return { error:'This enquiry changed in another window or received new information. Reload it before saving.' };
  } catch (error) { return { error:error.message }; }
  revalidatePath('/dashboard','layout');
  redirect(`/dashboard/enquiries/${id}?saved=1`);
}
