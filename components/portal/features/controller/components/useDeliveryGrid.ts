'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ticketDraft,type Ticket,type Field,type Draft} from '../../assurance/api';
import {randomId} from '../../../lib/uuid';

export type ServerDraft={user_id:string;id:string;project_id:string;raw_values:Record<string,string>;errors:Record<string,string>;version:number;own_version?:number;record_version:number|null;state:'draft'|'record';mutation_id:string};
export type GridRow={id:string;values:Record<string,string>;base_version:number|null;draft_version:number;state:string;errors:Record<string,string>;record?:Ticket;pending:Array<{values:Record<string,string>;mutation_id:string}>};
export function useDeliveryGrid(projectId:string,userId:string,fields:Field[],tickets:Ticket[],drafts:ServerDraft[],technicians:Array<{id:string;full_name:string}>){
 const key=`aolms:delivery-grid:v2:${userId}:${projectId}`;
 const [error,setError]=useState('');
 const [,render]=useState(0);
 const snapshot=useRef<string|null>(null),blocked=useRef(false),mounted=useRef(true),busy=useRef(new Set<string>());
 const editingCache=useRef<Record<string,Record<string,string>>>({});
 const [hasRecovery,setHasRecovery]=useState(false);
 const rows=useRef<GridRow[]|null>(null);
 const reviewed=useRef(new Map<string,{record:Ticket|undefined;version:number}>());
 if(!rows.current){
  const map=new Map(tickets.map(t=>{
   const values=ticketDraft(t,fields).values;
   values.technician_id=String(t.technician_name||technicians.find(p=>p.id===t.technician_id)?.full_name||t.technician_id||'');
   return [t.id,{id:t.id,values,record:t,base_version:t.version,draft_version:0,state:'record',errors:{},pending:[]}] as [string,GridRow];
  }));
  for(const d of drafts){const old=map.get(d.id),stale=d.state==='record'&&old&&old.base_version!==d.record_version;map.set(d.id,{...old,id:d.id,values:stale?old.values:d.raw_values,base_version:stale?old.base_version:d.record_version,draft_version:d.own_version??(d.user_id===userId?d.version:0),state:d.state,errors:d.errors,pending:[]});}
  try{
   snapshot.current=localStorage.getItem(key);
   if(snapshot.current){
    const cached=JSON.parse(snapshot.current);
    for(const row of cached.rows||[])if(row.pending?.length){map.set(row.id,{...row,record:map.get(row.id)?.record||row.record});}
    // A page closed while editing retains that text as a recoverable, uncommitted edit.
    editingCache.current=cached.editing||{};
    if(Object.values(editingCache.current).some(v=>Object.keys(v).length))setHasRecovery(true);
   }else{
    const legacy=JSON.parse(localStorage.getItem(`aolms:assurance:v1:${userId}:${projectId}`)||'{}') as Record<string,Draft>;
    for(const d of Object.values(legacy))if(!drafts.some(s=>s.id===d.id))map.set(d.id,{...map.get(d.id),id:d.id,values:d.values,base_version:d.base_version,draft_version:0,state:'draft',errors:{},pending:[{values:d.values,mutation_id:d.mutation_id}]});
   }
  }catch{/* Preserve unreadable cache; persistence reports the error instead of discarding it. */blocked.current=true;}
  rows.current=[...map.values()];
 }
 function update(){if(mounted.current)render(v=>v+1);}
 function persist(){
  if(blocked.current){setError('Local draft storage changed or could not be read. Your edits remain on screen; export them before refreshing.');return false;}
  try{
   if(localStorage.getItem(key)!==snapshot.current){blocked.current=true;setError('This grid changed in another tab. Your text is retained; export before refreshing.');return false;}
   const value=JSON.stringify({rows:rows.current!.filter(row=>row.pending.length),editing:editingCache.current});localStorage.setItem(key,value);snapshot.current=value;return true;
  }catch{setError('Browser backup is unavailable. Keep this page open until database saving succeeds.');return true;}
 }
 async function drain(id:string){
  if(busy.current.has(id)||blocked.current||!mounted.current||reviewed.current.has(id))return;
  busy.current.add(id);
  const row=rows.current!.find(r=>r.id===id)!;
  try{
   while(row.pending.length&&!blocked.current&&mounted.current){
    const task=row.pending[0];row.state='saving';update();
    const result=await api<{draft:ServerDraft;record:Ticket|null}>('/assurance-tickets/grid',{method:'POST',body:JSON.stringify({id,project_id:projectId,values:task.values,mutation_id:task.mutation_id,base_version:row.base_version,draft_version:row.draft_version})});
    row.base_version=result.draft.record_version;row.draft_version=result.draft.version;row.errors=result.draft.errors;row.state=result.draft.state;
    if(result.record)row.record={...row.record,...result.record};
    row.pending.shift();persist();update();
   }
  }catch(e){row.state='pending';row.errors={...row.errors,_save:(e as Error).message};persist();update();}
  finally{busy.current.delete(id);}
 }
 function commit(id:string,field:string,value:string){
  const row=rows.current!.find(r=>r.id===id)!;
  if(row.values[field]===value)return;
  row.values={...row.values,[field]:value};delete row.errors[field];delete row.errors._save;
  row.pending.push({values:{...row.values},mutation_id:randomId()});row.state='pending';update();if(persist())void drain(id);
 }
 function add(){
  const id=randomId(),values:Record<string,string>={};
  rows.current!.push({id,values,base_version:null,draft_version:0,state:'pending',errors:{},pending:[{values,mutation_id:randomId()}]});
  update();if(persist())void drain(id);return rows.current!.length-1;
 }
 function cache(id:string,field:string,value:string|null){
  if(value===null){delete editingCache.current[id]?.[field];}else editingCache.current[id]={...editingCache.current[id],[field]:value};
  persist();
 }
 function recover(){
  setHasRecovery(false);
  const cached=editingCache.current;editingCache.current={};
  for(const [id,values] of Object.entries(cached))for(const [field,value] of Object.entries(values))if(rows.current!.some(r=>r.id===id))commit(id,field,value);
  persist();update();
 }
 function retry(){for(const row of rows.current!)if(row.pending.length)void drain(row.id);}
 async function loadReview(id:string){
  if(busy.current.has(id)){setError('This row is saving. Review it once the request finishes.');return false;}
  const [latest,serverDrafts]=await Promise.all([api<Ticket[]>(`/assurance-tickets?project_id=${projectId}`),api<ServerDraft[]>(`/assurance-tickets/grid?project_id=${projectId}`)]);
  const d=serverDrafts.find(d=>d.id===id),record=latest.find(t=>t.id===id);
  reviewed.current.set(id,{record,version:d?.own_version??(d?.user_id===userId?d.version:0)});
  update();return true;
 }
 function closeReview(id:string){reviewed.current.delete(id);update();}
 function applyReviewed(id:string){
  const row=rows.current!.find(r=>r.id===id)!;
  const current=reviewed.current.get(id);if(!current||busy.current.has(id))return;
  row.record=current.record;row.base_version=current.record?.version??null;row.draft_version=current.version;
  row.pending=[{values:{...row.values},mutation_id:randomId()}];row.errors={};row.state='pending';
  reviewed.current.delete(id);
  update();if(persist())void drain(id);
 }
 useEffect(()=>{
  mounted.current=true;retry();
  const online=()=>retry();window.addEventListener('online',online);
  const interval=setInterval(retry,10000);
  return()=>{mounted.current=false;window.removeEventListener('online',online);clearInterval(interval);};
 },[]);
 function exportDraft(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({rows:rows.current,editing:editingCache.current},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='service-delivery-drafts.json';link.click();URL.revokeObjectURL(url);
 }
 return {rows:rows.current!,error,commit,add,cache,recover,exportDraft,retry,applyReviewed,loadReview,closeReview,reviewed:reviewed.current,hasRecovery};
}
