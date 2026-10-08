'use client';
import {useEffect,useRef,useState} from 'react';
import {EditorContent,useEditor,type JSONContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import {Bold,Italic,Underline,Strikethrough,List,ListOrdered,Quote,Link,Unlink,AlignLeft,AlignCenter,AlignRight,Undo2,Redo2,RemoveFormatting} from 'lucide-react';
import {documentFor,encodeDocument,plainText,safeLink} from './rich-text.js';
export default function RichTextEditor({value,onChange,label,maxLength,compact=false}:{value:string;onChange:(value:string)=>void;label:string;maxLength:number;compact?:boolean}){
  const callback=useRef(onChange);callback.current=onChange;
  const last=useRef(value);const[linkError,setLinkError]=useState('');
  const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:true,defaultProtocol:'https'}}),TextAlign.configure({types:['heading','paragraph']})],content:documentFor(value) as JSONContent,immediatelyRender:false,shouldRerenderOnTransaction:true,editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'rich-input'}},onUpdate:({editor})=>{const next=encodeDocument(editor.getJSON());last.current=next;callback.current(next);}});
  useEffect(()=>{if(editor&&value!==last.current){editor.commands.setContent(documentFor(value) as JSONContent,{emitUpdate:false});last.current=value;}},[editor,value]);
  const length=plainText(value).length;
  function link(){if(!editor)return;const input=window.prompt('Link URL (https://example.com or mailto:name@example.com)',editor.getAttributes('link').href||'https://');if(input===null)return;if(!input.trim()){editor.chain().focus().extendMarkRange('link').unsetLink().run();setLinkError('');return;}const href=safeLink(input.trim());if(!href){setLinkError('Enter a complete https://, http:// or mailto: link.');return;}editor.chain().focus().extendMarkRange('link').setLink({href}).run();setLinkError('');}
  function button(name:string,icon:React.ReactNode,action:()=>void,active=false,disabled=false){return <button key={name} type="button" title={name} aria-label={name} aria-pressed={active} disabled={!editor||disabled} onMouseDown={e=>e.preventDefault()} onClick={action}>{icon}</button>;}
  return <div className={`rich-editor ${compact?'compact':''}`}><div className="format-toolbar" role="toolbar" aria-label={`${label} formatting`}>
    <select aria-label="Text style" disabled={!editor} value={editor?.isActive('heading',{level:2})?'2':editor?.isActive('heading',{level:3})?'3':'p'} onChange={e=>{if(e.target.value==='p')editor?.chain().focus().setParagraph().run();else editor?.chain().focus().setHeading({level:Number(e.target.value) as 2|3}).run();}}><option value="p">Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option></select>
    {button('Bold',<Bold size={16}/>,()=>editor?.chain().focus().toggleBold().run(),editor?.isActive('bold'))}
    {button('Italic',<Italic size={16}/>,()=>editor?.chain().focus().toggleItalic().run(),editor?.isActive('italic'))}
    {button('Underline',<Underline size={16}/>,()=>editor?.chain().focus().toggleUnderline().run(),editor?.isActive('underline'))}
    {button('Strikethrough',<Strikethrough size={16}/>,()=>editor?.chain().focus().toggleStrike().run(),editor?.isActive('strike'))}
    <span className="format-divider"/>
    {button('Bullet list',<List size={17}/>,()=>editor?.chain().focus().toggleBulletList().run(),editor?.isActive('bulletList'))}
    {button('Numbered list',<ListOrdered size={17}/>,()=>editor?.chain().focus().toggleOrderedList().run(),editor?.isActive('orderedList'))}
    {button('Quote',<Quote size={16}/>,()=>editor?.chain().focus().toggleBlockquote().run(),editor?.isActive('blockquote'))}
    {button('Add or edit link',<Link size={16}/>,link,editor?.isActive('link'))}
    {button('Remove link',<Unlink size={16}/>,()=>editor?.chain().focus().extendMarkRange('link').unsetLink().run(),false,!editor?.isActive('link'))}
    <span className="format-divider"/>
    {button('Align left',<AlignLeft size={16}/>,()=>editor?.chain().focus().setTextAlign('left').run(),editor?.isActive({textAlign:'left'}))}
    {button('Align center',<AlignCenter size={16}/>,()=>editor?.chain().focus().setTextAlign('center').run(),editor?.isActive({textAlign:'center'}))}
    {button('Align right',<AlignRight size={16}/>,()=>editor?.chain().focus().setTextAlign('right').run(),editor?.isActive({textAlign:'right'}))}
    <span className="format-divider"/>
    {button('Undo',<Undo2 size={16}/>,()=>editor?.chain().focus().undo().run(),false,!editor?.can().undo())}
    {button('Redo',<Redo2 size={16}/>,()=>editor?.chain().focus().redo().run(),false,!editor?.can().redo())}
    {button('Clear formatting',<RemoveFormatting size={16}/>,()=>editor?.chain().focus().clearNodes().unsetAllMarks().unsetTextAlign().run())}
  </div><EditorContent editor={editor}/><div className={`rich-counter ${length>maxLength?'over-limit':''}`} role={length>maxLength?'alert':undefined}>{length.toLocaleString()} / {maxLength.toLocaleString()} characters</div>{linkError&&<p className="notice error" role="alert">{linkError}</p>}</div>;
}
