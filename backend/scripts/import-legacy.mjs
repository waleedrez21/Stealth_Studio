import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { firebaseServices } from '../src/firebase.js';
import { scriptInput } from '../src/validation.js';
const { db } = firebaseServices();
const file = process.argv[2] || '../migration/current-site-data.json';
const input = JSON.parse(readFileSync(file, 'utf8'));
if (input.assets?.length)
  throw new Error(
    'This importer covers records without image uploads. Transfer uploaded image bytes before importing image-bearing records.',
  );
let added = 0,
  skipped = 0;
for (const row of input.scripts) {
  if (!['draft', 'published'].includes(row.status)) {
    skipped++;
    continue;
  }
  const blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
  if (blocks.some((b) => b.type === 'image'))
    throw new Error('Image-bearing records require an image transfer first.');
  const parsed = scriptInput.parse({
    title: row.title,
    summary: row.summary,
    notes: row.notes,
    blocks,
    status: row.status,
    folder: row.folder || 'general',
    references: row.references || (row.reference_links ? JSON.parse(row.reference_links) : []),
    revision: row.revision,
  });
  const record = {
    ...parsed,
    revision: row.revision || 0,
    author: row.author || 'Coaching team',
    authorId: 'legacy-' + row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    updatedBy: row.updated_by || row.author || 'Coaching team',
  };
  try {
    await db.collection('scripts').doc(row.id).create(record);
    added++;
  } catch (e) {
    if (e.code === 6) skipped++;
    else throw e;
  }
}
console.log(
  `Imported ${added} script(s); skipped ${skipped} deleted or already-existing record(s).`,
);
