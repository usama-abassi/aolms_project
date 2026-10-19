'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ticketDraft,type Ticket,type Field,type Draft} from '../../assurance/api';
import {randomId} from '../../../lib/uuid';
import {hasCellData,withEmptyRow} from './spreadsheet-rows';
import {type CellWrite,type CellChange} from './spreadsheet-selection'

export type ServerDraft={user_id:string;id:string;project_id:string;raw_values:Record<string,string>;errors:Record<string,string>;version:number;own_version?:number;record_version:number|null;state:'draft'|'record';mutation_id:string};
export type GridRow={id:string;values:Record<string,string>;base_version:number|null;draft_version:number;state:string;errors:Record<string,string>;record?:Ticket;pending:Array<{values:Record<string,string>;mutation_id:string}>};
export type GridConfig={manual?:boolean;recordsPath?:string;gridPath?:string};
export function useDeliveryGrid(projectId:string,userId:string,fields:Field[],tickets:Ticket[],drafts:ServerDraft[],technicians:Array<{id:string;full_name:string}>,config:GridConfig={}){
 const recordsPath=config.recordsPath||'/assurance-tickets',gridPath=config.gridPath||'/assurance-tickets/grid';
 const key=`aolms:${config.manual?'service-assurance':'delivery-grid'}:v2:${userId}:${projectId}`;
 const [error,setError]=useState('');
 const [,render]=useState(0);
 const snapshot=useRef<string|null>(null),blocked=useRef(false),mounted=useRef(true),busy=useRef(new Set<string>());
 const editingCache=useRef<Record<string,Record<string,string>>>({});
 const [hasRecovery,setHasRecovery]=useState(false);
 const rows=useRef<GridRow[]|null>(null);
 const reviewed=useRef(new Map<string,{record:Ticket|undefined;version:number}>());
 const stored=(row:GridRow)=>!!row.record||row.base_version!==null||row.draft_version>0||busy.current.has(row.id);
 const meaningful=(row:GridRow)=>stored(row)||hasCellData(row.values);
 function blank():GridRow{return {id:randomId(),values:{},base_version:null,draft_version:0,state:'draft',errors:{},pending:[]};}
 function normalize(preferred?:string){
  const previous=rows.current!;
  rows.current=withEmptyRow(previous,stored,blank,editingCache.current,preferred);
  for(const row of rows.current)if(!meaningful(row)){row.pending=[];row.errors={};row.state='draft';}
  return previous.length!==rows.current.length||previous.some((row,i)=>row!==rows.current![i]);
 }
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
    for(const row of cached.rows||[])if(row.pending?.length||hasCellData({...row.values,...cached.editing?.[row.id]})){map.set(row.id,{...row,record:map.get(row.id)?.record||row.record});}
    // A page closed while editing retains that text as a recoverable, uncommitted edit.
    editingCache.current=cached.editing||{};
    if(Object.values(editingCache.current).some(v=>Object.keys(v).length))setHasRecovery(true);
   }else if(!config.manual){
    const legacy=JSON.parse(localStorage.getItem(`aolms:assurance:v1:${userId}:${projectId}`)||'{}') as Record<string,Draft>;
    for(const d of Object.values(legacy))if(!drafts.some(s=>s.id===d.id))map.set(d.id,{...map.get(d.id),id:d.id,values:d.values,base_version:d.base_version,draft_version:0,state:'draft',errors:{},pending:[{values:d.values,mutation_id:d.mutation_id}]});
   }
  }catch{/* Preserve unreadable cache; persistence reports the error instead of discarding it. */blocked.current=true;}
  rows.current=[...map.values()];
  normalize();
 }
 function update(){if(mounted.current)render(v=>v+1);}
 function persist(){
  if(blocked.current){setError('Local draft storage changed or could not be read. Your edits remain on screen; export them before refreshing.');return false;}
  try{
   if(localStorage.getItem(key)!==snapshot.current){blocked.current=true;setError('This grid changed in another tab. Your text is retained; export before refreshing.');return false;}
   const value=JSON.stringify({rows:rows.current!.filter(row=>(row.pending.length&&meaningful(row))||Object.keys(editingCache.current[row.id]||{}).length),editing:editingCache.current});localStorage.setItem(key,value);snapshot.current=value;return true;
  }catch{setError('Browser backup is unavailable. Keep this page open until database saving succeeds.');return true;}
 }
 async function drain(id:string){
  if(busy.current.has(id)||blocked.current||!mounted.current||reviewed.current.has(id))return;
  busy.current.add(id);
  const row=rows.current!.find(r=>r.id===id)!;
  try{
   while(row.pending.length&&!blocked.current&&mounted.current){
    const task=row.pending[0];row.state='saving';update();
    const result=await api<{draft:ServerDraft;record:Ticket|null}>(gridPath,{method:'POST',body:JSON.stringify({id,project_id:projectId,values:task.values,mutation_id:task.mutation_id,base_version:row.base_version,draft_version:row.draft_version})});
    row.base_version=result.draft.record_version;row.draft_version=result.draft.version;row.errors=result.draft.errors;row.state=result.draft.state;
    if(result.record)row.record={...row.record,...result.record};
    row.pending.shift();persist();update();
   }
  }catch(e){row.state='pending';row.errors={...row.errors,_save:(e as Error).message};persist();update();}
  finally{busy.current.delete(id);}
 }
 function commitMany(writes:CellWrite[]){
  const changes:CellChange[]=[],affected=new Set<string>()
  const byId=new Map(rows.current!.map(row=>[row.id,row]))
  for(const write of writes){
   let row=byId.get(write.id)
   if(!row){
    row={...blank(),id:write.id}
    rows.current!.push(row)
    byId.set(row.id,row)
   }
   const before=row.values[write.key]??''
   if(before===write.value)continue
   changes.push({...write,before})
   row.values={...row.values,[write.key]:write.value}
   delete row.errors[write.key]
   delete row.errors._save
   affected.add(row.id)
  }
  for(const id of affected){
   const row=byId.get(id)!
   if(!meaningful(row)){
    row.pending=[]
    row.state='draft'
    row.errors={}
    delete editingCache.current[id]
    continue
   }
   const task={values:{...row.values},mutation_id:randomId()}
   if(config.manual)row.pending.splice(busy.current.has(id)?1:0,row.pending.length,task)
   else row.pending.push(task)
   row.state='pending'
  }
  normalize()
  update()
  if(persist()&&!config.manual)for(const id of affected)void drain(id)
  return changes
 }
 function commit(id:string,field:string,value:string){commitMany([{id,key:field,value}])}
 function add(){
  normalize();update();return rows.current!.length-1;
 }
 function cache(id:string,field:string,value:string|null){
  if(value===null){delete editingCache.current[id]?.[field];}else editingCache.current[id]={...editingCache.current[id],[field]:value};
  if(!Object.keys(editingCache.current[id]||{}).length||(!hasCellData(editingCache.current[id]||{})&&!meaningful(rows.current!.find(row=>row.id===id)!)))delete editingCache.current[id];
  const changed=normalize(id);persist();if(changed)update();
 }
 function recover(){
  setHasRecovery(false);
  const cached=editingCache.current;
  for(const [id,values] of Object.entries(cached))for(const [field,value] of Object.entries(values))if(rows.current!.some(r=>r.id===id))commit(id,field,value);
  editingCache.current={};normalize();persist();update();
 }
 function retry(){for(const row of rows.current!)if(row.pending.length&&meaningful(row))void drain(row.id);}
 async function loadReview(id:string){
  if(busy.current.has(id)){setError('This row is saving. Review it once the request finishes.');return false;}
  const [latest,serverDrafts]=await Promise.all([api<Ticket[]>(`${recordsPath}?project_id=${projectId}`),api<ServerDraft[]>(`${gridPath}?project_id=${projectId}`)]);
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
  update();if(persist()&&!config.manual)void drain(id);
 }
 useEffect(()=>{
  mounted.current=true;
  if(config.manual)return()=>{mounted.current=false;};
  retry();
  const online=()=>retry();window.addEventListener('online',online);
  const interval=setInterval(retry,10000);
  return()=>{mounted.current=false;window.removeEventListener('online',online);clearInterval(interval);};
 },[]);
 function exportDraft(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({rows:rows.current!.filter(row=>meaningful(row)||hasCellData(editingCache.current[row.id]||{})),editing:editingCache.current},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=config.manual?'service-assurance-drafts.json':'service-delivery-drafts.json';link.click();URL.revokeObjectURL(url);
 }
 return {get rows(){return rows.current!;},get recordCount(){return rows.current!.filter(meaningful).length;},error,commit,commitMany,add,cache,recover,exportDraft,retry,applyReviewed,loadReview,closeReview,reviewed:reviewed.current,hasRecovery};
}
