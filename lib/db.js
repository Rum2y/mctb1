// Database layer.
// - If DATABASE_URL is set (e.g. Supabase), we use a normal Postgres connection.
// - Otherwise we use PGlite, a real Postgres engine stored in ./.data, so local
//   testing needs no setup. The SQL is identical either way.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  phone          TEXT PRIMARY KEY,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_texted_at TIMESTAMPTZ,
  opted_out      BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS calls (
  id             SERIAL PRIMARY KEY,
  call_sid       TEXT UNIQUE,
  caller         TEXT NOT NULL,
  status         TEXT NOT NULL,          -- 'missed' | 'answered'
  texted         BOOLEAN NOT NULL DEFAULT false,
  skipped_reason TEXT,                   -- why no text was sent, if any
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,             -- the customer's number
  direction   TEXT NOT NULL,             -- 'out' | 'in'
  kind        TEXT NOT NULL,             -- 'auto' | 'manual' | 'reply' | 'owner_alert'
  body        TEXT NOT NULL,
  twilio_sid  TEXT,
  status      TEXT NOT NULL,             -- 'sent' | 'simulated' | 'failed' | 'received'
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_phone_idx ON messages (phone, created_at);

CREATE TABLE IF NOT EXISTS links (
  token      TEXT PRIMARY KEY,
  phone      TEXT NOT NULL,
  call_id    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id         SERIAL PRIMARY KEY,
  token      TEXT NOT NULL,
  phone      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  call_id INTEGER UNIQUE REFERENCES calls(id),
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  customer_name TEXT NOT NULL DEFAULT '',
  job_type TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  callback_time TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photos JSONB NOT NULL DEFAULT '[]',
  stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','quote_due','quote_sent','booked','closed')),
  awaiting_owner BOOLEAN NOT NULL DEFAULT true,
  quote_due DATE,
  booking_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  is_test BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_stage_due_idx ON enquiries(stage, quote_due);
CREATE INDEX IF NOT EXISTS enquiries_phone_idx ON enquiries(phone);
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS enquiry_events (
  id SERIAL PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE enquiry_events ENABLE ROW LEVEL SECURITY;

`;

async function createClient() {
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const url = process.env.DATABASE_URL;
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({
      connectionString: url,
      max: 3,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    return {
      query: async (sql, params = []) => (await pool.query(sql, params)).rows,
      exec: async (sql) => { await pool.query(sql); },
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('node:fs');
  const dir = process.env.PGLITE_DIR || './.data/pgdata';
  mkdirSync(dir, { recursive: true });
  const lite = new PGlite(dir);
  return {
    query: async (sql, params = []) => (await lite.query(sql, params)).rows,
    exec: async (sql) => { await lite.exec(sql); },
  };
}

// Keep one connection across hot reloads in development.
const g = globalThis;

async function getDb() {
  if (!g.__mctbDb) {
    g.__mctbDb = (async () => {
      const client = await createClient();
      await client.exec(SCHEMA);
      return client;
    })();
  }
  return g.__mctbDb;
}

export async function query(sql, params = []) {
  const db = await getDb();
  return db.query(sql, params);
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}
