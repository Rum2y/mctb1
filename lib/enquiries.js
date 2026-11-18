import { randomBytes } from 'node:crypto';
import { query, one } from './db.js';
import { STAGES } from './enquiry-validation.js';
import { TIMEZONE } from './stats.js';
export { STAGES } from './enquiry-validation.js';
export async function ensureEnquiry(callId, phone, isTest = false) {
  return one(`INSERT INTO enquiries (call_id,phone,token,is_test) VALUES ($1,$2,$3,$4)
    ON CONFLICT (call_id) DO UPDATE SET call_id = EXCLUDED.call_id RETURNING id,token`,
    [callId,phone,randomBytes(24).toString('base64url'),isTest]);
}
export async function intakeState(token) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token || '')) return null;
  return one('SELECT id, submitted_at FROM enquiries WHERE token=$1 AND expires_at > now()', [token]);
}
export async function submitIntake(token, data) {
  return one(`WITH changed AS (
    UPDATE enquiries SET customer_name=$2,job_type=$3,area=$4,callback_time=$5,description=$6,photos=$7::jsonb,
    submitted_at=now(),awaiting_owner=true,updated_at=now(),version=version+1
    WHERE token=$1 AND expires_at>now() AND submitted_at IS NULL RETURNING id
  ), event AS (INSERT INTO enquiry_events(enquiry_id,label) SELECT id,'Customer submitted project details' FROM changed)
  SELECT id FROM changed`, [token,data.name,data.job,data.area,data.callback,data.description,JSON.stringify(data.photos)]);
}
export async function listEnquiries(filter = 'active') {
  const clauses = { active: "stage NOT IN ('booked','closed')", waiting: "awaiting_owner AND stage NOT IN ('booked','closed')", due: "stage='quote_due' AND quote_due <= (now() AT TIME ZONE $1)::date", booked: "stage='booked'", all: 'true', test: 'is_test' };
  const clause = clauses[filter] || clauses.active;
  return query(`SELECT id,phone,customer_name,job_type,area,stage,awaiting_owner,quote_due::text,booking_date::text,submitted_at,is_test,created_at,
    (stage='quote_due' AND quote_due <= (now() AT TIME ZONE $1)::date) AS quote_overdue
    FROM enquiries WHERE (${clause}) ${filter === 'test' ? '' : 'AND NOT is_test'} ORDER BY awaiting_owner DESC,quote_due ASC NULLS LAST,created_at DESC LIMIT 200`, [TIMEZONE]);
}
export async function enquiryStats() {
  return one(`SELECT count(*) FILTER (WHERE awaiting_owner AND stage NOT IN ('booked','closed'))::int AS waiting,
    count(*) FILTER (WHERE stage='quote_due' AND quote_due <= (now() AT TIME ZONE $1)::date)::int AS due,
    count(*) FILTER (WHERE stage='booked' AND booked_at >= date_trunc('month',now() AT TIME ZONE $1) AT TIME ZONE $1)::int AS booked
    FROM enquiries WHERE NOT is_test`, [TIMEZONE]);
}
export async function getEnquiry(id) {
  return one(`SELECT id,phone,customer_name,job_type,area,callback_time,description,stage,awaiting_owner,
    quote_due::text,booking_date::text,notes,submitted_at,is_test,version,created_at,jsonb_array_length(photos) AS photo_count FROM enquiries WHERE id=$1`, [id]);
}
export async function updateEnquiry(id, version, data) {
  if (!STAGES[data.stage]) throw new Error('Choose a valid stage.');
  if (data.stage === 'quote_due' && !data.quoteDue) throw new Error('Set the date you promised to send the quote.');
  if (data.stage === 'booked' && !data.bookingDate) throw new Error('Set the confirmed booking date.');
  return one(`WITH changed AS (
    UPDATE enquiries SET stage=$3,quote_due=$4,booking_date=$5,notes=$6,
      awaiting_owner=CASE WHEN $3 IN ('booked','closed') THEN false ELSE $7 END,
      booked_at=CASE WHEN $3='booked' THEN coalesce(booked_at,now()) ELSE NULL END,
      updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id
    ), event AS (INSERT INTO enquiry_events(enquiry_id,label) SELECT id,$8 FROM changed)
    SELECT id FROM changed`, [id,version,data.stage,data.stage==='quote_due' ? data.quoteDue : null,
      data.stage==='booked' ? data.bookingDate : null,data.notes,data.awaiting,`Owner saved: ${STAGES[data.stage]}`]);
}
export async function markAwaiting(phone, awaiting) {
  await query(`UPDATE enquiries SET awaiting_owner=$2,updated_at=now(),version=version+1 WHERE phone=$1 AND stage NOT IN ('booked','closed')`,[phone,awaiting]);
}
