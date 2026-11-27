'use client';
import {useRef,useState} from 'react';

export function spreadsheetColumnLabel(index:number){
 let label='';
 for(let n=index+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;
 return label;
}

// Defaults follow the amount of content each controller field needs.
const defaultWidths:Record<string,number>={
 date:80,work_date:80,exchange:68,block:62,road:62,building:64,flat:58,slot:58,
 ticket_number:100,mobile:112,circuit:124,cpr_cr:100,
 technician_id:154,team:154,controller:112,lo_name:124,package:176,
 order_type:134,connection_type:130,fttr_type:116,actioned:100,status:100,
 appointment:100,task_created_at:154,order_created_at:154,creation_datetime:154,assigned_datetime:154,close_datetime:154,
 item_category:110,ont_protection:110,internal_wiring:112,actual_actioned_item:148,actual_actioned_sub_item:148,
 cable_type:104,cable_length:88,conduit_clearance:104,conduit_pipe:96,pvc_trunk:88,total_conduit:96,
 mims_sn:136,nce_sn:136,ap1_sn:136,ap2_sn:136,ap3_sn:136,ap4_sn:136,retrieved_cpe:136,
 controller_remarks:200,action_remarks:200,final_remarks:200,sub_root_cause:192,
 assurance_program:148,fault_description:200,description:200,service_type:118,
 sla:104,kpi:110,exceeded_reason:180,root_cause:156,resolution:156,resolution_description:200,
 mims:112,faulty:200,old_model:132,old_serial:136,ont_model:132,new_serial:136,
 protection_box:116,saas_type:100,box_number:96,fahad:100,saas_assurance:112,physical_verification:136,location:136,closed:80,
};

export function useSpreadsheetSizing(keys:string[],rowHeaderWidth=56){
 const [columns,setColumns]=useState<Record<string,number>>({});
 const [rows,setRows]=useState<Record<string,number>>({});
 const widths=keys.map(key=>columns[key]??defaultWidths[key]??144);
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
 return <button type="button" data-grid-resize={axis} aria-label={label} title={label}
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
