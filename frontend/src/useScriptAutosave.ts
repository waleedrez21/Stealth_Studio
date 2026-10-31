import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { plainText } from './rich-text.js';
import { createScriptAutosave, type AutosaveState, type AutosaveController, type SaveResult } from './autosave.js';
import type { Block } from './data';

export type ScriptValue = {
  title: string; summary: string; notes: string; folder: string; subfolder: string;
  urgent: boolean; references: { label: string; url: string }[]; blocks: Block[];
  status: 'draft' | 'published';
};
function hasContent(value: ScriptValue) {
  return !!(value.title.trim() || plainText(value.summary).trim() || plainText(value.notes).trim() ||
    value.references.some(r => r.label || r.url) || value.blocks.some(b => b.type === 'image' ||
      plainText(b.text).trim() || b.audio?.url));
}

export function useScriptAutosave(value: ScriptValue, initial: { id?: string; revision?: number },
  paused: boolean, onSaved: (result: SaveResult) => void) {
  const controller = useRef<AutosaveController<ScriptValue> | null>(null);
  const baseline = useRef({ value, ...initial });
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  const [state, setState] = useState<AutosaveState>({
    phase: initial.id ? 'saved' : 'idle', message: '', savedAt: null,
    ...initial, dirty: false, saving: false, publishing: false,
  });
  useEffect(() => {
    const original = baseline.current;
    const writer = createScriptAutosave({
      initialValue: original.value, initialId: original.id, initialRevision: original.revision,
      creationId: crypto.randomUUID(), makeRequestId: () => crypto.randomUUID(), canCreate: hasContent,
      write: request => api<SaveResult>(request.id ? `/api/scripts/${request.id}` : '/api/scripts', {
        method: request.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request.payload, revision: request.revision,
          creationId: request.creationId, requestId: request.requestId }),
      }),
      onChange: setState, onSaved: result => savedCallback.current(result),
    });
    controller.current = writer;
    return () => { writer.dispose(); if (controller.current === writer) controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.update(value); }, [value]);
  useEffect(() => { controller.current?.setEnabled(!paused); }, [paused]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!controller.current?.getState().dirty) return;
      event.preventDefault(); event.returnValue = '';
    }
    function retry() {
      const writer = controller.current;
      if (!paused && writer?.getState().dirty) writer.flush().catch(() => {});
    }
    function hidden() { if (document.visibilityState === 'hidden') retry(); }
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [paused]);
  return { state, controller };
}
