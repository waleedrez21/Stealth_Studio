// Versioned JSON inside existing string fields keeps legacy plain text readable.
// No HTML is stored or injected. Only this explicit node/mark schema is rendered.
export const RICH_PREFIX = 'stealth:rich:v1:';
const containers = new Set(['doc','paragraph','heading','blockquote','bulletList','orderedList','listItem','codeBlock']);
const leaves = new Set(['text','hardBreak','horizontalRule']);
const marks = new Set(['bold','italic','underline','strike','code','link']);
export function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return ['https:','http:','mailto:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function validateDocument(input) {
  let count = 0;
  function visit(node, depth) {
    if (++count > 5000 || depth > 20 || !node || typeof node !== 'object' || (!containers.has(node.type) && !leaves.has(node.type))) throw new Error('Unsupported text formatting.');
    const result = {type:node.type};
    if (node.type === 'text') {
      if (typeof node.text !== 'string') throw new Error('Invalid text.');
      result.text = node.text;
      if (node.marks) {
        if (!Array.isArray(node.marks) || node.marks.length > 6) throw new Error('Invalid text formatting.');
        result.marks = node.marks.map(mark => {
          if (!marks.has(mark?.type)) throw new Error('Unsupported text formatting.');
          if (mark.type === 'link') {
            const href = safeLink(mark.attrs?.href);
            if (!href) throw new Error('Links must use https://, http:// or mailto:.');
            return {type:'link',attrs:{href,target:'_blank',rel:'noopener noreferrer'}};
          }
          return {type:mark.type};
        });
      }
    }
    if (node.type === 'heading') result.attrs = {level:[2,3].includes(node.attrs?.level) ? node.attrs.level : 2};
    if (['paragraph','heading'].includes(node.type) && ['left','center','right','justify'].includes(node.attrs?.textAlign)) result.attrs = {...result.attrs,textAlign:node.attrs.textAlign};
    if (node.type === 'orderedList' && Number.isInteger(node.attrs?.start) && node.attrs.start >= 1 && node.attrs.start <= 10000) result.attrs = {start:node.attrs.start};
    if (containers.has(node.type)) {
      if (node.content !== undefined && !Array.isArray(node.content)) throw new Error('Invalid text content.');
      result.content = (node.content || []).map(child => visit(child,depth+1));
      const allowed = node.type === 'doc' || node.type === 'blockquote' ? ['paragraph','heading','blockquote','bulletList','orderedList','codeBlock','horizontalRule'] : node.type === 'listItem' ? ['paragraph','heading','blockquote','bulletList','orderedList','codeBlock'] : ['bulletList','orderedList'].includes(node.type) ? ['listItem'] : node.type === 'codeBlock' ? ['text'] : ['text','hardBreak'];
      if (result.content.some(child => !allowed.includes(child.type))) throw new Error('Invalid text structure.');
    }
    return result;
  }
  const doc = visit(input,0);
  if (doc.type !== 'doc') throw new Error('Invalid text document.');
  return doc;
}
export function encodeDocument(doc) { return RICH_PREFIX + JSON.stringify(validateDocument(doc)); }
export function documentFor(value) {
  if (value.startsWith(RICH_PREFIX)) return validateDocument(JSON.parse(value.slice(RICH_PREFIX.length)));
  return {type:'doc',content:value.split('\n').map(text => ({type:'paragraph',...(text ? {content:[{type:'text',text}]} : {})}))};
}
function textOf(node) {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  const parts = (node.content || []).map(textOf);
  return parts.join(['doc','blockquote','bulletList','orderedList','listItem'].includes(node.type) ? '\n' : '');
}
export function plainText(value) {
  if (!value.startsWith(RICH_PREFIX)) return value;
  try { return textOf(documentFor(value)); } catch { return ''; }
}
export function normalizeText(value, limit) {
  if (value.length > 300000) throw new Error('This text box is too long.');
  const normalized = value.startsWith(RICH_PREFIX) ? encodeDocument(documentFor(value)) : value;
  if (plainText(normalized).length > limit) throw new Error(`This text box allows up to ${limit.toLocaleString()} characters.`);
  return normalized;
}
