import { encodeDocument, documentFor, plainText } from '../src/rich-text.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { firestoreStore } from '../src/store.js';
import { fakeFirebase } from './fake-firebase.js';
import { nextRecord, detectMime } from '../src/validation.js';
const users = {
  a: { uid: 'coach-a', email: 'a@example.com', email_verified: true, name: 'Coach A' },
  b: { uid: 'coach-b', email: 'b@example.com', email_verified: true, name: 'Coach B' },
  outsider: { uid: 'other', email: 'other@example.com', email_verified: true },
  unverified: { uid: 'unverified', email: 'a@example.com', email_verified: false },
  team: { uid: 'team', email: 'Coach@StealthGPT.ai', email_verified: true },
  teamPending: { uid: 'pending', email: 'coach@stealthgpt.ai', email_verified: false },
  similarDomain: { uid: 'similar', email: 'coach@stealthgpt.ai.evil.com', email_verified: true },
  subdomain: { uid: 'subdomain', email: 'coach@team.stealthgpt.ai', email_verified: true },
};
async function server(t) {
  const fake = fakeFirebase();
  const store = firestoreStore(fake.db, fake.bucket);
  const app = createApp({
    store,
    verifyToken: async (token) => {
      if (!users[token]) throw new Error('Invalid token');
      return users[token];
    },
    origins: ['http://site.example'],
    coachEmails: ['a@example.com', 'b@example.com'],
    rateLimits: false,
  });
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  t.after(() => {
    listener.closeAllConnections();
    listener.close();
  });
  const base = `http://127.0.0.1:${listener.address().port}`;
  async function call(path, { token, body, method = 'GET', origin = 'http://site.example' } = {}) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        : {}),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  }
  return { base, call, store, db: fake.db };
}
const draft = {
  title: 'Shared draft',
  summary: 'Card summary',
  notes: 'Film vertically',
  blocks: [{ type: 'text', text: 'Hello creators' }],
  status: 'draft',
};
test('public reading, verified coach authorization, shared editing, image privacy and deletion', async (t) => {
  const { base, call } = await server(t);
  assert.equal((await call('/health')).status, 200);
  assert.equal((await call('/api/me')).data.approved, false);
  assert.equal((await call('/api/me', { token: 'outsider' })).data.approved, false);
  assert.equal((await call('/api/me', { token: 'unverified' })).data.approved, true);
  assert.equal((await call('/api/me', { token: 'unverified' })).data.coach, false);
  assert.equal((await call('/api/me', { token: 'a' })).data.coach, true);
  assert.equal((await call('/api/scripts', { method: 'POST', body: draft })).status, 401);
  for (const token of ['outsider', 'unverified'])
    assert.equal((await call('/api/scripts', { token, method: 'POST', body: draft })).status, 403);
  assert.equal((await call('/api/scripts', { token: 'invalid' })).status, 401);
  assert.equal((await call('/api/scripts', { origin: 'http://evil.example' })).status, 403);
  let r = await call('/api/scripts', { token: 'a', method: 'POST', body: draft });
  assert.equal(r.status, 201);
  const id = r.data.id;
  assert.equal((await call('/api/scripts')).data.length, 0);
  assert.equal((await call('/api/scripts/' + id)).status, 404);
  assert.equal((await call('/api/drafts')).status, 401);
  assert.equal((await call('/api/drafts', { token: 'b' })).data[0].id, id);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'test.png');
  const upload = await fetch(base + '/api/images', {
    method: 'POST',
    headers: { Origin: 'http://site.example', Authorization: 'Bearer b' },
    body: form,
  });
  assert.equal(upload.status, 201);
  const imageId = (await upload.json()).id;
  assert.equal((await fetch(base + '/api/images/' + imageId)).status, 404);
  assert.equal(
    (await fetch(base + '/api/images/' + imageId, { headers: { Authorization: 'Bearer a' } }))
      .status,
    200,
  );
  const withImage = {
    ...draft,
    blocks: [...draft.blocks, { type: 'image', assetId: imageId, caption: 'Reference' }],
    revision: 0,
  };
  r = await call('/api/scripts/' + id, { token: 'b', method: 'PATCH', body: withImage });
  assert.equal(r.status, 200);
  assert.equal(r.data.revision, 1);
  assert.equal(
    (await call('/api/scripts/' + id, { token: 'a', method: 'PATCH', body: withImage })).status,
    409,
  );
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...withImage, revision: 1, status: 'published' },
  });
  assert.equal(r.status, 200);
  const published = (await call('/api/scripts/' + id)).data;
  assert.equal(published.status, 'published');
  assert.equal(published.authorId, undefined);
  assert.equal(published.updatedBy, undefined);
  assert.equal((await fetch(base + '/api/images/' + imageId)).status, 200);
  r = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: { ...withImage, title: 'Updated public script', revision: 2, status: 'published' },
  });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/scripts/' + id)).data.createdAt, published.createdAt);
  assert.equal(
    (await call('/api/scripts/' + id, { token: 'b', method: 'DELETE', body: { revision: 2 } }))
      .status,
    409,
  );
  assert.equal(
    (await call('/api/scripts/' + id, { token: 'b', method: 'DELETE', body: { revision: 3 } }))
      .status,
    200,
  );
  assert.equal((await call('/api/scripts/' + id)).status, 404);
  assert.equal((await fetch(base + '/api/images/' + imageId)).status, 404);
  assert.equal((await call('/api/scripts')).data.length, 0);
  assert.equal(
    (
      await call('/api/scripts/' + id, {
        token: 'a',
        method: 'PATCH',
        body: { ...withImage, revision: 4, status: 'published' },
      })
    ).status,
    409,
  );
});
test('atomic saves allow only one concurrent coach revision', async (t) => {
  const { call } = await server(t);
  const r = await call('/api/scripts', { token: 'a', method: 'POST', body: draft });
  const id = r.data.id;
  const saves = await Promise.all(
    ['a', 'b'].map((token) =>
      call('/api/scripts/' + id, {
        token,
        method: 'PATCH',
        body: { ...draft, revision: 0, title: token },
      }),
    ),
  );
  assert.deepEqual(saves.map((s) => s.status).sort(), [200, 409]);
});
test('live stream emits updates on publication and drafts require coach access', async (t) => {
  const { base, call } = await server(t);
  assert.equal((await fetch(base + '/api/events?scope=draft')).status, 401);
  const controller = new AbortController();
  const response = await fetch(base + '/api/events?scope=published', { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /"type":"change"/);
  await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, status: 'published' },
  });
  const next = await reader.read();
  assert.match(new TextDecoder().decode(next.value), /"type":"change"/);
  controller.abort();
  await reader.cancel().catch(() => {});
});
test('validation rejects incomplete publication and invalid image signatures', async (t) => {
  const { call } = await server(t);
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { title: '', summary: '', notes: '', blocks: [], status: 'published' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { title: '', summary: '', notes: '', blocks: [], status: 'draft' },
      })
    ).status,
    201,
  );
  assert.equal(detectMime(Buffer.from('<svg>bad</svg>')), null);
  const input = { ...draft, status: 'published', revision: 3 };
  const existing = { ...input, createdAt: '2020-01-01T00:00:00Z', revision: 3 };
  assert.equal(
    nextRecord(existing, input, users.a, '2026-10-07T00:00:00Z').createdAt,
    existing.createdAt,
  );
});

