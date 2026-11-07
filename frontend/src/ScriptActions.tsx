import { useRef, useState } from 'react';
import { Pencil, Trash2, Archive, ArchiveRestore, FilePenLine } from 'lucide-react';
import { api } from './api';
export default function ScriptActions({
  id,
  title,
  revision,
  editHref,
  afterDelete = '/',
  disabled = false,
  archived,
  canMoveToDraft = false,
}: {
  id: string;
  title: string;
  revision: number;
  editHref?: string;
  afterDelete?: string;
  disabled?: boolean;
  archived?: boolean;
  canMoveToDraft?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const draftDialog = useRef<HTMLDialogElement>(null);
  const [draftError, setDraftError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [archiveError, setArchiveError] = useState('');
  async function changeArchive() {
    setBusy(true);
    setArchiveError('');
    try {
      const result = await api<{status: string}>(`/api/scripts/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, archived: !archived }),
      });
      location.assign(archived ? result.status === 'draft' ? `/drafts/${id}` : `/scripts/${id}` : '/archive');
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : 'Couldn’t update the archive. Try again.');
      setBusy(false);
    }
  }
  async function moveToDraft() {
    setBusy(true);
    setDraftError('');
    try {
      await api(`/api/scripts/${id}/unpublish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      });
      location.assign(`/drafts/${id}`);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Couldn’t move this script to drafts. Try again.');
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/scripts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision }),
      });
      location.assign(afterDelete);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete. Try again.');
      setBusy(false);
    }
  }
  return (
    <div className="script-actions">
      {canMoveToDraft && (
        <>
          <button
            type="button"
            className="secondary"
            disabled={disabled || busy}
            onClick={() => {
              setDraftError('');
              draftDialog.current?.showModal();
            }}
          >
            <FilePenLine size={16} />
            Move to drafts
          </button>
          <dialog
            ref={draftDialog}
            className="delete-dialog"
            aria-labelledby="move-to-drafts-title"
            onCancel={(e) => { if (busy) e.preventDefault(); }}
          >
            <h2 id="move-to-drafts-title">Move this script to drafts?</h2>
            <p>
              <strong>{title}</strong> will be hidden from the public library. Coaches can keep
              editing it in Drafts and publish it again when it’s ready.
            </p>
            {draftError && <p className="notice error" role="alert">{draftError}</p>}
            <div className="dialog-actions">
              <button type="button" autoFocus className="secondary" disabled={busy} onClick={() => draftDialog.current?.close()}>
                Cancel
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={moveToDraft}>
                {busy ? 'Moving…' : 'Move to drafts'}
              </button>
            </div>
          </dialog>
        </>
      )}
      {archived !== undefined && (
        <button type="button" className="secondary" disabled={disabled || busy} onClick={changeArchive}>
          {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          {busy ? 'Saving…' : archived ? 'Restore script' : 'Archive script'}
        </button>
      )}
      {archiveError && <p className="notice error" role="alert">{archiveError}</p>}
      {editHref && (
        <a className="secondary" href={editHref}>
          <Pencil size={16} />
          Edit script
        </a>
      )}
      <button
        className="delete-button"
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        <Trash2 size={16} />
        Delete script
      </button>
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby="delete-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2 id="delete-title">Delete this script?</h2>
        <p>
          <strong>{title || 'Untitled script'}</strong> will be removed from the script library and
          team drafts.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            autoFocus
            className="secondary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button type="button" className="delete-confirm" disabled={busy} onClick={remove}>
            {busy ? 'Deleting…' : 'Delete script'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
