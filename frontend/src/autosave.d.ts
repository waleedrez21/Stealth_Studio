export type SaveResult = { id: string; revision: number; status: 'draft' | 'published' };
export type AutosaveState = {
  phase: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';
  message: string;
  savedAt: number | null;
  id?: string;
  revision?: number;
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
};
export type SaveRequest<T> = {
  id?: string;
  revision?: number;
  creationId?: string;
  requestId: string;
  payload: T;
};
export type AutosaveController<T> = {
  update(value: T): void;
  flush(status?: 'draft' | 'published'): Promise<SaveResult | null>;
  pause(message?: string): void;
  getState(): AutosaveState;
  setEnabled(value: boolean): void;
  observeRemote(revision: number): void;
  dispose(): void;
};
export function createScriptAutosave<T extends { status: 'draft' | 'published' }>(options: {
  initialValue: T;
  initialId?: string;
  initialRevision?: number;
  creationId: string;
  makeRequestId(): string;
  canCreate(value: T): boolean;
  write(request: SaveRequest<T>): Promise<SaveResult>;
  onChange(state: AutosaveState): void;
  onSaved(result: SaveResult, value: T): void;
}): AutosaveController<T>;
