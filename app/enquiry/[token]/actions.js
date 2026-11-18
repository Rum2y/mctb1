'use server';
import { redirect } from 'next/navigation';
import { intakeState, submitIntake } from '@/lib/enquiries';
import { intakeFields } from '@/lib/enquiry-validation';
export async function submitEnquiryAction(token, _previous, form) {
  if (!(await intakeState(token))) return { error: 'This link has expired. Please call the business for a new enquiry.' };
  let data;
  try { data = await intakeFields(form); } catch (error) { return { error: error.message }; }
  const result = await submitIntake(token, data);
  if (!result) return { error: 'This enquiry has already been submitted or the link has expired.' };
  redirect(`/enquiry/${token}?submitted=1`);
}
