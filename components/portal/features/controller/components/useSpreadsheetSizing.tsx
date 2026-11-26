'use client';
import {useRef,useState} from 'react';

export function useSpreadsheetSizing(keys:string[],rowHeaderWidth=56){
 const [columns,setColumns]=useState<Record<string,number>>({});
 const [rows,setRows]=useState<Record<string,number>>({});
 const widths=keys.map(key=>columns[key]??144);
 return {
  width:rowHeaderWidth+widths.reduce((sum,width)=>sum+width,0),
  columns:<colgroup><col style={{width:rowHeaderWidth}}/>{keys.map((key,i)=><col key={key} style={{width:widths[i]}}/>)}</colgroup>,
  columnHandle:(key:string,label:string)=><ResizeHandle label={`Resize ${label} column`} axis="column" onResize={size=>setColumns(current=>({...current,[key]:size}))}/>,
  rowHandle:(id:string,index:number)=><ResizeHandle label={`Resize row ${index+1}`} axis="row" onResize={size=>setRows(current=>({...current,[id]:size}))}/>,
  rowHeight:(id:string)=>rows[id],
  editorHeight:(id:string)=>rows[id]===undefined?undefined:Math.max(22,rows[id]-2),
 };
}

function ResizeHandle({label,axis,onResize}:{label:string;axis:'row'|'column';onResize:(size:number)=>void}){
 const drag=useRef<{position:number;size:number}|null>(null),column=axis==='column';
 const sizeOf=(el:HTMLElement)=>{
  const target=column?el.closest('th'):el.closest('tr');
  const size=target?.getBoundingClientRect();
  return (column?size?.width:size?.height)??0;
 };
 const resize=(size:number)=>onResize(Math.round(Math.max(column?56:24,Math.min(column?800:320,size))));
 return <button type="button" aria-label={label} title={label}
  className={`absolute z-10 touch-none rounded-sm hover:bg-primary-500/40 focus-visible:bg-primary-500/40 ${column?'inset-y-0 right-0 w-3 cursor-col-resize':'inset-x-0 bottom-0 h-2.5 cursor-row-resize'}`}
  onPointerDown={event=>{
   if(event.button!==0)return;
   event.stopPropagation();
   event.currentTarget.setPointerCapture(event.pointerId);
   drag.current={position:column?event.clientX:event.clientY,size:sizeOf(event.currentTarget)};
  }}
  onPointerMove={event=>{if(drag.current)resize(drag.current.size+(column?event.clientX:event.clientY)-drag.current.position);}}
  onLostPointerCapture={()=>{drag.current=null;}}
  onKeyDown={event=>{
   const keys=column?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
   if(!keys.includes(event.key))return;
   event.preventDefault();event.stopPropagation();
   resize(sizeOf(event.currentTarget)+(event.key===keys[0]?-8:8));
  }}
 />;
}
