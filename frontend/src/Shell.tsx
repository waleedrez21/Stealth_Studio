import { Clapperboard, Files, FilePenLine, Plus, LockKeyhole, Video } from 'lucide-react';
import { useSession } from './session';
export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, coach, logout } = useSession();
  const drafts = location.pathname.startsWith('/drafts');
  const ideas = location.pathname.startsWith('/ideas');
  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brandmark">
            <Clapperboard size={21} />
          </span>
          Stealth Studio
        </a>
        <div className="side-label">CREATOR WORKSPACE</div>
        <a className={drafts || ideas ? 'nav' : 'nav active'} href="/">
          <Files size={19} />
          Scripts{!drafts && !ideas && <span className="nav-marker" />}
        </a>
        <a className={drafts ? 'nav active' : 'nav'} href="/drafts">
          <FilePenLine size={19} />
          Script drafts{drafts && <span className="nav-marker" />}
        </a>
        <a className={ideas ? 'nav active' : 'nav'} href="/ideas">
          <Video size={19} />
          Potential videos
        </a>
        <div className="side-bottom">
          <LockKeyhole size={18} />
          <div>
            {user ? (coach ? 'Coach account' : 'Signed in') : 'Creator workspace'}
            <small>{user?.email || 'Made by Waleed Shammarez'}</small>
            {user && (
              <button type="button" className="logout" onClick={logout}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span>
            <strong>{ideas ? 'Potential videos' : drafts ? 'Drafts' : 'Scripts'}</strong>
          </span>
          <div className="header-actions">
            {user && (
              <button type="button" className="mobile-logout" onClick={logout}>
                Sign out
              </button>
            )}
            <a className="button" href="/post">
              <Plus size={17} />
              Post script
            </a>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
