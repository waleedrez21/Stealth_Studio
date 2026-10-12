import { randomUUID } from 'node:crypto';
import { nextRecord, assertRevision, imageIds } from './validation.js';

export function firestoreStore(db, bucket) {
  const scripts = db.collection('scripts');
  const assets = db.collection('assets');
  const ideas = db.collection('ideas');
  return {
    async listIdeas() {
      const snap = await ideas.where('status', '==', 'active').get();
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async saveIdea(id, input, user) {
      const ref = ideas.doc(id || randomUUID());
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.exists ? snap.data() : null;
        if (id) assertRevision(old, input.revision);
        const now = new Date().toISOString();
        const record = {
          title: input.title,
          url: input.url,
          thoughts: input.thoughts,
          status: 'active',
          revision: old ? old.revision + 1 : 0,
          author: old?.author || user.name || user.email,
          createdAt: old?.createdAt || now,
          updatedAt: now,
          updatedBy: user.name || user.email,
        };
        tx.set(ref, record);
        return { id: ref.id, ...record };
      });
    },
    async removeIdea(id, revision, user) {
      return db.runTransaction(async (tx) => {
        const ref = ideas.doc(id);
        const snap = await tx.get(ref);
        const old = snap.exists ? snap.data() : null;
        assertRevision(old, revision);
        tx.update(ref, {
          status: 'deleted',
          revision: old.revision + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.email,
        });
      });
    },
    async list(status) {
      const snap = await scripts.where('status', '==', status).get();
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) =>
            (status === 'published' ? Number(b.urgent === true) - Number(a.urgent === true) : 0) ||
            (status === 'draft' ? b.updatedAt : b.createdAt).localeCompare(
              status === 'draft' ? a.updatedAt : a.createdAt,
            ),
        );
    },
    async get(id) {
      const s = await scripts.doc(id).get();
      return s.exists ? { id: s.id, ...s.data() } : null;
    },
    async save(id, input, user) {
      const ref = scripts.doc(id || randomUUID());
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.exists ? snap.data() : null;
        if (id && !old)
          throw Object.assign(new Error('This script is unavailable.'), { status: 409 });
        const record = nextRecord(old, input, user, new Date().toISOString());
        // Update image visibility in the same transaction as the script.
        // Include previous images so removed images lose this published reference.
        const ids = [...new Set([...imageIds(old), ...imageIds(record)])];
        const assetRefs = ids.map((x) => assets.doc(x));
        const assetSnaps = assetRefs.length ? await tx.getAll(...assetRefs) : [];
        for (let i = 0; i < ids.length; i++) {
          if (!assetSnaps[i].exists)
            throw Object.assign(new Error('An image is unavailable. Upload it again.'), {
              status: 400,
            });
          const refs = new Set(assetSnaps[i].data().publishedScriptIds || []);
          refs.delete(ref.id);
          if (record.status === 'published' && imageIds(record).includes(ids[i])) refs.add(ref.id);
          tx.update(assetRefs[i], { publishedScriptIds: [...refs] });
        }
        tx.set(ref, record);
        return { id: ref.id, ...record };
      });
    },
    async remove(id, revision, user) {
      const ref = scripts.doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const old = snap.exists ? snap.data() : null;
        assertRevision(old, revision);
        const refs = imageIds(old).map((x) => assets.doc(x));
        const snapshots = refs.length ? await tx.getAll(...refs) : [];
        snapshots.forEach((s, i) => {
          if (s.exists)
            tx.update(refs[i], {
              publishedScriptIds: (s.data().publishedScriptIds || []).filter((x) => x !== id),
            });
        });
        tx.update(ref, {
          status: 'deleted',
          revision: old.revision + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.email,
        });
      });
    },
    async upload(buffer, mime, user) {
      const id = randomUUID();
      const file = bucket.file(`images/${id}`);
      await file.save(buffer, {
        resumable: false,
        metadata: { contentType: mime, cacheControl: 'private, no-store' },
      });
      try {
        await assets.doc(id).create({
          ownerId: user.uid,
          mime,
          size: buffer.length,
          createdAt: new Date().toISOString(),
          publishedScriptIds: [],
        });
      } catch (e) {
        await file.delete().catch(() => {});
        throw e;
      }
      return { id };
    },
    async image(id) {
      const meta = await assets.doc(id).get();
      if (!meta.exists) return null;
      return { ...meta.data(), stream: () => bucket.file(`images/${id}`).createReadStream() };
    },
    subscribe(status, onChange, onError) {
      return scripts.where('status', '==', status).onSnapshot(() => onChange(), onError);
    },
    async health() {
      await scripts.limit(1).get();
    },
  };
}
