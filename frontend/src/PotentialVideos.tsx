'use client';
import { useEffect, useState } from 'react';
import RichTextEditor from './RichTextEditor';
import RichContent from './RichContent';
import { plainText } from './rich-text.js';
export type Idea = {
  id: string;
  title: string;
  url: string;
  thoughts: string;
  author: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
async function localRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete this request.');
  return data;
}
export default function PotentialVideos({
  request = localRequest,
}: {
  request?: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Idea | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  async function load() {
    try {
      setIdeas(await request('/api/ideas'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ideas.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [request]);
  function clear() {
    setEdit(null);
    setTitle('');
    setUrl('');
    setThoughts('');
  }
  function start(idea: Idea) {
    setEdit(idea);
    setTitle(idea.title);
    setUrl(idea.url);
    setThoughts(idea.thoughts);
    setNotice('');
    setError('');
    document.getElementById('idea-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const link = new URL(url.trim());
      if (!['https:', 'http:'].includes(link.protocol))
        throw new Error('Use an http:// or https:// video link.');
      await request(edit ? '/api/ideas/' + edit.id : '/api/ideas', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: title.trim(),
          url: link.href,
          thoughts,
          revision: edit?.revision,
        }),
      });
      clear();
      setNotice(edit ? 'Idea updated.' : 'Video idea saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this idea.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(idea: Idea) {
    setBusy(true);
    setError('');
    try {
      await request('/api/ideas/' + idea.id, {
        method: 'DELETE',
        body: JSON.stringify({ revision: idea.revision }),
      });
      if (edit?.id === idea.id) clear();
      setDeleting(null);
      setNotice('Idea deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this idea.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="library">
      <div className="page-heading">
        <div>
          <div className="eyebrow">COACH WORKSPACE</div>
          <h1>Potential videos</h1>
          <p>Save inspiration links and share your thoughts before writing a script.</p>
        </div>
        <span className="count">{ideas.length} ideas</span>
      </div>
      <form
        className="idea-form"
        id="idea-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2>{edit ? 'Edit video idea' : 'Add a video idea'}</h2>
        <label className="field">
          Title <span className="optional">Optional</span>
          <input
            value={title}
            maxLength={150}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            placeholder="A hook or angle to explore"
          />
        </label>
        <label className="field">
          Video link
          <input
            type="url"
            value={url}
            maxLength={2048}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            required
            placeholder="https://www.instagram.com/reel/..."
          />
        </label>
        <div className="field">
          Thoughts <span className="optional">Optional</span>
          <span className="field-help">
            What works, what you would change, or how this could become a script.
          </span>
          <RichTextEditor
            value={thoughts}
            onChange={setThoughts}
            label="Thoughts about this video"
            maxLength={5000}
            compact
          />
        </div>
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
        <div className="save-actions">
          <button className="button" disabled={busy} type="submit">
            {busy ? 'Saving…' : edit ? 'Save changes' : 'Save video idea'}
          </button>
          {edit && (
            <button type="button" className="secondary" disabled={busy} onClick={clear}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      {loading ? (
        <p>Loading video ideas…</p>
      ) : ideas.length ? (
        <div className="ideas-grid">
          {ideas.map((idea) => (
            <article className="idea-card" key={idea.id}>
              <h2>{idea.title || 'Video inspiration'}</h2>
              <a className="idea-link" href={idea.url} target="_blank" rel="noopener noreferrer">
                Open reference video<span>{idea.url}</span>
              </a>
              {plainText(idea.thoughts).trim() && (
                <div className="idea-thoughts">
                  <h3>Coach thoughts</h3>
                  <RichContent value={idea.thoughts} />
                </div>
              )}
              <p className="idea-meta">
                Added by {idea.author} · {new Date(idea.createdAt).toLocaleDateString('en-CA')}
                <br />
                Last saved by {idea.updatedBy}
              </p>
              <div className="script-actions">
                {deleting === idea.id ? (
                  <>
                    <span>Delete this idea?</span>
                    <button
                      className="delete-confirm"
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(idea)}
                    >
                      Delete
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleting(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => start(idea)}
                    >
                      Edit idea
                    </button>
                    <button
                      className="delete-button"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleting(idea.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-banner">
          <div>
            <strong>No video ideas yet.</strong>
            <p>Add a reference link above to start the conversation.</p>
          </div>
        </div>
      )}
      <p className="draft-privacy">
        Only approved coaches can view or edit these ideas. They are separate from script drafts.
      </p>
    </main>
  );
}
