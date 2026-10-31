'use client';
import AudioEditor from './AudioEditor';
import FolderDescription from './FolderDescription';
import { templateBlocks, sectionHelp } from './sections';
import ScriptText from './ScriptText';
import ReferenceVideos, { type ReferenceVideo } from './ReferenceVideos';
import ReferenceEditor from './ReferenceEditor';
import {
  folders,
  folderId,
  subfolders,
  subfolderId,
  scriptFolderName,
  type FolderId,
  type SubfolderId,
} from './folders';
import RichTextEditor from './RichTextEditor';
import RichContent from './RichContent';
import { plainText } from './rich-text.js';
import { useState, useRef, useMemo, Fragment } from 'react';
import { Plus, ImagePlus, Trash2, FileText, Eye } from 'lucide-react';
import ScriptActions from './ScriptActions';
import ImageRef from './Images';
import { api, ApiError } from './api';
import { useScriptAutosave, type ScriptValue } from './useScriptAutosave';
import { useRealtime } from './realtime';
import { useEffect } from 'react';
import type { Block } from './data';
type EditableBlock = Block & { editorKey: string };
type Draft = {
  id: string;
  title: string;
  summary: string;
  notes: string;
  blocks: Block[];
  folder?: string;
  subfolder?: string;
  urgent?: boolean;
  references?: ReferenceVideo[];
  revision: number;
};
export default function Editor({
  author,
  initial,
  mode = 'draft',
  initialFolder = 'general',
  initialSubfolder = '',
}: {
  author: string;
  initial?: Draft;
  mode?: 'draft' | 'published';
  initialFolder?: FolderId;
  initialSubfolder?: SubfolderId;
}) {
  const [references, setReferences] = useState<ReferenceVideo[]>(
    initial?.references?.length ? initial.references : [{ label: '', url: '' }],
  );
  const [folder, setFolder] = useState<FolderId>(folderId(initial?.folder || initialFolder));
  const [subfolder, setSubfolder] = useState<SubfolderId>(
    subfolderId(initial ? initial.subfolder : initialSubfolder),
  );
  const [urgent, setUrgent] = useState(initial?.urgent === true);
  const [title, setTitle] = useState(initial?.title || '');
  const [summary, setSummary] = useState(initial?.summary || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [blocks, setBlocks] = useState<EditableBlock[]>(() =>
    templateBlocks(initial?.blocks).map((b) => ({ ...b, editorKey: crypto.randomUUID() })),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draftId, setDraftId] = useState(initial?.id);
  const [revision, setRevision] = useState(initial?.revision);
  const value = useMemo<ScriptValue>(() => ({
    title, summary, notes, folder, subfolder: folder === 'general' ? subfolder : '', urgent,
    references: references.map(r => ({ label: r.label.trim(), url: r.url.trim() })).filter(r => r.label || r.url),
    blocks: blocks.map(({ editorKey, ...block }) => block), status: mode,
  }), [title, summary, notes, folder, subfolder, urgent, references, blocks, mode]);
  const autosave = useScriptAutosave(value, { id: initial?.id, revision: initial?.revision }, busy || uploading, result => {
    setDraftId(result.id); setRevision(result.revision); setError('');
    if (mode === 'draft' && result.status === 'draft') history.replaceState(null, '', `/drafts/${result.id}`);
    if (mode === 'draft' && result.status === 'published') queueMicrotask(() => location.assign(`/scripts/${result.id}`));
  });
  const file = useRef<HTMLInputElement>(null);
  const outdated = autosave.state.phase === 'conflict';
  const live = useRealtime(mode === 'published' ? 'published' : 'draft', !!draftId);
  useEffect(() => {
    if (!draftId) return;
    let stopped = false;
    api<{ revision: number }>(`/api/scripts/${draftId}`)
      .then((current) => {
        if (!stopped) autosave.controller.current?.observeRemote(current.revision);
      })
      .catch(e => {
        if (!stopped && e instanceof ApiError && e.status === 404)
          autosave.controller.current?.pause('This script is no longer available. Your unsaved edits are still here.');
      });
    return () => {
      stopped = true;
    };
  }, [live.version, draftId, revision]);
  function update(i: number, b: EditableBlock) {
    setBlocks((v) => v.map((x, j) => (j === i ? b : x)));
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setUploading(true);
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
      const data = new FormData();
      data.append('image', f);
      const result = await api<{ id: string }>('/api/images', { method: 'POST', body: data });
      setBlocks((v) => [
        ...v,
        { type: 'image', assetId: result.id, caption: '', editorKey: crypto.randomUUID() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed. Try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }
  async function save(status: 'draft' | 'published') {
    setBusy(true); setError('');
    try {
      if (!autosave.controller.current?.getState().publishing) autosave.controller.current?.update(value);
      const result = await autosave.controller.current?.flush(status);
      if (result && status === 'published' && mode === 'published') location.assign(`/scripts/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save. Your changes are still in this editor.');
    } finally { setBusy(false); }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    await save('published');
  }
  return (
    <main className="editor">
      <a href={mode === 'published' ? `/scripts/${draftId}` : '/drafts'} className="back">
        {mode === 'published' ? 'Back to script' : 'Back to drafts'}
      </a>
      <div className="editor-heading">
        <div>
          <div className="eyebrow">COACH WORKSPACE</div>
          <h1>
            {mode === 'published' ? 'Edit published script' : 'Write something worth filming.'}
          </h1>
          <p>
            {mode === 'published'
              ? 'Editing published script'
              : draftId
                ? 'Editing shared draft'
                : 'Writing'}{' '}
            as {author}
          </p>
        </div>
        <button className="secondary" type="button" onClick={() => setPreview(!preview)}>
          <Eye size={17} />
          {preview ? 'Edit script' : 'Preview'}
        </button>
      </div>
      {draftId && (
        <div className="editor-manage">
          <ScriptActions
            id={draftId}
            title={initial?.title || title}
            revision={revision || 0}
            afterDelete={mode === 'published' ? '/' : '/drafts'}
            disabled={busy || uploading || autosave.state.dirty}
          />
        </div>
      )}
      {outdated && (
        <p className="notice" role="alert">
          Another coach changed this script, or it is no longer available. Your unsaved edits are
          still here.{' '}
          <a
            href={mode === 'published' ? `/scripts/${draftId}/edit` : `/drafts/${draftId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the latest version
          </a>{' '}
          to compare before saving.
        </p>
      )}
      <FolderDescription folder={folder} subfolder={subfolder} />
      <p className={`autosave-status autosave-${autosave.state.phase}`} role="status" aria-live="polite">
        {autosave.state.phase === 'idle' ? 'Start typing — your draft will save automatically.' :
          autosave.state.phase === 'saving' ? 'Saving…' :
          autosave.state.phase === 'saved' ? `All changes saved${autosave.state.savedAt ? ' · ' + new Date(autosave.state.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}` :
          autosave.state.phase === 'unsaved' ? 'Unsaved changes · autosave pending' :
          autosave.state.phase === 'conflict' ? 'Autosave paused — another coach changed this script. Your edits are still here.' :
          'Couldn’t autosave. Your changes are still in this editor.'}
        {autosave.state.phase === 'error' && <>
          <span className="autosave-error-detail">{autosave.state.message}</span>
          <button type="button" className="secondary" disabled={busy || uploading} onClick={() => save(mode)}>Retry save</button>
        </>}
      </p>
      <form onSubmit={publish}>
        <fieldset className="editor-fields" disabled={busy || autosave.state.publishing}>
        {preview ? (
          <div className="preview-paper">
            <span className="folder-label">{scriptFolderName(folder, subfolder)}</span>
            {urgent && <span className="urgent-badge">Urgent · pinned when published</span>}
            <h2>{title || 'Untitled script'}</h2>
            <ReferenceVideos references={references} />
            <RichContent value={summary} />
            {blocks.map((b, i) =>
              b.type === 'text' ? (
                <ScriptText key={b.editorKey} text={b.text} section={b.section} audio={b.audio} />
              ) : (
                <figure key={b.editorKey}>
                  <ImageRef id={b.assetId} caption={plainText(b.caption)} />
                  <figcaption>
                    <RichContent value={b.caption} />
                  </figcaption>
                </figure>
              ),
            )}
            {plainText(notes).trim() && (
              <aside className="notes">
                <div className="eyebrow">NOTES</div>
                <RichContent value={notes} />
              </aside>
            )}
          </div>
        ) : (
          <>
            <label className="field">
              Post to folder
              <select
                className="folder-select"
                value={folder}
                onChange={(e) => {
                  setFolder(folderId(e.target.value));
                  setSubfolder('');
                }}
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            {folder === 'general' && (
              <label className="field">
                Subfolder
                <select
                  className="folder-select"
                  value={subfolder}
                  onChange={(e) => setSubfolder(subfolderId(e.target.value))}
                >
                  <option value="">None — main StealthGPT Scripts folder</option>
                  {subfolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              Script title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                required
                placeholder="Give your script a clear title"
              />
            </label>
            <label className="urgent-option">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              <span>
                <strong>Mark as urgent</strong>
                <span className="field-help">
                  Pin this script above regular scripts when published. Uncheck to unpin it.
                </span>
              </span>
            </label>
            <ReferenceEditor value={references} onChange={setReferences} />
            <div className="field">
              Card description <span className="optional">Optional</span>
              <span className="field-help">
                A short introduction for the script card. Leave it blank to use an excerpt from the
                Script section.
              </span>
              <RichTextEditor
                label="Card description"
                value={summary}
                onChange={setSummary}
                maxLength={300}
                compact
              />
            </div>
            <div className="field">
              Script template
              <span className="field-help">
                Fill in the sections you need. Empty sections will be hidden in the published
                script.
              </span>
            </div>
            <div className="blocks">
              {blocks.map((b, i) => (
                <Fragment key={b.editorKey}>
                  {b.type === 'text' && b.section === 'Background' && (
                    <div className="field template-notes">
                      Notes <span className="optional">Optional</span>
                      <span className="field-help">
                        Filming tips, timing, tone, and other directions.
                      </span>
                      <RichTextEditor
                        label="Notes"
                        value={notes}
                        onChange={setNotes}
                        maxLength={5000}
                        compact
                      />
                    </div>
                  )}
                  <div className="block-editor">
                    <div className="block-toolbar">
                      <span>
                        {b.type === 'text' ? <FileText size={15} /> : <ImagePlus size={15} />}{' '}
                        <span className="template-section-label">
                          {b.type === 'text' ? b.section || 'Additional text' : 'Visual reference'}
                        </span>{' '}
                        <span className="block-number">{String(i + 1).padStart(2, '0')}</span>
                      </span>
                      {(b.type !== 'text' || !b.section) && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove block ${i + 1}`}
                          onClick={() => setBlocks((v) => v.filter((_, j) => j !== i))}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {b.type === 'text' ? (
                      <>
                        {b.section && <p className="section-help">{sectionHelp[b.section]}</p>}
                        {b.section === 'Audio' && (
                          <AudioEditor
                            value={b.audio}
                            onChange={(audio) => update(i, { ...b, audio })}
                          />
                        )}
                        {!(b.section === 'Audio' && b.audio?.mode === 'none') && (
                          <RichTextEditor
                            label={b.section || `Additional text ${i + 1}`}
                            value={b.text}
                            onChange={(value) => update(i, { ...b, text: value })}
                            maxLength={20000}
                            compact={b.section !== 'Script'}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <ImageRef
                          className="editor-image"
                          id={b.assetId}
                          caption={plainText(b.caption)}
                        />
                        <RichTextEditor
                          label={`Image caption ${i + 1}`}
                          value={b.caption}
                          onChange={(value) => update(i, { ...b, caption: value })}
                          maxLength={500}
                          compact
                        />
                      </>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="add-blocks">
              <button
                disabled={blocks.length >= 48 || uploading}
                className="secondary"
                type="button"
                onClick={() =>
                  setBlocks((v) => [
                    ...v,
                    { type: 'text', text: '', editorKey: crypto.randomUUID() },
                  ])
                }
              >
                <Plus size={17} />
                Add extra text
              </button>
              <button
                disabled={uploading || blocks.length >= 48}
                className="secondary"
                type="button"
                onClick={() => file.current?.click()}
              >
                <ImagePlus size={17} />
                {uploading ? 'Uploading…' : 'Upload image'}
              </button>
              <span>PNG, JPG, GIF or WebP · max 5 MB</span>
              <input
                type="file"
                ref={file}
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={upload}
              />
            </div>
          </>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="publish-bar">
          <p>
            {mode === 'published'
              ? 'Autosave is on. Your edits update the published script for everyone.'
              : 'Autosave is on. Drafts are shared with coaches. Use Publish script when ready.'}
          </p>
          <div className="save-actions">
            {mode === 'draft' && (
              <button
                className="secondary"
                type="button"
                disabled={busy || uploading || outdated}
                onClick={() => save('draft')}
              >
                {busy ? 'Saving…' : 'Save shared draft'}
              </button>
            )}
            <button className="button" type="submit" disabled={busy || uploading || outdated}>
              {busy ? 'Saving…' : mode === 'published' ? 'Save changes' : 'Publish script'}
            </button>
          </div>
        </div>
        </fieldset>
      </form>
    </main>
  );
}
