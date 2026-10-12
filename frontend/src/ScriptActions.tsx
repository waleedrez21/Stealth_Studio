import { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
export default function ScriptActions({
  id,
  title,
  revision,
  editHref,
  afterDelete = '/',
  disabled = false,
}: {
  id: string;
  title: string;
  revision: number;
  editHref?: string;
  afterDelete?: string;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      {editHref && (
        <a className="secondary" href={editHref}>
          <Pencil size={16} />
          Edit script
        </a>
      )}
      <button
        className="delete-button"
        type="button"
        disabled={disabled}
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
