import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'mctb_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // stay logged in for 30 days

function secret() {
  return process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || '';
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordConfigured() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function checkPassword(input) {
  return passwordConfigured() && safeEqual(input, process.env.DASHBOARD_PASSWORD);
}

export async function startSession() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = `${expires}.${sign(String(expires))}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isLoggedIn() {
  if (!passwordConfigured()) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value || '';
  const [expires, sig] = raw.split('.');
  if (!expires || !sig) return false;
  if (Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(expires));
}

// Use at the top of every dashboard page and server action.
export async function requireLogin() {
  if (!(await isLoggedIn())) redirect('/login');
}
