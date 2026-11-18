import { redirect } from 'next/navigation';
import { checkPassword, startSession, passwordConfigured, isLoggedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function login(formData) {
  'use server';
  if (!checkPassword(String(formData.get('password') || ''))) {
    redirect('/login?error=1');
  }
  await startSession();
  redirect('/dashboard');
}

export default async function LoginPage({ searchParams }) {
  if (await isLoggedIn()) redirect('/dashboard');
  const { error } = await searchParams;

  return (
    <main className="login">
      <h1>Dashboard login</h1>
      <p className="sub">Missed Call Text-Back</p>
      {!passwordConfigured() && (
        <div className="notice bad">Set DASHBOARD_PASSWORD in your environment settings to enable login.</div>
      )}
      {error && <div className="notice bad">That password is not right.</div>}
      <form action={login} className="stack card pad">
        <label>
          Password
          <input type="password" name="password" autoFocus required />
        </label>
        <button className="btn" type="submit">Log in</button>
      </form>
    </main>
  );
}
