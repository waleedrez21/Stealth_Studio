import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, configured } from './firebase';
import { useSession } from './session';
import { api } from './api';
function message(e: unknown) {
  const code = (e as { code?: string })?.code;
  if (
    [
      'auth/invalid-credential',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-email',
    ].includes(code || '')
  )
    return 'Check your email and password.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
  if (code === 'auth/user-disabled') return 'This account is disabled. Contact your coaching lead.';
  if (code === 'auth/operation-not-allowed')
    return 'Email and password sign-in has not been enabled yet.';
  return 'Could not sign in. Please try again.';
}
export default function Login() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  let returnTo = new URLSearchParams(location.search).get('returnTo') || '/post';
  if (
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.startsWith('/login') ||
    returnTo.includes('\\')
  )
    returnTo = '/post';
  async function login() {
    if (!auth) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const account = await api<{ approved: boolean; coach: boolean }>('/api/me');
      if (!account.approved) {
        await signOut(auth);
        setError('This email has not been approved for coach access. Contact your coaching lead.');
        return;
      }
      location.assign(returnTo);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!auth || !email.trim()) {
      setError('Enter your coach email first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('If this email has an account, a password reset link has been sent.');
    } catch {
      setError('Could not send the reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!configured)
    return (
      <main className="access-panel">
        <h1>Coach login is being set up.</h1>
        <p>Please check back once your coaching lead has finished setting up accounts.</p>
        <a className="back" href="/">
          Back to scripts
        </a>
      </main>
    );
  return (
    <main className="login-panel">
      <div className="eyebrow">COACH ACCESS</div>
      <h1>Coach login</h1>
      <p>Use your approved email and password to post scripts and work on shared drafts.</p>
      {session.user && (
        <p className="notice">
          Signed in as {session.user.email}. {session.coach && <a href={returnTo}>Continue</a>}{' '}
          <button type="button" onClick={() => auth && signOut(auth)}>
            Sign out
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
      >
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="save-success" role="status">
            {notice}
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy ? 'Please wait…' : 'Sign in'}
        </button>
        <button className="password-reset" type="button" disabled={busy} onClick={reset}>
          Set or reset password
        </button>
      </form>
      <p className="field-help">Coach accounts are created and approved by your coaching lead.</p>
      <a className="back" href="/">
        Back to scripts
      </a>
    </main>
  );
}
