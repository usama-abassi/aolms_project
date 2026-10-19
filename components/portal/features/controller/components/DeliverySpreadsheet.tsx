'use client';
import {randomId} from '../../../lib/uuid';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {controllerFields,orderValues,type Values} from '@/lib/services/service-delivery/model';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import PlainTextCell from './PlainTextCell';
import {hasCellData,withEmptyRow,gridDestination,gridPage} from './spreadsheet-rows';
import {useGridFocus} from './useGridFocus';
import SpreadsheetInteraction from './SpreadsheetInteraction'
import {type CellWrite,type CellChange} from './spreadsheet-selection'
type Row={id:string;version:number|null;values:Values;dirty?:boolean;error?:string};
export default function DeliverySpreadsheet({projectId,userId}:{projectId:string;userId:string}){
 const meta=useQuery({queryKey:['delivery-metadata'],queryFn:()=>api<{technicians:any[]}>('/service-delivery/workflow?mode=metadata')});
 const query=useQuery({queryKey:['delivery-orders',projectId],queryFn:()=>api<any[]>(`/service-delivery/workflow?project_id=${projectId}`)});
 const [rows,setRows]=useState<Row[]>([]),[search,setSearch]=useState(''),[action,setAction]=useState(''),[team,setTeam]=useState(''),[sort,setSort]=useState('work_date'),[asc,setAsc]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [review,setReview]=useState<{local:Row;server:any}|null>(null);
 const loaded=useRef(false),table=useRef<HTMLTableElement>(null),key=`delivery-sheet:${userId}:${projectId}`;
 const focusCell=useGridFocus(table);
 const rowsRef=useRef<Row[]>([]),editing=useRef<Record<string,Record<string,string>>>({});
 const stored=(row:Row)=>row.version!==null;
 const meaningful=(row:Row)=>stored(row)||hasCellData(row.values);
 const blank=():Row=>({id:randomId(),version:null,values:Object.fromEntries(controllerFields.map(f=>[f.key,'']))});
 function update(next:Row[],preferred?:string){
  next=withEmptyRow(next,stored,blank,editing.current,preferred);
  const changed=next.length!==rowsRef.current.length||next.some((row,i)=>row!==rowsRef.current[i]);
  rowsRef.current=next;if(changed)setRows(next);
  try{localStorage.setItem(key,JSON.stringify(next.filter(r=>r.dirty&&meaningful(r))));
   const uncommitted=next.filter(r=>Object.keys(editing.current[r.id]||{}).length).map(r=>({...r,values:{...r.values,...editing.current[r.id]},dirty:true}));
   if(uncommitted.length)localStorage.setItem(key+':editing',JSON.stringify(uncommitted));else localStorage.removeItem(key+':editing');
  }catch{setNotice('Browser storage is unavailable. Save before leaving.');}
 }
 useEffect(()=>{if(!query.data||loaded.current)return;loaded.current=true;let local:Row[]=[];try{
  const committed:Row[]=JSON.parse(localStorage.getItem(key)||'[]'),uncommitted:Row[]=JSON.parse(localStorage.getItem(key+':editing')||'[]');
  local=[...committed.filter(r=>!uncommitted.some(e=>e.id===r.id)),...uncommitted].filter(meaningful);
 }catch{}const server=query.data.map(t=>({id:t.id,version:t.version,values:orderValues(t)}));
 update([...server.map(r=>local.find(l=>l.id===r.id&&l.dirty)||r),...local.filter(l=>l.dirty&&!server.some(r=>r.id===l.id))]);},[query.data,key]);
 function change(id:string,k:string,value:string){update(rowsRef.current.map(r=>{
  if(r.id!==id)return r;const values={...r.values,[k]:value};return {...r,dirty:stored(r)||hasCellData(values),error:undefined,values};
 }),id);}
 function changeMany(writes:CellWrite[]){
  const changes:CellChange[]=[],byId=new Map(rowsRef.current.map(r=>[r.id,r]))
  for(const write of writes){
   const row=byId.get(write.id)||{...blank(),id:write.id}
   const before=row.values[write.key]??''
   if(before===write.value)continue
   changes.push({...write,before})
   const values={...row.values,[write.key]:write.value}
   byId.set(row.id,{...row,values,dirty:stored(row)||hasCellData(values),error:undefined})
  }
  update([...byId.values()])
  return changes
 }
 function cache(id:string,k:string,value:string|null){
  if(value===null)delete editing.current[id]?.[k];else editing.current[id]={...editing.current[id],[k]:value};
  const row=rowsRef.current.find(r=>r.id===id);
  if(!Object.keys(editing.current[id]||{}).length||(!hasCellData(editing.current[id]||{})&&row&&!meaningful(row)))delete editing.current[id];
  update(rowsRef.current,id);
 }
 async function save(){setBusy(true);setNotice('');let next=[...rowsRef.current];for(const row of next.filter(r=>r.dirty&&meaningful(r))){try{const t=await api<any>('/service-delivery/workflow',{method:'POST',body:JSON.stringify({id:row.id,project_id:projectId,base_version:row.version,mutation_id:randomId(),values:row.values})});next=next.map(r=>r.id===row.id?{id:t.id,version:t.version,values:orderValues(t)}:r);}catch(e){next=next.map(r=>r.id===row.id?{...r,error:(e as Error).message}:r);}}update(next);setBusy(false);}
 function view(){
  const actual=rowsRef.current.filter(meaningful);
  const matches=(r:Row)=>(!action||r.values.actioned===action)&&(!team||r.values.technician_id===team)&&Object.values(r.values).some(v=>v.toLowerCase().includes(search.toLowerCase()));
  // New orders stay at the bottom while being entered, including under filters.
  const existing=actual.filter(r=>stored(r)&&matches(r)).sort((a,b)=>(asc?1:-1)*String(a.values[sort]||'').localeCompare(String(b.values[sort]||''),undefined,{numeric:true}));
  return {records:[...existing,...actual.filter(r=>!stored(r))],extra:rowsRef.current.filter(r=>!meaningful(r))};
 }
 const {records:filtered,extra}=view(),pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(page,pages-1);
 const visible=[...filtered.slice(current*25,current*25+25),...(current===pages-1?extra:[])];
 function focus(row:number,col:number){
  const latest=view(),all=[...latest.records,...latest.extra];if(row<0||row>=all.length||col<0||col>=controllerFields.length)return;
  setPage(gridPage(row,latest.records.length));
  focusCell(row,col);
 }
 function move(id:string,fallback:number,col:number,k:string,shift:boolean){
  const latest=view(),index=[...latest.records,...latest.extra].findIndex(r=>r.id===id);
  const target=gridDestination(index<0?fallback:index,col,k,shift,controllerFields.length);if(target)focus(target.row,target.col);
 }
 function add(){
  const latest=view(),row=latest.records.length+latest.extra.length-1;
  const existing=gridPage(row,latest.records.length)===current?table.current?.querySelector<HTMLElement>(`[data-cell="${row}:0"]`):null;
  if(existing)existing.focus();else focus(row,0);
 }
 if(query.isPending||meta.isPending)return <p>Loading Service Delivery…</p>;
 if(query.error||meta.error)return <p role="alert">{query.error?.message||meta.error?.message}</p>;
 return <div className="space-y-3"><h2 className="text-xl font-semibold">Service Delivery</h2><p>Only Actioned = Delivered orders appear in Technician work. Type to replace a cell; arrows, Enter or Tab commit locally and move. F2 or double-click edits within the text. New rows appear automatically; Save rows persists changes. Unsent changes are cached locally.</p>
 <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={add}>Add order</Button><Button disabled={busy||!rows.some(r=>r.dirty)} onClick={save}>{busy?'Saving…':'Save rows'}</Button><Button variant="outline" disabled={busy||rows.some(r=>r.dirty)} onClick={async()=>{loaded.current=false;await query.refetch();}}>Refresh</Button><span>{rows.filter(r=>r.dirty).length} unsaved</span></div>
 <div className="flex flex-wrap gap-2"><input aria-label="Search orders" className="rounded border bg-transparent p-2" placeholder="Search orders" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/><select aria-label="Actioned filter" value={action} onChange={e=>{setAction(e.target.value);setPage(0);}} className="rounded border bg-transparent"><option value="">All Actioned values</option>{Array.from(new Set(rows.map(r=>r.values.actioned))).filter(Boolean).map(a=><option key={a}>{a}</option>)}</select><select aria-label="Team filter" value={team} onChange={e=>{setTeam(e.target.value);setPage(0);}} className="rounded border bg-transparent"><option value="">All Teams</option>{meta.data?.technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
 {notice&&<p role="status">{notice}</p>}<SpreadsheetInteraction rows={[...filtered,...extra]} fields={controllerFields} technicians={meta.data!.technicians} apply={changeMany} focus={focus} disabled={busy}><fieldset disabled={busy}><div data-grid-scroll className="max-h-[65vh] overflow-auto"><table ref={table} className="border-collapse text-sm" aria-label="Service Delivery spreadsheet"><thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800"><tr><th className="p-2">Save status</th>{controllerFields.map(f=><th key={f.key} className="min-w-48 border p-2 text-left"><button onClick={()=>{setSort(f.key);setAsc(sort===f.key?!asc:true);}}>{f.column} · {f.label}{sort===f.key?(asc?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{visible.map((r,localIndex)=>{const i=current*25+localIndex;return <tr key={r.id}><td className="min-w-48 border p-2">{r.error?<><span role="alert">{r.error}</span><Button variant="outline" onClick={async()=>{try{const result=await query.refetch();if(result.error)throw result.error;setReview({local:r,server:result.data?.find(t=>t.id===r.id)||null});}catch(e){setNotice((e as Error).message);}}}>Review latest</Button></>:!meaningful(r)?'New row':r.dirty?'Unsaved':'Saved'}</td>{controllerFields.map((f,c)=><td key={f.key} className="border">{f.type==='technician'?<select data-cell={`${i}:${c}`} aria-label={`Team row ${i+1}`} value={r.values[f.key]} className="min-w-48 border-0 bg-transparent" onChange={e=>change(r.id,f.key,e.target.value)} onKeyDown={e=>{if(e.currentTarget.dataset.gridEditing!=='true'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&['Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(r.id,i,c,e.key,e.shiftKey);}}}><option value="">Unassigned</option>{r.values[f.key]&&!meta.data?.technicians.some(t=>t.id===r.values[f.key])&&<option value={r.values[f.key]}>Previous Team</option>}{meta.data?.technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>:<PlainTextCell value={r.values[f.key]} label={`${f.label} row ${i+1}`} cell={`${i}:${c}`} readOnly={false} onCommit={v=>change(r.id,f.key,v)} onCache={v=>cache(r.id,f.key,v)} onSelect={()=>{}} onMove={(k,shift)=>move(r.id,i,c,k,shift)}/>}</td>)}</tr>;})}</tbody></table></div></fieldset></SpreadsheetInteraction>
 <div className="flex gap-3"><Button variant="outline" disabled={!current} onClick={()=>setPage(current-1)}>Previous</Button><span>{filtered.length} orders · Page {current+1} of {pages}</span><Button variant="outline" disabled={(current+1)*25>=filtered.length} onClick={()=>setPage(current+1)}>Next</Button></div>{review&&<Modal isOpen onClose={()=>setReview(null)} title="Review order changes" size="lg"><div className="grid gap-3 sm:grid-cols-2"><div><h3>Your draft</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap">{JSON.stringify(review.local.values,null,2)}</pre></div><div><h3>Latest saved values</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap">{JSON.stringify(review.server?orderValues(review.server):null,null,2)}</pre></div></div><Button onClick={()=>{update(rows.map(r=>r.id===review.local.id?{...r,version:review.server?.version??null,error:''}:r));setReview(null);}}>Keep draft against reviewed version</Button><Button variant="outline" onClick={()=>{update(rows.flatMap(r=>r.id!==review.local.id?[r]:review.server?[{id:r.id,version:review.server.version,values:orderValues(review.server)}]:[]));setReview(null);}}>Discard local changes</Button></Modal>}</div>;
}
