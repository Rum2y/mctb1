export const STAGES = { new: 'New enquiry', contacted: 'Contacted', quote_due: 'Quote to prepare', quote_sent: 'Quote sent', booked: 'Booking confirmed', closed: 'Closed / not proceeding' };
export const JOB_TYPES = ['Bathroom renovation', 'Kitchen renovation', 'Basement renovation', 'General renovation', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Other'];
export const MAX_PHOTO_BYTES = 1024 * 1024;
export function field(form, name, max, required = false) {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if ((required && !value) || value.length > max) throw new Error(`Please check ${name.replaceAll('_', ' ')} (maximum ${max} characters).`);
  return value;
}
export function dateField(form, name) {
  const value = field(form, name, 10);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Error('Enter a valid calendar date.');
  return value;
}
export async function intakeFields(form) {
  const data = {
    name: field(form, 'customer_name', 100, true),
    job: field(form, 'job_type', 80, true),
    area: field(form, 'area', 160, true),
    callback: field(form, 'callback_time', 200, true),
    description: field(form, 'description', 2000),
  };
  if (!JOB_TYPES.includes(data.job)) throw new Error('Choose a job type from the list.');
  if (form.get('permission') !== 'on') throw new Error('Please confirm we may contact you about this enquiry.');
  const files = form.getAll('photos').filter(f => f && typeof f.arrayBuffer === 'function' && f.size > 0);
  if (files.length > 3) throw new Error('Please upload no more than 3 photos.');
  data.photos = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 1 MB or smaller.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    const type = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
    if (!type || type !== file.type) throw new Error('Use JPEG, PNG or WebP photos. Convert HEIC photos before uploading.');
    data.photos.push({ type, data: bytes.toString('base64') });
  }
  return data;
}
