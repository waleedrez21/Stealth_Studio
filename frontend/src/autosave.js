// One writer per editor. Pending requests keep their IDs and payloads until acknowledged.
export function createScriptAutosave(options) {
  const clock = options.clock || {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (timer) => clearTimeout(timer),
  };
  const delay = options.delay ?? 2000;
  const maxWait = options.maxWait ?? 10000;
  const minGap = options.minGap ?? 3000;
  let latest = structuredClone(options.initialValue);
  let savedKey = JSON.stringify(latest);
  let id = options.initialId;
  let revision = options.initialRevision;
  let lastResult = id ? { id, revision, status: latest.status } : null;
  let phase = id ? 'saved' : 'idle';
  let message = '';
  let savedAt = null;
  let timer, flight = null, pending = null;
  let disposed = false, enabled = true, blocked = false, suspended = false;
  let needsEdit = false, retryAt = 0, dirtySince = null, lastStart = -Infinity;
  let remoteRevision = revision ?? -1;
  const hasContent = () => !!id || options.canCreate(latest);
  const changed = () => JSON.stringify(latest) !== savedKey;
  const state = () => ({ phase, message, savedAt, id, revision,
    dirty: !!flight || !!pending || (hasContent() && changed()), saving: !!flight,
    publishing: !blocked && pending?.payload.status === 'published' && options.initialValue.status === 'draft' });
  function emit(next = phase, error = message) {
    phase = next; message = error;
    if (!disposed) options.onChange(state());
  }
  function clearTimer() {
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
  }
  function pause(error = 'Another coach changed this script. Open the latest version before saving.') {
    blocked = true; clearTimer(); emit('conflict', error);
  }
  function schedule() {
    clearTimer();
    if (disposed || suspended || blocked || !enabled || flight || needsEdit || !hasContent()) return;
    if (!pending && !changed()) { dirtySince = null; emit(id ? 'saved' : 'idle', ''); return; }
    dirtySince ??= clock.now();
    const wait = Math.max(0, Math.min(delay, maxWait - (clock.now() - dirtySince)),
      lastStart + minGap - clock.now(), retryAt - clock.now());
    timer = clock.setTimeout(() => { timer = undefined; flush().catch(() => {}); }, wait);
  }
  function update(value) {
    if (JSON.stringify(value) === JSON.stringify(latest)) return;
    latest = structuredClone(value);
    if (disposed || suspended || blocked) return;
    if (!hasContent() && !pending && !flight) {
      dirtySince = null; clearTimer(); emit('idle', ''); return;
    }
    needsEdit = false;
    if (changed()) {
      dirtySince ??= clock.now();
      if (!flight) emit('unsaved', '');
    }
    schedule();
  }
  async function flush(targetStatus) {
    clearTimer();
    if (disposed || suspended) return lastResult;
    if (blocked) throw Object.assign(new Error(message), { status: 409 });
    if (flight) { await flight; return flush(targetStatus); }
    // Finish an uncertain earlier save before attempting to publish a newer snapshot.
    if (pending && targetStatus && pending.payload.status !== targetStatus) {
      await flush();
      return flush(targetStatus);
    }
    if (targetStatus) latest = { ...latest, status: targetStatus };
    if (!pending && !changed() && id) return lastResult;
    if (!pending && !hasContent() && !targetStatus) return null;
    needsEdit = false; retryAt = 0;
    pending ??= {
      id, revision, creationId: id ? undefined : options.creationId,
      requestId: options.makeRequestId(), payload: structuredClone(latest),
    };
    const request = pending;
    lastStart = clock.now();
    const promise = Promise.resolve().then(() => options.write(request));
    flight = promise;
    emit('saving', '');
    try {
      const result = await promise;
      id = result.id; revision = result.revision; lastResult = result;
      savedKey = JSON.stringify(request.payload);
      savedAt = clock.now(); pending = null;
      if (remoteRevision > revision) pause();
      else {
        const publishing = request.payload.status === 'published' && options.initialValue.status === 'draft';
        if (publishing) suspended = true;
        emit(changed() ? 'unsaved' : 'saved', '');
      }
      if (!disposed) options.onSaved(result, request.payload);
      return result;
    } catch (error) {
      if (error.status === 409) pause(error.message);
      else {
        const transient = !error.status || error.status >= 500 || error.status === 429;
        if (transient) retryAt = clock.now() + (error.status === 429 ? 10000 : 5000);
        else { pending = null; needsEdit = true; }
        emit('error', error.message || 'Couldn’t autosave. Your changes are still in this editor.');
      }
      throw error;
    } finally {
      flight = null;
      if (!blocked && phase === 'saving') emit(changed() ? 'unsaved' : 'saved', '');
      // A save of an older snapshot never marks newer typing as saved.
      emit(phase, message);
      schedule();
    }
  }
  return {
    update, flush, pause,
    getState: state,
    setEnabled(value) { enabled = value; schedule(); },
    observeRemote(value) {
      remoteRevision = Math.max(remoteRevision, value);
      if (!flight && !pending && revision !== undefined && remoteRevision > revision) pause();
    },
    dispose() { disposed = true; clearTimer(); },
  };
}
