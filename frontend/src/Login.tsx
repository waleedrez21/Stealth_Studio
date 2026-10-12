import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
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
  if (code === 'auth/email-already-in-use')
    return 'This email already has an account. Sign in or reset your password.';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements')
    return 'Choose a stronger password with at least 6 characters.';
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
  const [creating, setCreating] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
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
  async function createAccount() {
    if (!auth) return;
    const teamEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@stealthgpt\.ai$/.test(teamEmail)) {
      setError('Use your @stealthgpt.ai work email to create a coach account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { user } = await createUserWithEmailAndPassword(auth, teamEmail, password);
      try {
        await sendEmailVerification(user);
      } catch {
        // The account exists even if delivery fails. The access screen offers a resend.
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
      <h1>{creating ? 'Create coach account' : 'Coach login'}</h1>
      <p>
        {creating
          ? 'Use your @stealthgpt.ai email. Verify it to unlock the coach workspace.'
          : 'Sign in with your work email or another email approved by your coaching lead.'}
      </p>
      {session.user && (
        <p className="notice">
          Signed in as {session.user.email}. {session.coach && <a href={returnTo}>Continue</a>}{' '}
          {!session.coach && <a href={returnTo}>Check coach access</a>}{' '}
          <button type="button" disabled={busy} onClick={() => auth && signOut(auth)}>
            Sign out
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void (creating ? createAccount() : login());
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
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={creating ? 6 : undefined}
            disabled={busy}
          />
        </label>
        {creating && (
          <label className="field">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
        )}
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
          {busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
        </button>
        {!creating && (
          <button className="password-reset" type="button" disabled={busy} onClick={reset}>
            Set or reset password
          </button>
        )}
        <button
          className="password-reset"
          type="button"
          disabled={busy}
          onClick={() => {
            setCreating(!creating);
            setError('');
            setNotice('');
            setPassword('');
            setConfirmPassword('');
          }}
        >
          {creating
            ? 'Already have an account? Sign in'
            : 'Have a @stealthgpt.ai email? Create account'}
        </button>
      </form>
      <p className="field-help">
        Verified @stealthgpt.ai accounts get coach access automatically. Other emails need an
        account and approval from your coaching lead.
      </p>
      <a className="back" href="/">
        Back to scripts
      </a>
    </main>
  );
}
