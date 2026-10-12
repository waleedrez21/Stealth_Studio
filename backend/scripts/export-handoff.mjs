import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {spawnSync} from 'node:child_process';
import {initializeApp,cert,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp,GeoPoint} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';

const PROJECT='stealth-studio';
const BUCKET='stealth-studio.firebasestorage.app';
function serialize(v){
  if(v instanceof Timestamp)return {$type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};
  if(v instanceof GeoPoint)return {$type:'geopoint',latitude:v.latitude,longitude:v.longitude};
  if(Buffer.isBuffer(v))return {$type:'bytes',base64:v.toString('base64')};
  if(Array.isArray(v))return v.map(serialize);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,serialize(x)]));
  return v;
}
const rl=createInterface({input:stdin,output:stdout});
let app;
try{
  console.log('Read-only content export. Pause edits/uploads until this finishes.');
  let keyPath=(await rl.question('Drag your Firebase private-key JSON file here, then press Enter: ')).trim();
  if((keyPath.startsWith('"')&&keyPath.endsWith('"'))||(keyPath.startsWith("'")&&keyPath.endsWith("'")))keyPath=keyPath.slice(1,-1);
  // Terminal drag-and-drop may escape spaces in the path.
  keyPath=keyPath.replace(/\\ /g,' ');
  const account=JSON.parse(await readFile(resolve(keyPath),'utf8'));
  if(account.project_id!==PROJECT)throw new Error('This key belongs to a different Firebase project. Select the stealth-studio key.');
  rl.close();
  app=initializeApp({credential:cert(account),projectId:PROJECT,storageBucket:BUCKET});
  const db=getFirestore(app),bucket=getStorage(app).bucket();
  const exportName='stealth-studio-content-'+new Date().toISOString().replace(/[:.]/g,'-');
  const out=resolve(exportName);
  await mkdir(join(out,'images'),{recursive:true});
  const json=async(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
  const collections={};
  for(const name of ['scripts','ideas','assets']){
    const snap=await db.collection(name).get();
    collections[name]=snap.docs.map(d=>({id:d.id,data:serialize(d.data())})).sort((a,b)=>a.id.localeCompare(b.id));
  }
  // Keep deleted content out of the migration; assets are retained, including unattached uploads.
  const deletedCounts={scripts:0,ideas:0};
  for(const name of ['scripts','ideas']){
    deletedCounts[name]=collections[name].filter(r=>r.data.status==='deleted').length;
    collections[name]=collections[name].filter(r=>r.data.status!=='deleted');
  }
  const referencedIds=new Set(collections.scripts.flatMap(r=>(r.data.blocks||[]).filter(b=>b.type==='image').map(b=>b.assetId)));
  const knownIds=new Set(collections.assets.map(r=>r.id));
  for(const id of referencedIds)if(!knownIds.has(id))throw new Error('A script references an image missing from asset metadata: '+id);
  const imageFiles=[];
  const extensions={'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp'};
  for(const asset of collections.assets){
    const objectPath='images/'+asset.id;
    const [metadata]=await bucket.file(objectPath).getMetadata();
    const [bytes]=await bucket.file(objectPath).download();
    const mime=metadata.contentType||asset.data.mime||'application/octet-stream';
    const file='images/'+asset.id+(extensions[mime]||'.bin');
    await writeFile(join(out,file),bytes);
    imageFiles.push({assetId:asset.id,originalObjectPath:objectPath,file,mime,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  for(const name of ['scripts','ideas','assets'])await json(name+'.json',collections[name]);
  await json('image-files.json',imageFiles);
  const manifest={format:'stealth-studio-content-v1',exportedAt:new Date().toISOString(),sourceProject:PROJECT,sourceBucket:BUCKET,counts:{scripts:collections.scripts.length,published:collections.scripts.filter(r=>r.data.status==='published').length,drafts:collections.scripts.filter(r=>r.data.status==='draft').length,ideas:collections.ideas.length,assets:collections.assets.length,imageFiles:imageFiles.length},excludedDeletedRecords:deletedCounts,includesAuthenticationAccounts:false,includesCredentials:false};
  await json('manifest.json',manifest);
  await writeFile(join(out,'IMPORT-NOTES.md'),`# Stealth Studio content export\n\nThis is live Firebase content exported at ${manifest.exportedAt}.\n\nEach collection JSON is an array of {id, data}. Preserve id values when migrating. Scripts contain published scripts and shared drafts; respect status when applying Supabase access policies. Ideas are coach-only. Deleted scripts and ideas are excluded; all recorded assets, including unattached uploads, are included.\n\nImage blocks use assetId. image-files.json maps assetId to a local file, original Storage object, MIME type, byte size, and SHA-256. Upload these originals into the new storage provider and preserve/update the mapping. authorId and ownerId are historical Firebase UIDs, not Supabase auth IDs; map them deliberately or retain them as historical attribution. No login accounts or passwords are exported.\n\nRich text is stored as strings prefixed stealth:rich:v1: followed by Tiptap JSON. Preserve these strings exactly. The repository frontend/src/rich-text.js and RichContent.tsx explain validation/rendering. Plain text strings also exist. Dates used by this app are ISO strings; any tagged Firestore timestamp values retain seconds/nanoseconds.\n\nFolders are general, first-10, engagement. Script references and audio links are already in script documents. Notes and image captions may also contain rich text. Preserve revision, createdAt, updatedAt, status, and attribution.\n\nThis export contains private drafts, coach-only ideas, and attribution emails. Share with the company migration team only. Source was read across collections; pause edits/uploads while exporting for consistency.\n`);
  const zipPath=out+'.zip';
  const zipped=process.platform==='darwin'
    ?spawnSync('/usr/bin/ditto',['-c','-k','--keepParent',out,zipPath],{stdio:'inherit'})
    :spawnSync('zip',['-r',zipPath,exportName],{cwd:process.cwd(),stdio:'inherit'});
  console.log('\nExport counts:',JSON.stringify(manifest.counts));
  if(zipped.status!==0)throw new Error('Data was exported to '+out+' but ZIP creation failed. Compress that folder manually.');
  console.log('\nSUCCESS: Upload this ZIP to Google Drive:\n'+zipPath);
  console.log('The private key was NOT copied into the export.');
}catch(e){
  console.error('\nExport incomplete:',e.message);
  console.error('Do not share a partial export. Fix the issue and run again.');
  process.exitCode=1;
}finally{
  rl.close();
  if(app)await deleteApp(app);
}
