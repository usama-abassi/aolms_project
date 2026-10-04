'use client';
import {useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Lock} from 'lucide-react';
import {api,type Field,type Ticket} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import ShortcutsGuide from './ShortcutsGuide';
import PlainTextCell from './PlainTextCell';
import {useDeliveryGrid,type ServerDraft} from './useDeliveryGrid';
import {protectedGridFields} from '@/lib/services/assurance-tickets/grid-values';

export default function AssuranceSpreadsheet({projectId,userId}:{projectId:string;userId:string}){
 const meta=useQuery({queryKey:['assurance-metadata',userId],queryFn:()=>api<{fields:Field[];technicians:Array<{id:string;full_name:string}>}>('/assurance-tickets/metadata')});
 const records=useQuery({queryKey:['assurance-tickets',userId,projectId],queryFn:()=>api<Ticket[]>(`/assurance-tickets?project_id=${projectId}`)});
 const drafts=useQuery({queryKey:['delivery-grid-drafts',userId,projectId],queryFn:()=>api<ServerDraft[]>(`/assurance-tickets/grid?project_id=${projectId}`)});
 const [refreshKey,setRefreshKey]=useState(0);
 if(meta.isPending||records.isPending||drafts.isPending)return <p>Loading Service Delivery...</p>;
 if(meta.error||records.error||drafts.error)return <p role="alert">{meta.error?.message||records.error?.message||drafts.error?.message}</p>;
 return <DeliveryGrid key={`${projectId}:${userId}:${refreshKey}`} projectId={projectId} userId={userId} fields={meta.data!.fields} technicians={meta.data!.technicians} tickets={records.data!} drafts={drafts.data!} refresh={async()=>{await Promise.all([records.refetch(),drafts.refetch()]);setRefreshKey(v=>v+1);}}/>;
}
function DeliveryGrid({projectId,userId,fields,technicians,tickets,drafts,refresh}:{projectId:string;userId:string;fields:Field[];technicians:Array<{id:string;full_name:string}>;tickets:Ticket[];drafts:ServerDraft[];refresh:()=>Promise<void>}){
 const grid=useDeliveryGrid(projectId,userId,fields,tickets,drafts,technicians);
 const [page,setPage]=useState(0),[review,setReview]=useState<string|null>(null);
 const table=useRef<HTMLTableElement>(null),tabStart=useRef<number|null>(null);
 const [notice,setNotice]=useState('');
 const visible=grid.rows.slice(page*25,(page+1)*25);
 function focus(row:number,col:number){
  if(row<0||col<0||col>=fields.length)return;
  if(row>=grid.rows.length)grid.add();
  const nextPage=Math.floor(row/25);if(nextPage!==page)setPage(nextPage);
  requestAnimationFrame(()=>table.current?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`)?.focus());
 }
 function move(row:number,col:number,key:string,shift:boolean){
  if(key==='Tab'){
   if(tabStart.current===null)tabStart.current=col;
   const index=row*fields.length+col+(shift?-1:1);
   if(index>=0)focus(Math.floor(index/fields.length),index%fields.length);
  }else if(key==='Enter'){
   const target=tabStart.current??col;tabStart.current=null;focus(row+(shift?-1:1),target);
  }else{
   tabStart.current=null;focus(row+(key==='ArrowUp'?-1:key==='ArrowDown'?1:0),col+(key==='ArrowLeft'?-1:key==='ArrowRight'?1:0));
  }
 }
 function add(){const index=grid.add();setPage(Math.floor(index/25));requestAnimationFrame(()=>table.current?.querySelector<HTMLElement>(`[data-cell="${index}:0"]`)?.focus());}
 const pending=grid.rows.filter(r=>r.pending.length).length;
 return <div className="space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-h4 font-semibold">Service Delivery</h2><p className="text-sm text-neutral-500">{grid.rows.length} rows · Dates/times: Bahrain · <span role="status">{pending?`${pending} rows saving or waiting to retry`:'All committed changes saved'}</span></p></div>
 <div className="flex flex-wrap gap-2"><ShortcutsGuide userId={userId}/><Button onClick={add}>Add row</Button><Button variant="outline" onClick={()=>{if(pending){grid.retry();setNotice('');}else void refresh();}}>Refresh</Button><Button variant="ghost" onClick={grid.exportDraft}>Export draft</Button></div></div>
 <p className="text-xs text-neutral-500">Type to replace a selected cell; F2 or double-click to edit. Enter or Tab commits and saves automatically. Exact typed text is retained. Only valid Resolved rows with a Team become technician Todo tasks.</p>
 {!technicians.length&&<p className="text-sm text-warning-700">No active Technicians are configured. An Admin must add one before a task can be assigned.</p>}
 {grid.error&&<p role="alert" className="text-danger-600">{grid.error}</p>}{notice&&<p role="status">{notice}</p>}
 {grid.hasRecovery&&<div className="text-sm">Uncommitted text from a previous visit is available. <Button variant="outline" onClick={grid.recover}>Restore uncommitted text</Button></div>}
 <Card padding="none" className="overflow-hidden"><div className="max-h-[65vh] overflow-auto"><table ref={table} className="border-collapse text-sm" aria-label="Service Delivery spreadsheet"><thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800"><tr><th className="sticky left-0 z-30 min-w-44 bg-neutral-100 p-2 dark:bg-neutral-800">Row</th>{fields.map(f=><th key={f.key} className="min-w-48 border border-neutral-200 p-2 text-left dark:border-neutral-700"><span className="text-xs text-neutral-400">{f.excelColumn} </span>{f.label}</th>)}</tr></thead><tbody>
 {visible.map((row,rowIndex)=>{const index=page*25+rowIndex;return <tr key={row.id}><td className={`sticky left-0 z-10 border border-l-4 bg-white p-2 dark:bg-neutral-900 ${row.state==='record'?'border-l-emerald-500':'border-l-amber-400'}`}><span>{index+1} · {row.state==='record'?'Saved':row.state==='saving'?'Saving…':row.state==='pending'?'Pending':'Draft'}</span>{(row.errors._row||row.errors._save)&&<div className="max-w-48 text-xs text-danger-600">{row.errors._row||row.errors._save}<button className="block underline" onClick={async()=>{try{if(await grid.loadReview(row.id))setReview(row.id);}catch(e){setNotice((e as Error).message);}}}>Review draft</button></div>}</td>
 {fields.map((f,colIndex)=>{const protectedCell=protectedGridFields.has(f.key);let value=row.values[f.key]??'';
 if(f.key==='controller_id')value=String(row.record?.controller_name||'You');
 if(f.key==='sla_from_creation')value=row.record?.sla_from_creation!=null?`${(Number(row.record.sla_from_creation)*24).toFixed(2)} h`:'';
 if(f.key==='kpi_status')value=String(row.record?.kpi_status||'');
 return <td key={f.key} className={`relative border border-neutral-200 dark:border-neutral-700 ${row.state==='draft'?'bg-warning-50/40 dark:bg-warning-950/10':''}`}>
 {protectedCell&&<Lock aria-hidden="true" className="absolute right-1 top-1 h-3 w-3 text-neutral-400"/>}{row.errors[f.key]&&<span title={row.errors[f.key]} className="absolute right-0 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-red-500"/>}
 <PlainTextCell value={value} label={`${f.label}, row ${index+1}`} cell={`${index}:${colIndex}`} readOnly={protectedCell} error={row.errors[f.key]} onCommit={value=>grid.commit(row.id,f.key,value)} onCache={value=>grid.cache(row.id,f.key,value)} onSelect={()=>{tabStart.current=null;}} onMove={(key,shift)=>move(index,colIndex,key,shift)}/>
 </td>;})}</tr>;})}
 {!grid.rows.length&&<tr><td colSpan={fields.length+1} className="p-8">No records yet. Add a row to begin.</td></tr>}
 </tbody></table></div></Card>
 <div className="flex gap-3"><Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page+1} of {Math.max(1,Math.ceil(grid.rows.length/25))}</span><Button variant="outline" disabled={(page+1)*25>=grid.rows.length} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
 {review&&<section className="rounded border p-4 text-sm"><h3 className="font-semibold">Review retained draft</h3><p>The official record is not overwritten when a draft is invalid or another user has changed it. Compare your typed draft with the latest official record below before applying it.</p><div className="grid gap-3 md:grid-cols-2"><div><h4>Your draft</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.rows.find(r=>r.id===review)?.values,null,2)}</pre></div><div><h4>Latest official record</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.reviewed.get(review)?.record||{},null,2)}</pre></div></div><div className="mt-3 flex gap-2"><Button onClick={()=>{grid.applyReviewed(review);setReview(null);}}>Apply reviewed draft</Button><Button variant="outline" onClick={()=>{grid.closeReview(review);setReview(null);}}>Close review</Button></div></section>}
 </div>;
}
