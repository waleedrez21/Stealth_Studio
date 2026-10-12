import { LockKeyhole } from 'lucide-react';
import { useSession } from './session';
import { sendEmailVerification } from 'firebase/auth';
import { useState, useEffect } from 'react';
export default function CoachGate({ children }: { children: React.ReactNode }) {
  const { user, coach, loading, error } = useSession();
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!loading && !user)
      location.replace(
        `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`,
      );
  }, [loading, user]);
  async function verify() {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setNotice('Verification email sent. Open the link, then choose I have verified my email.');
    } catch {
      setNotice('Couldn’t send verification. Please wait and try again.');
    }
  }
  async function recheck() {
    if (!user) return;
    await user.reload();
    await user.getIdToken(true);
    location.reload();
  }
  if (loading)
    return (
      <main className="access-panel">
        <p>Checking coach access…</p>
      </main>
    );
  if (coach) return children;
  return (
    <main className="access-panel">
      <span className="access-icon">
        <LockKeyhole size={28} />
      </span>
      <div className="eyebrow">COACH ACCESS</div>
      <h1>{user ? 'Coach access required.' : 'Sign in to work on scripts.'}</h1>
      <p>
        {user
          ? `Signed in as ${user.email}. Verify your @stealthgpt.ai email, or use an email approved by your coaching lead.`
          : 'Sign in as an approved coach to post scripts and work on your team’s drafts.'}
      </p>
      {user && !user.emailVerified && (
        <div className="verification">
          <p>Verify your email to enable coach access.</p>
          <button className="secondary" type="button" onClick={verify}>
            Send verification email
          </button>
          <button className="secondary" type="button" onClick={recheck}>
            I have verified my email
          </button>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <a className="button" href={`/login?returnTo=${encodeURIComponent(location.pathname)}`}>
        {user ? 'Switch account' : 'Coach sign in'}
      </a>
      <a href="/" className="back">
        Back to scripts
      </a>
    </main>
  );
}
