import { query, one } from './db.js';

// An opt-out ("STOP") is not a real reply, so it never counts as a recovered customer.
const REAL_REPLY = `lower(trim(x.body)) NOT IN ('stop','stopall','unsubscribe','cancel','end','quit','arret')`;

export const TIMEZONE = process.env.APP_TIMEZONE || 'America/Edmonton';

export function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

// "Recovered" = a caller we texted who then replied or clicked the booking link.
// This is the number that shows the business owner what the service is worth.
export async function monthStats() {
  return one(
    `WITH start AS (
       SELECT (date_trunc('month', now() AT TIME ZONE $1) AT TIME ZONE $1) AS t
     ),
     m AS (
       SELECT c.*,
         EXISTS (SELECT 1 FROM messages x WHERE x.phone = c.caller AND x.direction = 'in' AND ${REAL_REPLY}
                 AND x.created_at >= c.created_at) AS replied,
         EXISTS (SELECT 1 FROM link_clicks k WHERE k.phone = c.caller
                 AND k.created_at >= c.created_at) AS clicked
       FROM calls c, start
       WHERE c.created_at >= start.t
         AND NOT EXISTS (SELECT 1 FROM enquiries e WHERE e.call_id=c.id AND e.is_test)
         AND c.call_sid NOT LIKE 'test-%' AND c.call_sid NOT LIKE 'CAsim%'
     )
     SELECT
       count(*) FILTER (WHERE status = 'missed')::int                                  AS missed,
       count(*) FILTER (WHERE status = 'answered')::int                                AS answered,
       count(*) FILTER (WHERE texted)::int                                             AS texted,
       count(DISTINCT caller) FILTER (WHERE texted AND replied)::int                   AS replied,
       count(DISTINCT caller) FILTER (WHERE texted AND clicked)::int                   AS clicked,
       count(DISTINCT caller) FILTER (WHERE texted AND (replied OR clicked))::int      AS recovered
     FROM m`,
    [TIMEZONE]
  );
}

export async function recentCalls(limit = 50) {
  return query(
    `SELECT c.*,
       EXISTS (SELECT 1 FROM messages x WHERE x.phone = c.caller AND x.direction = 'in' AND ${REAL_REPLY}
               AND x.created_at >= c.created_at) AS replied,
       EXISTS (SELECT 1 FROM link_clicks k WHERE k.phone = c.caller
               AND k.created_at >= c.created_at) AS clicked
     FROM calls c
     ORDER BY c.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

// Customers who texted in and haven't had a reply from the business since.
export async function unansweredReplies() {
  return query(
    `SELECT m.phone, max(m.created_at) AS last_in
     FROM messages m
     JOIN contacts ct ON ct.phone = m.phone AND NOT ct.opted_out
     WHERE m.direction = 'in'
       AND NOT EXISTS (
         SELECT 1 FROM messages o
         WHERE o.phone = m.phone AND o.direction = 'out' AND o.kind = 'manual' AND o.status NOT IN ('failed','undelivered')
           AND o.created_at > m.created_at
       )
     GROUP BY m.phone
     ORDER BY last_in DESC
     LIMIT 20`
  );
}

export async function thread(phone) {
  return query(
    `SELECT * FROM messages WHERE phone = $1 ORDER BY created_at ASC, id ASC`,
    [phone]
  );
}

export async function contact(phone) {
  return one('SELECT * FROM contacts WHERE phone = $1', [phone]);
}