test('formatting survives shared draft edits and published reads', async (t) => {
  const { call } = await server(t);
  const formatted = encodeDocument({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          {
            type: 'text',
            text: 'Formatted script',
            marks: [
              { type: 'bold' },
              { type: 'italic' },
              { type: 'underline' },
              { type: 'strike' },
            ],
          },
        ],
      },
    ],
  });
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: {
      ...draft,
      summary: formatted,
      notes: formatted,
      blocks: [{ type: 'text', text: formatted }],
    },
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  const shared = (await call('/api/scripts/' + id, { token: 'b' })).data;
  assert.equal(shared.blocks[0].text, formatted);
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...shared, status: 'published' },
  });
  assert.equal(r.status, 200);
  const publicScript = (await call('/api/scripts/' + id)).data;
  assert.equal(publicScript.summary, formatted);
  assert.equal(publicScript.notes, formatted);
  assert.equal(plainText(publicScript.blocks[0].text), 'Formatted script');
  assert.equal(documentFor(publicScript.blocks[0].text).content[0].attrs.textAlign, 'center');
  assert.equal(documentFor(publicScript.blocks[0].text).content[0].content[0].marks.length, 4);
});
test('folder assignments survive shared drafts, publication and moving a published script', async (t) => {
  const { call } = await server(t);
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, folder: 'first-10' },
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  assert.equal((await call('/api/scripts/' + id, { token: 'b' })).data.folder, 'first-10');
  assert.equal((await call('/api/drafts')).status, 401);
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...draft, folder: 'first-10', status: 'published', revision: 0 },
  });
  assert.equal(r.status, 200);
  const before = (await call('/api/scripts/' + id)).data;
  assert.equal(before.folder, 'first-10');
  r = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: { ...draft, folder: 'engagement', status: 'published', revision: 1 },
  });
  assert.equal(r.status, 200);
  const after = (await call('/api/scripts/' + id)).data;
  assert.equal(after.folder, 'engagement');
  assert.equal(after.createdAt, before.createdAt);
  assert.equal((await call('/api/scripts')).data.find((s) => s.id === id).folder, 'engagement');
  assert.equal(
    (
      await call('/api/scripts/' + id, {
        token: 'b',
        method: 'PATCH',
        body: { ...draft, folder: 'general', status: 'published', revision: 1 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...draft, folder: 'invalid-folder' },
      })
    ).status,
    400,
  );
  const legacy = await call('/api/scripts', { token: 'a', method: 'POST', body: draft });
  assert.equal(
    (await call('/api/scripts/' + legacy.data.id, { token: 'b' })).data.folder,
    'general',
  );
});
test('reference video links persist through shared editing, publication and removal', async (t) => {
  const { call } = await server(t);
  const references = [
    { label: 'Video inspiration 1', url: 'https://vt.tiktok.com/example/' },
    { label: '', url: 'https://www.youtube.com/watch?v=example' },
  ];
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, references },
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  assert.equal((await call('/api/scripts/' + id)).status, 404);
  assert.deepEqual((await call('/api/scripts/' + id, { token: 'b' })).data.references, references);
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...draft, references, status: 'published', revision: 0 },
  });
  assert.equal(r.status, 200);
  assert.deepEqual((await call('/api/scripts/' + id)).data.references, references);
  r = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: { ...draft, references: [references[1]], status: 'published', revision: 1 },
  });
  assert.equal(r.status, 200);
  assert.deepEqual((await call('/api/scripts/' + id)).data.references, [references[1]]);
  r = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: { ...draft, references: [], status: 'published', revision: 2 },
  });
  assert.equal(r.status, 200);
  assert.deepEqual((await call('/api/scripts/' + id)).data.references, []);
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,bad',
    'mailto:a@example.com',
    'not a link',
  ])
    assert.equal(
      (
        await call('/api/scripts', {
          token: 'a',
          method: 'POST',
          body: { ...draft, references: [{ label: 'Invalid', url }] },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...draft, references: Array(11).fill(references[0]) },
      })
    ).status,
    400,
  );
  const legacy = await call('/api/scripts', { token: 'a', method: 'POST', body: draft });
  assert.deepEqual(
    (await call('/api/scripts/' + legacy.data.id, { token: 'b' })).data.references,
    [],
  );
});
test('named script template sections keep their labels and formatting across coach saves', async (t) => {
  const { call } = await server(t);
  const labels = [
    'Note',
    'On-screen text',
    'Script',
    'CTA',
    'Captions',
    'Audio',
    'Background',
    'Description',
  ];
  const blocks = labels.map((section) => ({
    type: 'text',
    section,
    text:
      section === 'Script'
        ? encodeDocument({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Dialogue and scene directions',
                    marks: [{ type: 'bold' }],
                  },
                ],
              },
            ],
          })
        : '',
  }));
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, notes: 'Filming notes', blocks },
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  const shared = (await call('/api/scripts/' + id, { token: 'b' })).data;
  assert.deepEqual(
    shared.blocks.map((b) => b.section),
    labels,
  );
  assert.equal(plainText(shared.blocks[2].text), 'Dialogue and scene directions');
  assert.equal(shared.notes, 'Filming notes');
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...shared, status: 'published' },
  });
  assert.equal(r.status, 200);
  const published = (await call('/api/scripts/' + id)).data;
  assert.deepEqual(published.blocks, blocks);
  assert.equal(published.notes, 'Filming notes');
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...draft, blocks: [{ type: 'text', section: 'unsupported', text: 'bad' }] },
      })
    ).status,
    400,
  );
});
test('audio reference and None persist through coach edits with safe URL validation', async (t) => {
  const { call } = await server(t);
  const blocks = [
    { type: 'text', section: 'Script', text: 'Dialogue' },
    {
      type: 'text',
      section: 'Audio',
      text: 'Use the chorus',
      audio: { mode: 'link', url: 'https://example.com/audio' },
    },
  ];
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, summary: '', blocks, status: 'published' },
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  let publicScript = (await call('/api/scripts/' + id)).data;
  assert.deepEqual(publicScript.blocks[1].audio, {
    mode: 'link',
    url: 'https://example.com/audio',
  });
  const noneBlocks = [blocks[0], { ...blocks[1], audio: { mode: 'none', url: '' } }];
  r = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...draft, summary: '', blocks: noneBlocks, status: 'published', revision: 0 },
  });
  assert.equal(r.status, 200);
  publicScript = (await call('/api/scripts/' + id)).data;
  assert.deepEqual(publicScript.blocks[1].audio, { mode: 'none', url: '' });
  for (const url of ['javascript:alert(1)', 'data:audio/bad', 'mailto:a@example.com', 'not a link'])
    assert.equal(
      (
        await call('/api/scripts', {
          token: 'a',
          method: 'POST',
          body: { ...draft, blocks: [{ ...blocks[1], audio: { mode: 'link', url } }] },
        })
      ).status,
      400,
    );
});
test('published cards can omit descriptions while title and content remain required', async (t) => {
  const { call } = await server(t);
  const { summary, ...withoutSummary } = draft;
  let r = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...withoutSummary, status: 'published' },
  });
  assert.equal(r.status, 201);
  assert.equal((await call('/api/scripts/' + r.data.id)).data.summary, '');
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...withoutSummary, status: 'published', title: '' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...withoutSummary, status: 'published', blocks: [] },
      })
    ).status,
    400,
  );
});

