import { useEffect, useState } from 'react';
import { api } from './api';
import { useSession } from './session';

const defaultDescription =
  'These scripts are for Study Sim only. Do not use them to promote StealthGPT: studying, flashcards and quizzes are Study Sim features.';
type Description = { description: string; revision: number };

export default function StudySimGuidance({ editable = false }: { editable?: boolean }) {
  const { coach } = useSession();
  const [value, setValue] = useState<Description>({ description: defaultDescription, revision: 0 });
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<Description>('/api/folders/study-sim/description').then(result => {
      if (!cancelled) { setValue(result); setLoaded(true); }
    }).catch(() => {
      if (!cancelled) setError('Couldn’t load the saved description. Reload this page to try again.');
    });
    return () => { cancelled = true; };
  }, []);
  async function save() {
    setBusy(true); setError('');
    try {
      const result = await api<Description>('/api/folders/study-sim/description', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, revision: value.revision }),
      });
      setValue(result); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save the description.'); }
    finally { setBusy(false); }
  }
  return <aside className="study-sim-guidance" aria-label="Study Sim script guidance">
    <strong>Study Sim only</strong>
    <p>Use these scripts to promote Study Sim, not StealthGPT.</p>
    {editing && coach ? <div className="folder-description-editor">
      <label htmlFor="study-sim-description">Short folder description</label>
      <textarea id="study-sim-description" value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} disabled={busy} />
      <div className="save-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        <button type="button" className="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save description'}</button>
      </div>
    </div> : <>
      {value.description && <p className="folder-description">{value.description}</p>}
      {editable && coach && <button type="button" className="secondary" disabled={!loaded} onClick={() => {
        setText(value.description); setEditing(true); setError('');
      }}>Edit description</button>}
    </>}
    {error && editable && coach && <p role="alert">{error}</p>}
  </aside>;
}
