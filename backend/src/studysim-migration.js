export async function labelExistingStudySimScripts(db) {
  const marker = db.collection('migrations').doc('label-existing-studysim-scripts-v1');
  const scripts = db.collection('scripts');
  return db.runTransaction(async (tx) => {
    const completed = await tx.get(marker);
    if (completed.exists) return completed.data().moved;

    const snapshot = await tx.get(scripts.where('folder', '==', 'study-sim'));
    let moved = 0;
    for (const doc of snapshot.docs) {
      const script = doc.data();
      if (script.subfolder || script.status === 'deleted') continue;
      tx.update(scripts.doc(doc.id), {
        subfolder: 'studysim',
        revision: (script.revision ?? 0) + 1,
      });
      moved++;
    }
    tx.set(marker, { moved, completedAt: new Date().toISOString() });
    return moved;
  });
}
