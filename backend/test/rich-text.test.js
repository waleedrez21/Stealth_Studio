import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeDocument,documentFor,plainText,normalizeText,RICH_PREFIX} from '../src/rich-text.js';
import {scriptInput} from '../src/validation.js';
const doc={type:'doc',content:[{type:'heading',attrs:{level:2,textAlign:'center'},content:[{type:'text',text:'Hook',marks:[{type:'bold'},{type:'italic'},{type:'underline'}]}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Read this',marks:[{type:'link',attrs:{href:'https://example.com',onclick:'bad'}}]}]}]}]}]};
test('rich documents round-trip formatting, lists and alignment with safe attributes',()=>{
 const value=encodeDocument(doc);assert.equal(plainText(value),'Hook\nRead this');
 const parsed=documentFor(value);assert.deepEqual(parsed.content[0].attrs,{level:2,textAlign:'center'});
 const link=parsed.content[1].content[0].content[0].content[0].marks[0];assert.equal(link.attrs.href,'https://example.com/');assert.equal(link.attrs.onclick,undefined);assert.equal(link.attrs.rel,'noopener noreferrer');
 assert.equal(normalizeText(value,14),value);assert.throws(()=>normalizeText(value,5),/characters/);
});
test('legacy text is preserved and markup is always text',()=>{
 const legacy='Old script\n<script>alert(1)</script>';assert.equal(normalizeText(legacy,100),legacy);assert.equal(documentFor(legacy).content[1].content[0].text,'<script>alert(1)</script>');assert.equal(plainText(encodeDocument(documentFor(legacy))),legacy);
});
test('rejects unsafe links, unknown nodes, broken structures and excessive depth',()=>{
 for(const href of ['javascript:alert(1)','data:text/html,bad','https://good.example\n.bad'])assert.throws(()=>encodeDocument({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Bad',marks:[{type:'link',attrs:{href}}]}]}]}));
 assert.throws(()=>normalizeText(RICH_PREFIX+'{"type":"iframe"}',100));assert.throws(()=>encodeDocument({type:'doc',content:[{type:'text',text:'invalid child'}]}));
 let tree={type:'paragraph',content:[]};for(let i=0;i<25;i++)tree={type:'blockquote',content:[tree]};assert.throws(()=>encodeDocument({type:'doc',content:[tree]}));
});
test('published rich text needs visible content and limits count text rather than JSON',()=>{
 const base={title:'Title',summary:encodeDocument(doc),notes:'',status:'published',blocks:[{type:'text',text:encodeDocument(doc)}]};assert.equal(scriptInput.safeParse(base).success,true);
 const empty=encodeDocument({type:'doc',content:[{type:'paragraph'}]});assert.equal(scriptInput.safeParse({...base,summary:empty}).success,true);assert.equal(scriptInput.safeParse({...base,blocks:[{type:'text',text:empty}]}).success,false);
 assert.equal(scriptInput.safeParse({...base,summary:encodeDocument({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x'.repeat(301)}]}]})}).success,false);
});
