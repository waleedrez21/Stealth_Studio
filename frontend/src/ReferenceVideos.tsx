import {Video,ExternalLink} from 'lucide-react';
import {safeLink} from './rich-text.js';
export type ReferenceVideo={label:string;url:string};
export function videoUrl(value:string){const url=safeLink(value);return url&&/^https?:\/\//.test(url)?url:null;}
export default function ReferenceVideos({references=[]}:{references?:ReferenceVideo[]}){
  const links=references.filter(r=>videoUrl(r.url));
  if(!links.length)return null;
  return <section className="reference-videos" aria-label="Reference videos"><h2><Video size={18}/>Video Inspiration</h2><div className="reference-list">{links.map((ref,i)=><a key={i} href={videoUrl(ref.url)!} target="_blank" rel="noopener noreferrer"><div><strong>{ref.label||`Video Inspiration ${i+1}`}</strong><span>{ref.url}</span></div><ExternalLink size={17}/></a>)}</div></section>;
}
