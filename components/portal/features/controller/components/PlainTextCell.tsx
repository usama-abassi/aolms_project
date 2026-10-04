'use client';
import {useEffect,useRef,useState} from 'react';

export function timestampShortcut(shift:boolean,alt:boolean){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bahrain',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}:${parts.second}`;
 return shift?(alt?`${date} ${time}`:time):date;
}
export default function PlainTextCell({value,label,cell,readOnly,error,onCommit,onMove,onSelect,onCache}:{value:string;label:string;cell:string;readOnly:boolean;error?:string;onCommit:(value:string)=>void;onMove:(key:string,shift:boolean)=>void;onSelect:()=>void;onCache:(value:string|null)=>void}){
 const [editing,setEditing]=useState(false),[text,setText]=useState(value);
 const input=useRef<HTMLTextAreaElement>(null),buffer=useRef(value),original=useRef(value),editingRef=useRef(false);
 useEffect(()=>{if(!editingRef.current){setText(value);buffer.current=value;}},[value]);
 function start(next=value,end=true){
  if(readOnly)return;
  original.current=value;buffer.current=next;editingRef.current=true;setEditing(true);setText(next);onCache(next);
  requestAnimationFrame(()=>{if(end)input.current?.setSelectionRange(buffer.current.length,buffer.current.length);});
 }
 function commit(){if(!editingRef.current)return;editingRef.current=false;setEditing(false);onCache(null);if(buffer.current!==original.current)onCommit(buffer.current);}
 function replaceSelection(insert:string){
  if(readOnly)return;
  if(!editingRef.current){start(insert);return;}
  const el=input.current!,a=el.selectionStart,b=el.selectionEnd,next=buffer.current.slice(0,a)+insert+buffer.current.slice(b);
  buffer.current=next;setText(next);onCache(next);requestAnimationFrame(()=>el.setSelectionRange(a+insert.length,a+insert.length));
 }
 return <textarea ref={input} aria-label={label} aria-readonly={readOnly} aria-invalid={!!error} title={error||(readOnly?'Automatic field (read-only)':undefined)} data-cell={cell} data-editing={editing} rows={Math.max(1,Math.min(5,text.split('\n').length))} value={text} readOnly={readOnly||!editing}
  className={`block w-full min-w-48 resize-none border-0 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 ${readOnly?'bg-neutral-100 text-neutral-500 dark:bg-neutral-800':'bg-transparent'}`}
  onFocus={()=>{if(!editingRef.current){original.current=value;buffer.current=value;} }}
  onPointerDown={()=>{onSelect();}}
  onDoubleClick={()=>start(value)}
  onBlur={commit}
  onChange={e=>{buffer.current=e.target.value;setText(e.target.value);onCache(e.target.value);}}
  onPaste={e=>{if(readOnly){e.preventDefault();return;}if(!editingRef.current){e.preventDefault();start(e.clipboardData.getData('text/plain'));}}}
  onKeyDown={e=>{
   if(e.nativeEvent.isComposing||e.key==='Process')return;
   const mod=e.ctrlKey||e.metaKey;
   if(mod&&(e.key===';'||e.key===':'||e.code==='Semicolon')&&(!e.altKey||e.shiftKey)){
    e.preventDefault();replaceSelection(timestampShortcut(e.shiftKey,e.altKey));return;
   }
   if(e.key==='Escape'&&editingRef.current){e.preventDefault();buffer.current=original.current;setText(original.current);editingRef.current=false;setEditing(false);onCache(null);return;}
   if(e.key==='F2'){e.preventDefault();start(value);return;}
   if(e.key==='Enter'&&e.altKey&&!mod){e.preventDefault();replaceSelection('\n');return;}
   if(e.key==='Enter'||e.key==='Tab'){
    // Leave fill-selection shortcuts for Phase 2.
    if(mod)return;
    e.preventDefault();commit();onMove(e.key,e.shiftKey);return;
   }
   if((!editingRef.current||e.altKey)&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&!mod&&!e.shiftKey){e.preventDefault();commit();onMove(e.key,false);return;}
   if(!editingRef.current&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();if(!readOnly){setText('');buffer.current='';onCommit('');}return;}
   if(!editingRef.current&&!readOnly&&!mod&&!e.altKey&&e.key.length===1){e.preventDefault();start(e.key);}
  }}/>;
}
