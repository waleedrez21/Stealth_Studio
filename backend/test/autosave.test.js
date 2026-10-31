import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScriptAutosave } from '../../frontend/src/autosave.js';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
function harness(write, extra = {}) {
  let now = 0, serial = 0;
  const timers = new Map(), calls = [], states = [];
  const clock = {
    now: () => now,
    setTimeout(fn, ms) { const id = ++serial; timers.set(id,{fn,time:now+ms}); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  let requests = 0;
  const engine = createScriptAutosave({
    initialValue:{text:'',status:'draft'}, creationId:'fixed-creation',
    makeRequestId:()=>`request-${++requests}`, canCreate:v=>!!v.text.trim(),
    write:r=>{calls.push(structuredClone(r)); return write(r,calls.length);},
    onChange:s=>states.push(s),onSaved:()=>{},clock,...extra,
  });
  async function advance(ms) {
    const target=now+ms;
    for(let guard=0;guard<200;guard++) {
      const next=[...timers].filter(([,t])=>t.time<=target).sort((a,b)=>a[1].time-b[1].time)[0];
      if(!next) { now=target; await settle(); return; }
      now=next[1].time;timers.delete(next[0]);next[1].fn();await settle();
    }
    throw new Error('Autosave timer did not settle');
  }
  return {engine,calls,states,advance};
}
const ack=(r,n)=>({id:r.id||'saved-draft',revision:r.id?r.revision+1:0,status:r.payload.status});

test('autosave ignores untouched editors and debounces typing without publishing',async()=>{
  const h=harness(ack);
  await h.advance(20000);assert.equal(h.calls.length,0);
  h.engine.update({text:'',status:'draft',folder:'study-sim'});
  await h.advance(20000);assert.equal(h.calls.length,0);
  h.engine.update({text:'A',status:'draft'});await h.advance(1500);
  h.engine.update({text:'AB',status:'draft'});await h.advance(1999);assert.equal(h.calls.length,0);
  await h.advance(1);assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].payload.text,'AB');assert.equal(h.calls[0].payload.status,'draft');
  assert.equal(h.engine.getState().dirty,false);assert.equal(h.engine.getState().phase,'saved');
  h.engine.dispose();
});
test('typing during a slow save stays dirty and the next save uses its acknowledged revision',async()=>{
  const first=deferred();const h=harness((r,n)=>n===1?first.promise:ack(r,n));
  h.engine.update({text:'First',status:'draft'});await h.advance(2000);
  h.engine.update({text:'Newest typing',status:'draft'});await h.advance(10000);
  assert.equal(h.calls.length,1);assert.equal(h.engine.getState().dirty,true);
  first.resolve(ack(h.calls[0],1));await settle();
  assert.equal(h.engine.getState().phase,'unsaved');
  await h.advance(2000);assert.equal(h.calls.length,2);
  assert.equal(h.calls[1].id,'saved-draft');assert.equal(h.calls[1].revision,0);
  assert.equal(h.calls[1].payload.text,'Newest typing');assert.equal(h.engine.getState().dirty,false);
  h.engine.dispose();
});
test('uncertain saves retry the identical request before sending newer typing',async()=>{
  const h=harness((r,n)=>n===1?Promise.reject(new TypeError('Network disconnected')):ack(r,n));
  h.engine.update({text:'Original request',status:'draft'});await h.advance(2000);
  assert.equal(h.engine.getState().phase,'error');
  h.engine.update({text:'Edited while offline',status:'draft'});await h.advance(5000);
  assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1],h.calls[0]);
  await h.advance(3000);assert.equal(h.calls.length,3);
  assert.equal(h.calls[2].payload.text,'Edited while offline');assert.equal(h.calls[2].id,'saved-draft');
  assert.notEqual(h.calls[2].requestId,h.calls[1].requestId);h.engine.dispose();
});
test('a concurrent coach save pauses autosave and never adopts their revision automatically',async()=>{
  const h=harness(()=>Promise.reject(Object.assign(new Error('Another coach saved'),{status:409})),{
    initialId:'existing',initialRevision:3,initialValue:{text:'Original',status:'draft'},
  });
  h.engine.update({text:'Local edits',status:'draft'});await h.advance(2000);
  assert.equal(h.engine.getState().phase,'conflict');
  h.engine.update({text:'Keep these edits',status:'draft'});await h.advance(60000);
  await assert.rejects(h.engine.flush(),/Another coach/);assert.equal(h.calls.length,1);
  assert.equal(h.engine.getState().revision,3);h.engine.dispose();
});
test('publish waits for an in-flight draft save and publishes the latest complete snapshot once',async()=>{
  const first=deferred();const h=harness((r,n)=>n===1?first.promise:ack(r,n));
  h.engine.update({text:'Earlier draft',status:'draft'});await h.advance(2000);
  h.engine.update({text:'Final script',status:'draft'});
  const publish=h.engine.flush('published');first.resolve(ack(h.calls[0],1));
  await publish;
  assert.equal(h.calls.length,2);assert.equal(h.calls[1].payload.status,'published');
  assert.equal(h.calls[1].payload.text,'Final script');assert.equal(h.calls[1].revision,0);
  assert.equal(h.engine.getState().dirty,false);
  await h.advance(60000);assert.equal(h.calls.length,2);h.engine.dispose();
});
test('continuous typing is saved periodically and disabled uploads wait until re-enabled',async()=>{
  const h=harness(ack);
  h.engine.setEnabled(false);h.engine.update({text:'Uploading',status:'draft'});
  await h.advance(15000);assert.equal(h.calls.length,0);
  h.engine.setEnabled(true);await h.advance(2000);assert.equal(h.calls.length,1);
  for(let i=0;i<24;i++){h.engine.update({text:'Continuous '+i,status:'draft'});await h.advance(500);}
  assert.ok(h.calls.length>=2);h.engine.dispose();
});
test('validation errors wait for corrections and published edits retain their status',async()=>{
  const h=harness((r,n)=>n===1?Promise.reject(Object.assign(new Error('Incomplete link'),{status:400})):ack(r,n),{
    initialId:'published',initialRevision:4,initialValue:{text:'Original',status:'published'},
  });
  h.engine.update({text:'Invalid',status:'published'});await h.advance(2000);await h.advance(30000);
  assert.equal(h.calls.length,1);
  h.engine.update({text:'Corrected',status:'published'});await h.advance(2000);
  assert.equal(h.calls.length,2);assert.equal(h.calls[1].payload.status,'published');
  assert.equal(h.calls[1].revision,4);assert.equal(h.engine.getState().phase,'saved');h.engine.dispose();
});
test('own live-update notification during a save does not falsely report a coach conflict',async()=>{
  const first=deferred();const h=harness(()=>first.promise,{
    initialId:'existing',initialRevision:0,initialValue:{text:'Original',status:'draft'},
  });
  h.engine.update({text:'Local',status:'draft'});await h.advance(2000);
  h.engine.observeRemote(1);assert.equal(h.engine.getState().phase,'saving');
  first.resolve({id:'existing',revision:1,status:'draft'});await settle();
  assert.equal(h.engine.getState().phase,'saved');
  h.engine.observeRemote(2);assert.equal(h.engine.getState().phase,'conflict');h.engine.dispose();
});

test('an uncertain publish keeps the editor locked and finishes without reverting to draft',async()=>{
  const h=harness((r,n)=>n===1?Promise.reject(new TypeError('Response lost')):ack(r,n));
  h.engine.update({text:'Ready to publish',status:'draft'});
  await assert.rejects(h.engine.flush('published'),/Response lost/);
  assert.equal(h.engine.getState().publishing,true);
  await h.advance(5000);
  assert.deepEqual(h.calls[1],h.calls[0]);
  assert.equal(h.engine.getState().phase,'saved');
  assert.equal(h.engine.getState().dirty,false);
  await h.advance(30000);assert.equal(h.calls.length,2);h.engine.dispose();
});