test('video ideas are private, shared, separate from drafts, and protected from stale edits', async (t) => {
  const { call } = await server(t);
  const idea = {
    title: 'Try this hook',
    url: 'https://www.instagram.com/reel/example/',
    thoughts: 'Shorten the opening.',
  };
  for (const token of [undefined, 'outsider', 'unverified']) {
    assert.ok([401, 403].includes((await call('/api/ideas', { token })).status));
    assert.ok(
      [401, 403].includes((await call('/api/ideas', { token, method: 'POST', body: idea })).status),
    );
  }
  const r = await call('/api/ideas', { token: 'a', method: 'POST', body: idea });
  assert.equal(r.status, 201);
  const id = r.data.id;
  assert.equal((await call('/api/scripts')).data.length, 0);
  assert.equal((await call('/api/drafts', { token: 'a' })).data.length, 0);
  assert.equal((await call('/api/ideas', { token: 'b' })).data[0].thoughts, idea.thoughts);
  assert.equal(
    (
      await call('/api/ideas/' + id, {
        token: 'outsider',
        method: 'PATCH',
        body: { ...idea, revision: 0 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('/api/ideas/' + id, {
        token: 'b',
        method: 'PATCH',
        body: { ...idea, thoughts: 'New thoughts', revision: 0 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('/api/ideas/' + id, {
        token: 'a',
        method: 'PATCH',
        body: { ...idea, revision: 0 },
      })
    ).status,
    409,
  );
  assert.equal(
    (await call('/api/ideas/' + id, { token: 'a', method: 'DELETE', body: { revision: 0 } }))
      .status,
    409,
  );
  assert.equal(
    (
      await call('/api/ideas', {
        token: 'a',
        method: 'POST',
        body: { ...idea, url: 'javascript:alert(1)' },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call('/api/ideas/' + id, { token: 'b', method: 'DELETE', body: { revision: 1 } }))
      .status,
    200,
  );
  assert.equal((await call('/api/ideas', { token: 'a' })).data.length, 0);
  assert.equal(
    (
      await call('/api/ideas/' + id, {
        token: 'a',
        method: 'PATCH',
        body: { ...idea, revision: 2 },
      })
    ).status,
    409,
  );
});

test('company coaches require verified tokens before accessing any private workspace', async (t) => {
  const { call } = await server(t);
  const team = (await call('/api/me', { token: 'team' })).data;
  assert.equal(team.approved, true);
  assert.equal(team.coach, true);
  const pending = (await call('/api/me', { token: 'teamPending' })).data;
  assert.equal(pending.approved, true);
  assert.equal(pending.coach, false);
  for (const token of ['teamPending', 'similarDomain', 'subdomain', 'outsider']) {
    assert.equal((await call('/api/drafts', { token })).status, 403);
    assert.equal((await call('/api/ideas', { token })).status, 403);
    assert.equal((await call('/api/scripts', { token, method: 'POST', body: draft })).status, 403);
  }
  assert.equal((await call('/api/drafts', { token: 'team' })).status, 200);
  assert.equal((await call('/api/ideas', { token: 'team' })).status, 200);
  const saved = await call('/api/scripts', { token: 'team', method: 'POST', body: draft });
  assert.equal(saved.status, 201);
  assert.equal((await call('/api/scripts/' + saved.data.id)).status, 404);
  const shared = await call('/api/scripts/' + saved.data.id, { token: 'a' });
  assert.equal(shared.status, 200);
  assert.equal(
    (
      await call('/api/scripts/' + saved.data.id, {
        token: 'team',
        method: 'PATCH',
        body: { ...draft, status: 'published', revision: 0 },
      })
    ).status,
    200,
  );
  assert.equal((await call('/api/scripts/' + saved.data.id)).status, 200);
});

test('urgent scripts stay above newer regular scripts and Study Sim survives editing', async (t) => {
  const { call, db } = await server(t);
  const regularId = '10000000-0000-4000-8000-000000000001';
  const urgentId = '10000000-0000-4000-8000-000000000002';
  const urgentDraftId = '10000000-0000-4000-8000-000000000003';
  await db.runTransaction(async (tx) => {
    tx.set(
      db.collection('scripts').doc(regularId),
      nextRecord(
        null,
        { ...draft, status: 'published', folder: 'study-sim' },
        users.a,
        '2026-10-12T12:00:00Z',
      ),
    );
    tx.set(
      db.collection('scripts').doc(urgentId),
      nextRecord(
        null,
        { ...draft, status: 'published', folder: 'study-sim', urgent: true },
        users.a,
        '2026-10-01T12:00:00Z',
      ),
    );
    tx.set(
      db.collection('scripts').doc(urgentDraftId),
      nextRecord(null, { ...draft, urgent: true }, users.a, '2026-10-12T13:00:00Z'),
    );
  });
  let scripts = (await call('/api/scripts')).data;
  assert.deepEqual(
    scripts.map((s) => s.id),
    [urgentId, regularId],
  );
  assert.equal(scripts[0].folder, 'study-sim');
  // Older clients that omit urgency must not silently unpin an existing script.
  assert.equal(
    (
      await call('/api/scripts/' + urgentId, {
        token: 'a',
        method: 'PATCH',
        body: { ...draft, status: 'published', folder: 'study-sim', revision: 0 },
      })
    ).status,
    200,
  );
  assert.equal((await call('/api/scripts/' + urgentId)).data.urgent, true);
  assert.equal(
    (
      await call('/api/scripts/' + urgentId, {
        token: 'b',
        method: 'PATCH',
        body: { ...draft, status: 'published', folder: 'study-sim', urgent: false, revision: 1 },
      })
    ).status,
    200,
  );
  scripts = (await call('/api/scripts')).data;
  assert.deepEqual(
    scripts.map((s) => s.id),
    [regularId, urgentId],
  );
  const studyDraft = await call('/api/scripts', {
    token: 'team',
    method: 'POST',
    body: { ...draft, folder: 'study-sim', urgent: true },
  });
  assert.equal(studyDraft.status, 201);
  assert.equal((await call('/api/scripts/' + studyDraft.data.id)).status, 404);
  assert.equal(
    (await call('/api/scripts/' + studyDraft.data.id, { token: 'a' })).data.folder,
    'study-sim',
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'team',
        method: 'POST',
        body: { ...draft, urgent: 'yes' },
      })
    ).status,
    400,
  );
});

test('StealthGPT subfolders persist through edits, publication and moves without exposing drafts', async (t) => {
  const { call } = await server(t);
  let result = await call('/api/scripts', {
    token: 'a',
    method: 'POST',
    body: { ...draft, folder: 'general', subfolder: 'humanchatgpt', urgent: true },
  });
  assert.equal(result.status, 201);
  const id = result.data.id;
  assert.equal((await call('/api/scripts/' + id)).status, 404);
  let record = (await call('/api/scripts/' + id, { token: 'b' })).data;
  assert.equal(record.subfolder, 'humanchatgpt');
  // Saving from an older client preserves an assigned subfolder.
  result = await call('/api/scripts/' + id, {
    token: 'b',
    method: 'PATCH',
    body: { ...draft, folder: 'general', revision: 0 },
  });
  assert.equal(result.status, 200);
  record = (await call('/api/scripts/' + id, { token: 'a' })).data;
  assert.equal(record.subfolder, 'humanchatgpt');
  assert.equal(record.urgent, true);
  result = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: {
      ...draft,
      folder: 'general',
      subfolder: 'stealthgpt',
      status: 'published',
      revision: 1,
    },
  });
  assert.equal(result.status, 200);
  assert.equal((await call('/api/scripts')).data.find((s) => s.id === id).subfolder, 'stealthgpt');
  // Stale edits cannot move a script back into another subfolder.
  assert.equal(
    (
      await call('/api/scripts/' + id, {
        token: 'b',
        method: 'PATCH',
        body: {
          ...draft,
          folder: 'general',
          subfolder: 'humanchatgpt',
          status: 'published',
          revision: 1,
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...draft, folder: 'study-sim', subfolder: 'stealthgpt' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/api/scripts', {
        token: 'a',
        method: 'POST',
        body: { ...draft, folder: 'general', subfolder: 'unknown' },
      })
    ).status,
    400,
  );
  result = await call('/api/scripts/' + id, {
    token: 'a',
    method: 'PATCH',
    body: { ...draft, folder: 'study-sim', status: 'published', revision: 2 },
  });
  assert.equal(result.status, 200);
  record = (await call('/api/scripts/' + id)).data;
  assert.equal(record.subfolder, '');
  assert.equal(record.urgent, true);
  const legacy = await call('/api/scripts', { token: 'a', method: 'POST', body: draft });
  assert.equal((await call('/api/scripts/' + legacy.data.id, { token: 'a' })).data.subfolder, '');
});

test('archive is private, preserves scripts and images, restores visibility and rejects stale edits', async (t) => {
  const { call, store, base } = await server(t);
  const image = await store.upload(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png', users.a);
  const input = {...draft, status:'published', folder:'general', subfolder:'stealthgpt', urgent:true,
    blocks:[...draft.blocks,{type:'image',assetId:image.id,caption:'Keep this image'}]};
  const created = await call('/api/scripts',{token:'a',method:'POST',body:input});
  const id = created.data.id;
  const original = (await call('/api/scripts/'+id)).data;
  for (const token of [undefined,'outsider','unverified']) {
    assert.ok([401,403].includes((await call('/api/archive',{token})).status));
    assert.ok([401,403].includes((await call('/api/scripts/'+id+'/archive',{token,method:'PATCH',body:{archived:true,revision:0}})).status));
    assert.ok([401,403].includes((await fetch(base+'/api/events?scope=archived',{headers:token?{Authorization:'Bearer '+token}:{}})).status));
  }
  assert.equal((await call('/api/scripts/'+id+'/archive',{token:'a',method:'PATCH',body:{archived:'yes',revision:0}})).status,400);
  assert.equal((await call('/api/scripts/'+id+'/archive',{token:'a',method:'PATCH',body:{archived:true,revision:0}})).status,200);
  assert.equal((await call('/api/scripts')).data.length,0);
  assert.equal((await call('/api/scripts/'+id)).status,404);
  assert.equal((await call('/api/scripts/'+id,{token:'outsider'})).status,404);
  assert.equal((await fetch(base+'/api/images/'+image.id)).status,404);
  assert.equal((await fetch(base+'/api/images/'+image.id,{headers:{Authorization:'Bearer b'}})).status,200);
  const archived = (await call('/api/archive',{token:'b'})).data[0];
  assert.equal(archived.id,id);
  assert.equal(archived.status,'archived');
  assert.deepEqual(archived.blocks,original.blocks);
  assert.equal(archived.createdAt,original.createdAt);
  assert.equal(archived.subfolder,'stealthgpt');
  assert.equal(archived.urgent,true);
  assert.equal((await call('/api/scripts/'+id,{token:'b',method:'PATCH',body:{...input,revision:1}})).status,409);
  assert.equal((await call('/api/scripts/'+id+'/archive',{token:'b',method:'PATCH',body:{archived:false,revision:0}})).status,409);
  assert.equal((await call('/api/scripts/'+id+'/archive',{token:'b',method:'PATCH',body:{archived:false,revision:1}})).status,200);
  const restored = (await call('/api/scripts/'+id)).data;
  assert.equal(restored.createdAt,original.createdAt);
  assert.deepEqual(restored.blocks,original.blocks);
  assert.equal((await fetch(base+'/api/images/'+image.id)).status,200);
  assert.equal((await call('/api/archive',{token:'a'})).data.length,0);
  // An image shared by another published script stays public when one copy is archived.
  const shared = await call('/api/scripts',{token:'a',method:'POST',body:input});
  await call('/api/scripts/'+id+'/archive',{token:'a',method:'PATCH',body:{archived:true,revision:2}});
  assert.equal((await fetch(base+'/api/images/'+image.id)).status,200);
  assert.equal((await call('/api/scripts/'+id,{token:'a',method:'DELETE',body:{revision:3}})).status,200);
  assert.equal((await call('/api/scripts/'+id+'/archive',{token:'a',method:'PATCH',body:{archived:false,revision:4}})).status,409);
  assert.equal((await call('/api/scripts/'+shared.data.id)).status,200);
  const savedDraft = await call('/api/scripts',{token:'a',method:'POST',body:draft});
  await call('/api/scripts/'+savedDraft.data.id+'/archive',{token:'a',method:'PATCH',body:{archived:true,revision:0}});
  const draftRestore = await call('/api/scripts/'+savedDraft.data.id+'/archive',{token:'a',method:'PATCH',body:{archived:false,revision:1}});
  assert.equal(draftRestore.data.status,'draft');
  assert.equal((await call('/api/scripts/'+savedDraft.data.id)).status,404);
});

test('quick pin requires a coach and current revision, preserves content and sorts immediately', async (t) => {
  const { call, store } = await server(t);
  const created = await call('/api/scripts',{token:'a',method:'POST',body:{...draft,status:'published',folder:'study-sim'}});
  const id = created.data.id;
  const path = '/api/scripts/'+id+'/pin';
  const original = await store.get(id);
  for (const token of [undefined,'outsider','unverified'])
    assert.ok([401,403].includes((await call(path,{token,method:'PATCH',body:{urgent:true,revision:0}})).status));
  assert.equal((await call(path,{token:'b',method:'PATCH',body:{urgent:'yes',revision:0}})).status,400);
  assert.equal((await call(path,{token:'b',method:'PATCH',body:{urgent:true}})).status,400);
  const newer = await call('/api/scripts',{token:'a',method:'POST',body:{...draft,status:'published',title:'Newer'}});
  assert.equal((await call(path,{token:'b',method:'PATCH',body:{urgent:true,revision:0}})).status,200);
  const pinned = await store.get(id);
  for (const field of ['blocks','createdAt','folder','subfolder','references','notes','title','summary','authorId','status'])
    assert.deepEqual(pinned[field],original[field]);
  assert.equal(pinned.urgent,true);
  assert.equal((await call('/api/scripts')).data[0].id,id);
  assert.equal((await call(path,{token:'a',method:'PATCH',body:{urgent:false,revision:0}})).status,409);
  assert.equal((await call(path,{token:'a',method:'PATCH',body:{urgent:false,revision:1}})).status,200);
  assert.equal((await call('/api/scripts')).data[0].id,newer.data.id);
  await call('/api/scripts/'+id+'/archive',{token:'a',method:'PATCH',body:{archived:true,revision:2}});
  assert.equal((await call(path,{token:'a',method:'PATCH',body:{urgent:true,revision:3}})).status,409);
});

test('saved drafts from different authors are listed and editable by the whole verified coach team', async (t) => {
  const { call } = await server(t);
  const a = await call('/api/scripts', { token:'a', method:'POST', body:{...draft,title:'Coach A draft',folder:'study-sim'} });
  const b = await call('/api/scripts', { token:'b', method:'POST', body:{...draft,title:'Coach B draft',folder:'general',subfolder:'humanchatgpt'} });
  assert.equal(a.status,201); assert.equal(b.status,201);
  for (const token of ['a','b','team']) {
    const all = await call('/api/drafts',{token});
    assert.equal(all.status,200);
    assert.deepEqual(new Set(all.data.map(s=>s.id)),new Set([a.data.id,b.data.id]));
    for (const id of [a.data.id,b.data.id]) assert.equal((await call('/api/scripts/'+id,{token})).status,200);
  }
  assert.equal((await call('/api/scripts')).data.length,0);
  assert.equal((await call('/api/drafts')).status,401);
  assert.equal((await call('/api/drafts',{token:'outsider'})).status,403);
  const other = (await call('/api/scripts/'+a.data.id,{token:'b'})).data;
  assert.equal((await call('/api/scripts/'+a.data.id,{token:'b',method:'PATCH',body:{...other,title:'Edited by coach B'}})).status,200);
  assert.equal((await call('/api/drafts',{token:'team'})).data.find(s=>s.id===a.data.id).title,'Edited by coach B');
});

test('Study Sim folder descriptions are public, shared, validated and protected from stale saves', async (t) => {
  const { call } = await server(t);
  const path='/api/folders/study-sim/description';
  const initial=await call(path);
  assert.equal(initial.status,200);
  assert.match(initial.data.description,/Study Sim only/);
  assert.equal(initial.data.revision,0);
  for (const token of [undefined,'outsider','unverified'])
    assert.ok([401,403].includes((await call(path,{token,method:'PATCH',body:{description:'Changed',revision:0}})).status));
  for (const body of [{description:'x'.repeat(1001),revision:0},{description:'Missing revision'},{description:'Bad revision',revision:-1}])
    assert.equal((await call(path,{token:'a',method:'PATCH',body})).status,400);
  const saved=await call(path,{token:'a',method:'PATCH',body:{description:'Promote Study Sim only. Keep flashcards and study tools with Study Sim.',revision:0}});
  assert.equal(saved.status,200); assert.equal(saved.data.revision,1);
  assert.deepEqual((await call(path)).data,saved.data);
  assert.equal((await call(path,{token:'b',method:'PATCH',body:{description:'Stale edit',revision:0}})).status,409);
  assert.equal((await call(path,{token:'b',method:'PATCH',body:{description:'Updated by another coach',revision:1}})).status,200);
  assert.deepEqual(Object.keys((await call(path)).data).sort(),['description','revision']);
});
