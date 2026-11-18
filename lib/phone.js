// Normalize North American numbers to E.164 (+1XXXXXXXXXX).
// Returns null for blocked/anonymous callers or numbers we can't text.
export function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/anonymous|restricted|unknown|private|blocked/i.test(s)) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (s.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '';
}
