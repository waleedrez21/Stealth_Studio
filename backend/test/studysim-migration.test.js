import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFirebase } from './fake-firebase.js';
import { labelExistingStudySimScripts } from '../src/studysim-migration.js';

test('labels existing unassigned StudySim scripts once without changing content or status', async () => {
  const { db } = fakeFirebase();
  const scripts = db.collection('scripts');
  const initial = { folder: 'study-sim', title: 'Example', blocks: [], revision: 4 };
  const records = {
    live: { ...initial, status: 'published', subfolder: '' },
    draft: { ...initial, status: 'draft' },
    archived: { ...initial, status: 'archived' },
    rizz: { ...initial, status: 'draft', subfolder: 'rizzmyprofessor' },
    deleted: { ...initial, status: 'deleted' },
    other: { ...initial, status: 'published', folder: 'general' },
  };
  for (const [id, value] of Object.entries(records)) await scripts.doc(id).create(value);

  assert.equal(await labelExistingStudySimScripts(db), 3);
  for (const [id, value] of Object.entries(records)) {
    const expected = ['live', 'draft', 'archived'].includes(id)
      ? { ...value, subfolder: 'studysim', revision: 5 }
      : value;
    assert.deepEqual((await scripts.doc(id).get()).data(), expected);
  }
  await scripts.doc('new').create(initial);
  assert.equal(await labelExistingStudySimScripts(db), 3);
  assert.deepEqual((await scripts.doc('new').get()).data(), initial);
  assert.equal((await scripts.doc('live').get()).data().revision, 5);
});
