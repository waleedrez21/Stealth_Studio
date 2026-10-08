export type RichNode = {type:string;text?:string;attrs?:{level?:number;textAlign?:'left'|'center'|'right'|'justify';start?:number;href?:string};marks?:RichNode[];content?:RichNode[]};
export const RICH_PREFIX:string;
export function safeLink(value:unknown):string|null;
export function validateDocument(input:unknown):RichNode;
export function encodeDocument(doc:unknown):string;
export function documentFor(value:string):RichNode;
export function plainText(value:string):string;
export function normalizeText(value:string,limit:number):string;
