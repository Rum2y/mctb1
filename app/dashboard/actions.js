'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireLogin, endSession } from '@/lib/auth';
import { saveSettings } from '@/lib/settings';
import { sendManualReply, handleMissedCall } from '@/lib/textback';
import { normalizePhone } from '@/lib/phone';

export async function logoutAction() {
  await endSession();
  redirect('/login');
}

export async function saveSettingsAction(formData) {
  await requireLogin();
  const owner = String(formData.get('owner_phone') || '').trim();
  if (owner && !normalizePhone(owner)) redirect('/dashboard/settings?error=owner');

  const booking = String(formData.get('booking_url') || '').trim();
  if (booking && !/^https?:\/\//i.test(booking)) redirect('/dashboard/settings?error=link');

  await saveSettings({
    business_name: String(formData.get('business_name') || '').trim(),
    owner_phone: owner ? normalizePhone(owner) : '',
    booking_url: booking,
    message_template: String(formData.get('message_template') || '').trim(),
    voice_message: String(formData.get('voice_message') || '').trim(),
    cooldown_hours: String(Math.max(0, Number(formData.get('cooldown_hours')) || 0)),
    ring_seconds: String(Math.min(60, Math.max(5, Number(formData.get('ring_seconds')) || 20))),
    owner_alerts: formData.get('owner_alerts') ? 'on' : 'off',
    intake_enabled: formData.get('intake_enabled') ? 'on' : 'off',
    enabled: formData.get('enabled') ? 'on' : 'off',
  });
  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard/settings?saved=1');
}

export async function replyAction(formData) {
  await requireLogin();
  const phone = String(formData.get('phone') || '');
  const body = String(formData.get('body') || '');
  const result = await sendManualReply(phone, body);
  const path = `/dashboard/c/${encodeURIComponent(phone)}`;
  revalidatePath(path);
  redirect(result.ok ? path : `${path}?error=${encodeURIComponent(result.error)}`);
}

// Runs a pretend missed call from a number you choose. With Twilio connected,
// this really sends the text, so use your own cell to see what customers get.
export async function testMissedCallAction(formData) {
  await requireLogin();
  const phone = normalizePhone(String(formData.get('test_phone') || ''));
  if (!phone) redirect('/dashboard/settings?error=test');
  const result = await handleMissedCall({ callSid: `test-${Date.now()}`, caller: phone });
  revalidatePath('/dashboard', 'layout');
  const outcome = result.texted ? 'sent' : encodeURIComponent(result.reason || 'not sent');
  redirect(`/dashboard/settings?test=${outcome}`);
}
