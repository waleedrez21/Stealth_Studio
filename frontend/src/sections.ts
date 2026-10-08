import {plainText} from './rich-text.js';
import type {Block} from './data';
export const sectionLabels=['Note','On-screen text','Script','CTA','Captions','Audio','Background','Description'] as const;
export type SectionLabel=typeof sectionLabels[number];
export const sectionHelp:Record<SectionLabel,string>={
  Note:'Context or important information before filming.',
  'On-screen text':'The main hook or text shown on screen.',
  Script:'Dialogue, scene changes, and directions for the creator.',
  CTA:'What viewers should do at the end of the video.',
  Captions:'Subtitle font, placement, and timing instructions.',
  Audio:'Add a sound or music link and any audio directions, or choose None.',
  Background:'Filming location, lighting, and framing.',
  Description:'The social post caption and hashtags.'
};
export function templateBlocks(existing:Block[]=[]):Block[]{
  // Retain legacy content and visuals when opening an older script.
  const blocks=existing.map(b=>({...b}));
  if(!blocks.some(b=>b.type==='text'&&b.section==='Script')){
    const first=blocks.find(b=>b.type==='text'&&!b.section);
    if(first?.type==='text')first.section='Script';
  }
  for(const b of blocks){if(b.type==='text'&&b.section==='Audio'&&!b.audio&&plainText(b.text).trim().toUpperCase()==='NONE')b.audio={mode:'none',url:''};}
  const named=sectionLabels.map(section=>blocks.find(b=>b.type==='text'&&b.section===section)||{type:'text' as const,section,text:''});
  return [...named,...blocks.filter(b=>b.type!=='text'||!b.section)];
}

export function cardSummary(script:{summary:string;blocks:Block[]}):string{
  const summary=plainText(script.summary).trim();if(summary)return summary;
  const block=script.blocks.find(b=>b.type==='text'&&b.section==='Script'&&plainText(b.text).trim())||script.blocks.find(b=>b.type==='text'&&!b.section&&plainText(b.text).trim());
  return block?.type==='text'?plainText(block.text).trim().slice(0,180):'';
}
