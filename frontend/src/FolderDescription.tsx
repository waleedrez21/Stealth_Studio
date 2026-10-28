import { useEffect, useId, useState } from 'react';
import { api } from './api';
import { useSession } from './session';
import { folderId, subfolderId, scriptFolderName } from './folders';

const studySimDefault =
  'These scripts are for Study Sim only. Do not use them to promote StealthGPT: studying, flashcards and quizzes are Study Sim features.';
type Description = { description: string; revision: number };

export default function FolderDescription({ folder, subfolder = '', editable = false }: {
  folder: string; subfolder?: string; editable?: boolean;
}) {
  const parent = folderId(folder);
  const child = parent === 'general' ? subfolderId(subfolder) : '';
  const id = child ? `${parent}--${child}` : parent;
  return <DescriptionPanel key={id} id={id} name={scriptFolderName(parent, child)} editable={editable} />;
}

function DescriptionPanel({ id, name, editable }: { id: string; name: string; editable: boolean }) {
  const { coach } = useSession();
  const labelId = useId();
  const isStudySim = id === 'study-sim';
  const [value, setValue] = useState<Description>({ description: isStudySim ? studySimDefault : '', revision: 0 });
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const path = `/api/folders/${id}/description`;
  useEffect(() => {
    let cancelled = false;
    setError('');
    api<Description>(path).then(result => {
      if (!cancelled) { setValue(result); setLoaded(true); }
    }).catch(() => {
      if (!cancelled) setError('Couldn’t load the saved description. Try again.');
    });
    return () => { cancelled = true; };
  }, [path, retry]);

  async function save() {
    setBusy(true); setError('');
    try {
      const result = await api<Description>(path, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, revision: value.revision }),
      });
      setValue(result); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save the description.'); }
    finally { setBusy(false); }
  }

  if (!isStudySim && !value.description && !(editable && coach)) return null;
  return <aside className="study-sim-guidance" aria-label={`${name} guidance`}>
    <strong>{isStudySim ? 'Study Sim only' : 'Folder description'}</strong>
    {isStudySim && <p>Use these scripts to promote Study Sim, not StealthGPT.</p>}
    {editing && coach ? <div className="folder-description-editor">
      <label htmlFor={labelId}>Short folder description</label>
      <textarea id={labelId} value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3} disabled={busy} />
      <div className="save-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
        <button type="button" className="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save description'}</button>
      </div>
    </div> : <>
      {value.description ? <p className="folder-description">{value.description}</p> : editable && coach && <p>Add a short note to guide creators using this folder.</p>}
      {editable && coach && <button type="button" className="secondary" disabled={!loaded} onClick={() => {
        setText(value.description); setEditing(true); setError('');
      }}>{value.description ? 'Edit description' : 'Add description'}</button>}
    </>}
    {error && editable && coach && <div role="alert"><p>{error}</p>
      <button type="button" className="secondary" disabled={busy} onClick={() => {
        setEditing(false); setLoaded(false); setRetry(v => v + 1);
      }}>Reload description</button>
    </div>}
  </aside>;
}
