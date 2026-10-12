import { cardSummary } from './sections';
import ScriptText from './ScriptText';
import ReferenceVideos from './ReferenceVideos';
import FolderNav from './FolderNav';
import { selectedFolder, folderId, folderName } from './folders';
import RichContent from './RichContent';
import { plainText } from './rich-text.js';
import { useEffect, useState, lazy, Suspense } from 'react';
import { FileText, CalendarDays, FilePenLine } from 'lucide-react';
import Shell from './Shell';
import { api } from './api';
import { samples, dateLabel, type Script } from './data';
import { useRealtime } from './realtime';
import { useSession } from './session';
import CoachGate from './CoachGate';
import Login from './Login';
import ScriptActions from './ScriptActions';
import ImageRef from './Images';
import NewBadge from './NewBadge';
const Editor = lazy(() => import('./Editor'));
const PotentialVideos = lazy(() => import('./PotentialVideos'));
const ideaRequest = (path: string, options: RequestInit = {}) =>
  api(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
type Record = Script & {
  status: 'draft' | 'published';
  revision: number;
  updatedAt: string;
  updatedBy?: string;
};
function useLoad<T>(path: string, version = 0, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError('');
    api<T>(path)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Couldn’t load this page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version, enabled]);
  return { data, error, loading };
}
function Card({
  s,
  draft = false,
}: {
  s: Script & { updatedAt?: string; updatedBy?: string };
  draft?: boolean;
}) {
  return (
    <a className="script-card" href={draft ? `/drafts/${s.id}` : `/scripts/${s.id}`}>
      <div className="card-top">
        <span className="file-icon">
          {draft ? <FilePenLine size={22} /> : <FileText size={22} />}
        </span>
        {draft ? (
          <span className="sample-tag">DRAFT</span>
        ) : s.sample ? (
          <span className="sample-tag">SAMPLE</span>
        ) : (
          <NewBadge date={s.createdAt} />
        )}
      </div>
      <span className="folder-label">{folderName(s.folder)}</span>
      <h2>{s.title || 'Untitled script'}</h2>
      <p>{cardSummary(s) || (draft ? 'This script is a work in progress.' : '')}</p>
      {draft && <div className="draft-author">Last saved by {s.updatedBy || s.author}</div>}
      <div className="card-bottom">
        <span>
          <CalendarDays size={14} />
          {dateLabel(draft ? s.updatedAt || s.createdAt : s.createdAt)}
        </span>
        <span className="open-label">{draft ? 'Edit draft' : 'Read script'}</span>
      </div>
    </a>
  );
}
function Library() {
  const active = selectedFolder(new URLSearchParams(location.search).get('folder'));
  const live = useRealtime('published');
  const { data, error, loading } = useLoad<Record[]>('/api/scripts', live.version);
  const records = data || [];
  const visible = active === 'all' ? records : records.filter((s) => folderId(s.folder) === active);
  if (active === 'first-10') visible.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <main className="library">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE CREATOR LIBRARY</div>
          <h1>Good videos start here.</h1>
          <p>Your next script, all in one place.</p>
        </div>
        <span className="count">
          {visible.length} {visible.length === 1 ? 'script' : 'scripts'}
        </span>
      </div>
      <FolderNav records={records} active={active} />
      {active !== 'all' && (
        <div className="folder-selection">
          <h2>{folderName(active)}</h2>
          <a href={`/post?folder=${active}`}>Post to this folder</a>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error} <button onClick={() => location.reload()}>Try again</button>
        </p>
      )}
      {live.error && <p className="realtime-notice">{live.error}</p>}
      {loading ? (
        <p className="loading">Loading scripts…</p>
      ) : !error && visible.length ? (
        <div className="grid">
          {visible.map((s) => (
            <Card key={s.id} s={s} />
          ))}
        </div>
      ) : !error && active !== 'all' ? (
        <div className="empty-banner">
          <FileText size={23} />
          <div>
            <strong>No scripts in this folder yet.</strong>
            <p>Coaches can choose this folder when posting a script.</p>
          </div>
        </div>
      ) : !error ? (
        <>
          <div className="empty-banner">
            <FileText size={23} />
            <div>
              <strong>Your library is ready for its first script.</strong>
              <p>Approved coaches can publish using Post script.</p>
            </div>
          </div>
          <div className="section-title">
            <h2>Take a look around</h2>
            <span>Example scripts · for preview</span>
          </div>
          <div className="grid">
            {samples.map((s) => (
              <Card key={s.id} s={s} />
            ))}
          </div>
        </>
      ) : null}
      <div className="library-footer">
        <span className="line" />
        <span>Made by Waleed Shammarez</span>
        <span className="line" />
      </div>
    </main>
  );
}
function Drafts() {
  const active = selectedFolder(new URLSearchParams(location.search).get('folder'));
  const { coach } = useSession();
  const live = useRealtime('draft', coach);
  const { data, error, loading } = useLoad<Record[]>('/api/drafts', live.version, coach);
  const records = data || [];
  const visible = active === 'all' ? records : records.filter((s) => folderId(s.folder) === active);
  return (
    <CoachGate>
      <main className="library">
        <div className="page-heading">
          <div>
            <div className="eyebrow">COACH WORKSPACE</div>
            <h1>Script drafts</h1>
            <p>A shared space to shape scripts before they go live.</p>
          </div>
          <span className="count">{visible.length} drafts</span>
        </div>
        <FolderNav records={records} active={active} base="/drafts" />
        {active !== 'all' && (
          <div className="folder-selection">
            <h2>{folderName(active)}</h2>
            <a href={`/post?folder=${active}`}>Start a draft here</a>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {live.error && <p className="realtime-notice">{live.error}</p>}
        {loading ? (
          <p>Loading drafts…</p>
        ) : visible.length ? (
          <div className="grid">
            {visible.map((s) => (
              <Card key={s.id} s={s} draft />
            ))}
          </div>
        ) : !error ? (
          <div className="empty-banner">
            <FilePenLine size={24} />
            <div>
              <strong>No drafts here yet.</strong>
              <p>Start a script and choose Save draft. Every approved coach can help edit it.</p>
              <a className="button" href="/post" style={{ marginTop: 14 }}>
                Create a script
              </a>
            </div>
          </div>
        ) : null}
        <p className="draft-privacy">
          Drafts are visible only to approved coaches. Publishing makes a script available to
          everyone.
        </p>
      </main>
    </CoachGate>
  );
}
function Body({ s }: { s: Script }) {
  return (
    <>
      <ReferenceVideos references={s.references} />
      <RichContent className="reader-summary" value={s.summary} />
      <a className="reader-folder" href={`/?folder=${folderId(s.folder)}`}>
        {folderName(s.folder)}
      </a>
      <div className="script-body">
        {s.blocks.map((b, i) =>
          b.type === 'text' ? (
            <ScriptText key={i} text={b.text} section={b.section} audio={b.audio} />
          ) : (
            <figure key={i}>
              <ImageRef id={b.assetId} caption={plainText(b.caption)} />
              {b.caption && (
                <figcaption>
                  <RichContent value={b.caption} />
                </figcaption>
              )}
            </figure>
          ),
        )}
      </div>
      {plainText(s.notes).trim() && (
        <aside className="notes">
          <div className="eyebrow">NOTES</div>
          <RichContent value={s.notes} />
        </aside>
      )}
    </>
  );
}
function Reader({ id }: { id: string }) {
  const sample = samples.find((s) => s.id === id);
  const live = useRealtime('published', !sample);
  const { data, error, loading } = useLoad<Record>(`/api/scripts/${id}`, live.version, !sample);
  const { coach } = useSession();
  const s = sample || data;
  return (
    <main className="reader">
      <a className="back" href="/">
        Back to scripts
      </a>
      {!sample && error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : !s ? (
        <p>{loading ? 'Loading script…' : 'Script unavailable.'}</p>
      ) : (
        <>
          <div className="reader-tools">
            <div className="eyebrow">{s.sample ? 'SAMPLE SCRIPT' : 'CREATOR SCRIPT'}</div>
            {coach && !s.sample && (
              <ScriptActions
                id={s.id}
                title={s.title}
                revision={s.revision || 0}
                editHref={`/scripts/${id}/edit`}
              />
            )}
          </div>
          <h1>{s.title}</h1>
          <div className="byline">
            Posted {dateLabel(s.createdAt)} <span>·</span>
            {s.author}
          </div>
          <Body s={s} />
        </>
      )}
    </main>
  );
}
function Edit({ id, mode }: { id: string; mode: 'draft' | 'published' }) {
  const { coach, user } = useSession();
  const { data, error, loading } = useLoad<Record>(`/api/scripts/${id}`, 0, coach);
  return (
    <CoachGate>
      {error ? (
        <main className="reader">
          <a className="back" href={mode === 'draft' ? '/drafts' : '/'}>
            Back to scripts
          </a>
          <p className="notice error" role="alert">
            {error}
          </p>
        </main>
      ) : loading || !data ? (
        <main className="reader">Loading script…</main>
      ) : data.status !== mode ? (
        <main className="reader">
          <p>
            This script is now {data.status}. <a href={`/scripts/${id}`}>Open script</a>
          </p>
        </main>
      ) : (
        <Editor author={user?.displayName || user?.email || 'Coach'} mode={mode} initial={data} />
      )}
    </CoachGate>
  );
}
function NewScript() {
  const { user } = useSession();
  return (
    <CoachGate>
      <Editor
        initialFolder={folderId(new URLSearchParams(location.search).get('folder'))}
        author={user?.displayName || user?.email || 'Coach'}
      />
    </CoachGate>
  );
}
export default function App() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  let page: React.ReactNode;
  if (path === '/') page = <Library />;
  else if (path === '/drafts') page = <Drafts />;
  else if (path === '/ideas')
    page = (
      <CoachGate>
        <PotentialVideos request={ideaRequest} />
      </CoachGate>
    );
  else if (path === '/post') page = <NewScript />;
  else if (path === '/login') page = <Login />;
  else if (/^\/scripts\/[^/]+\/edit$/.test(path))
    page = <Edit id={path.split('/')[2]} mode="published" />;
  else if (/^\/drafts\/[^/]+$/.test(path)) page = <Edit id={path.split('/')[2]} mode="draft" />;
  else if (/^\/scripts\/[^/]+$/.test(path)) page = <Reader id={path.split('/')[2]} />;
  else
    page = (
      <main className="reader">
        <h1>Page not found</h1>
        <a href="/">Back to scripts</a>
      </main>
    );
  return (
    <Shell>
      <Suspense fallback={<main className="reader">Loading editor…</main>}>{page}</Suspense>
    </Shell>
  );
}
