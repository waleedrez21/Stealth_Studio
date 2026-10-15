import { useEffect, useRef, useState } from 'react';
import { Ellipsis, Pin, PinOff } from 'lucide-react';
import { api } from './api';
import type { Script } from './data';

export default function ScriptCardMenu({ script, onChange }: { script: Script; onChange: () => void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false;
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  async function togglePin() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/scripts/${script.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgent: !script.urgent, revision: script.revision }),
      });
      onChange();
      if (menu.current) menu.current.open = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t update the pin. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return <details ref={menu} className="script-card-menu" onKeyDown={event => {
    if (event.key === 'Escape' && menu.current) {
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    }
  }}>
    <summary aria-label={`Options for ${script.title}`} title="Script options"><Ellipsis size={22}/></summary>
    <div className="script-card-dropdown">
      <button type="button" disabled={busy} onClick={togglePin}>
        {script.urgent ? <PinOff size={17}/> : <Pin size={17}/>}
        {busy ? 'Saving…' : script.urgent ? 'Unpin script' : 'Pin script'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
