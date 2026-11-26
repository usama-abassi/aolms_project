'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import {displayControllerDate,recordMonth,type SyncColumn} from '@/lib/services/google-sheets/sync-model';
import {useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Lock} from 'lucide-react';
import {api,type Field,type Ticket} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Card} from '../../../components/Card';
import {GridSaveStatus} from './GridSaveStatus';
import ShortcutsGuide from './ShortcutsGuide';
import PlainTextCell from './PlainTextCell';
import SpreadsheetInteraction from './SpreadsheetInteraction'
import {gridDestination,gridPage} from './spreadsheet-rows';
import {useSpreadsheetSizing} from './useSpreadsheetSizing';
import {useGridFocus} from './useGridFocus';
import {useDeliveryGrid,type ServerDraft} from './useDeliveryGrid';
import {protectedGridFields} from '@/lib/services/assurance-tickets/grid-values';

export default function AssuranceSpreadsheet({projectId,userId,serviceAssurance=false,month='',columns}:{projectId:string;userId:string;serviceAssurance?:boolean;month?:string;columns?:SyncColumn[]}){
 const base=serviceAssurance?'/service-assurance':'/assurance-tickets';
 const meta=useQuery({queryKey:serviceAssurance?[base,'metadata',userId]:['assurance-metadata',userId],queryFn:()=>api<{fields:Field[];technicians:Array<{id:string;full_name:string}>}>(`${base}/metadata`)});
 const records=useQuery({queryKey:serviceAssurance?[base,userId,projectId]:['assurance-tickets',userId,projectId],staleTime:15_000,queryFn:()=>api<Ticket[]>(`${base}?project_id=${projectId}`)});
 const drafts=useQuery({queryKey:serviceAssurance?[base,'grid-drafts',userId,projectId]:['delivery-grid-drafts',userId,projectId],queryFn:()=>api<ServerDraft[]>(`${base}/grid?project_id=${projectId}`)});
 const [refreshKey,setRefreshKey]=useState(0);
 if(meta.isPending||records.isPending||drafts.isPending)return <LoadingState message={'Loading '+(serviceAssurance?'Service Assurance':'Service Delivery')+"…"}/>;
 if(meta.error||records.error||drafts.error)return <p role="alert">{meta.error?.message||records.error?.message||drafts.error?.message}</p>;
 return <DeliveryGrid key={`${projectId}:${userId}:${refreshKey}`} projectId={projectId} userId={userId} serviceAssurance={serviceAssurance} month={month} fields={columns?.length?columns.filter(c=>c.active).map(c=>({...meta.data!.fields.find(f=>f.key===c.key),key:c.key,label:c.label,excelColumn:String(c.index+1),storage:c.key,type:meta.data!.fields.find(f=>f.key===c.key)?.type||'text'})):meta.data!.fields} technicians={meta.data!.technicians} tickets={records.data!.filter(t=>!month||recordMonth(String(t.date||''))===month)} drafts={drafts.data!} refresh={async()=>{await Promise.all([records.refetch(),drafts.refetch()]);setRefreshKey(v=>v+1);}}/>;
}
function DeliveryGrid({projectId,userId,serviceAssurance,month,fields,technicians,tickets,drafts,refresh}:{projectId:string;userId:string;serviceAssurance:boolean;month:string;fields:Field[];technicians:Array<{id:string;full_name:string}>;tickets:Ticket[];drafts:ServerDraft[];refresh:()=>Promise<void>}){
 const sizing=useSpreadsheetSizing(fields.map(f=>f.key),96);
 const grid=useDeliveryGrid(projectId,userId,fields,tickets,drafts,technicians,serviceAssurance?{manual:true,month,recordsPath:'/service-assurance',gridPath:'/service-assurance/grid'}:{month});
 const title=serviceAssurance?'Service Assurance':'Service Delivery';
 const [page,setPage]=useState(0),[review,setReview]=useState<string|null>(null);
 const table=useRef<HTMLTableElement>(null),tabStart=useRef<number|null>(null);
 const focusCell=useGridFocus(table);
 const [notice,setNotice]=useState('');
 const [missingOnly,setMissingOnly]=useState(false);
 const missing=(value:string)=>!!value.trim()&&!technicians.some(t=>t.id===value);
 const missingRows=serviceAssurance?grid.rows.filter(r=>missing(r.values.team??'')):[];
 const missingCount=missingRows.length,displayRows=missingOnly?missingRows:grid.rows;
 const displayCount=missingOnly?missingCount:grid.recordCount;
 const pages=Math.max(1,Math.ceil(displayCount/25)),current=Math.min(page,pages-1);
 const visible=displayRows.slice(current*25,current===pages-1?undefined:(current+1)*25);
 function focus(row:number,col:number){
  if(row<0||col<0||col>=fields.length)return;
  if(row>=displayRows.length)return;
  const nextPage=gridPage(row,displayCount);if(nextPage!==current)setPage(nextPage);
  focusCell(row,col);
 }
 function move(row:number,col:number,key:string,shift:boolean,id:string){
  const latest=displayRows.findIndex(r=>r.id===id);if(latest>=0)row=latest;
  if(key==='Tab'){
   if(tabStart.current===null)tabStart.current=col;
   const index=row*fields.length+col+(shift?-1:1);
   if(index>=0)focus(Math.floor(index/fields.length),index%fields.length);
  }else if(key==='Enter'){
   const target=tabStart.current??col;tabStart.current=null;focus(row+(shift?-1:1),target);
  }else{
   tabStart.current=null;const target=gridDestination(row,col,key,shift,fields.length);if(target)focus(target.row,target.col);
  }
 }
 function add(){
  const index=grid.add(),nextPage=gridPage(index,grid.recordCount);setPage(nextPage);
  const existing=nextPage===current?table.current?.querySelector<HTMLElement>(`[data-cell="${index}:0"]`):null;
  if(existing)existing.focus();else focusCell(index,0);
 }
 const pending=grid.rows.filter(r=>r.pending.length).length;
 return <div className="space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-h4 font-semibold">{title}</h2><p className="text-sm text-neutral-500">{grid.recordCount} rows · Dates/times: Bahrain · <GridSaveStatus pending={pending} failed={grid.rows.some(r=>!!r.errors._save)} saving={grid.rows.some(r=>r.state==='saving')}/></p></div>
 <div className="flex flex-wrap gap-2">{!serviceAssurance&&<ShortcutsGuide userId={userId}/>} <Button disabled={missingOnly} onClick={add}>Add row</Button>{serviceAssurance&&<Button variant="outline" aria-pressed={missingOnly} onClick={()=>{setMissingOnly(v=>!v);setPage(0);}}>Technicians not found: {missingCount} {missingOnly&&"· Show all"}</Button>}<Button variant="outline" onClick={()=>{if(pending){grid.retry();setNotice('Pending changes are being saved before refreshing.');}else void refresh();}}>Refresh</Button><Button variant="ghost" onClick={grid.exportDraft}>Export draft</Button></div></div>
 <p className="text-xs text-neutral-500">{serviceAssurance?'Type to replace a cell; arrows, Enter or Tab commit locally and move. F2 or double-click edits within the text. New rows appear automatically; Changes save automatically after approximately two seconds of inactivity. Only Resolved rows with a verified replacement resolution need a technician response. Choose Team to assign the response. Assigned-date filters accept YYYY-MM-DD or DD/MM/YYYY with optional HH:mm (Bahrain).':'Type to replace a selected cell; arrows, Enter or Tab commit and save automatically. F2 or double-click edits within the text. New rows appear automatically. Exact typed text is retained. Only valid Resolved rows with a Team become technician Todo tasks.'}</p>
 {!technicians.length&&<p className="text-sm text-warning-700">No active Technicians are configured. An Admin must add one before a task can be assigned.</p>}
 {grid.error&&<p role="alert" className="text-danger-600">{grid.error}</p>}{notice&&<p role="status">{notice}</p>}
 {grid.hasRecovery&&<div className="text-sm">Uncommitted text from a previous visit is available. <Button variant="outline" onClick={grid.recover}>Restore uncommitted text</Button></div>}
 <SpreadsheetInteraction rows={displayRows} fields={fields.map(f=>({...f,readOnly:!serviceAssurance&&protectedGridFields.has(f.key)}))} technicians={technicians} apply={grid.commitMany} focus={focus}><Card padding="none" className="overflow-hidden"><div data-grid-scroll className="max-h-[65vh] overflow-auto"><table ref={table} style={{width:sizing.width}} className="project-spreadsheet table-fixed border-collapse text-sm" aria-label={`${title} spreadsheet`}>{sizing.columns}<thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800"><tr><th className="sticky left-0 z-30 min-w-44 bg-neutral-100 p-2 dark:bg-neutral-800">Row</th>{fields.map(f=><th key={f.key} className="relative break-words border border-neutral-200 py-2 pl-2 pr-4 text-left dark:border-neutral-700"><span className="text-xs text-neutral-400">{f.excelColumn} </span>{f.label}{sizing.columnHandle(f.key,f.label)}</th>)}</tr></thead><tbody>
 {visible.map((row,rowIndex)=>{const index=current*25+rowIndex;return <tr key={row.id} style={{height:sizing.rowHeight(row.id)}}><td className={`sticky left-0 z-10 border border-l-4 bg-white p-2 dark:bg-neutral-900 ${row.state==='record'?'border-l-emerald-500':'border-l-amber-400'}`}><span>{index+1}{row.state!=='record'&&' · '}{!row.record&&row.base_version===null&&!Object.values(row.values).some(v=>v.trim())?'New row':row.state==='record'?'':row.state==='saving'?'Saving…':row.state==='pending'?'Pending':'Draft'}</span>{(row.errors._row||row.errors._save)&&<div className="max-w-48 text-xs text-danger-600">{row.errors._row||row.errors._save}<button className="block underline" onClick={async()=>{try{if(await grid.loadReview(row.id))setReview(row.id);}catch(e){setNotice((e as Error).message);}}}>Review draft</button></div>}{sizing.rowHandle(row.id,index)}</td>
 {fields.map((f,colIndex)=>{const protectedCell=!serviceAssurance&&protectedGridFields.has(f.key);let value=row.values[f.key]??'';
 if(!serviceAssurance&&f.key==='controller_id')value=String(row.record?.controller_name||'You');
 if(!serviceAssurance&&f.key==='sla_from_creation')value=row.record?.sla_from_creation!=null?`${(Number(row.record.sla_from_creation)*24).toFixed(2)} h`:'';
 if(!serviceAssurance&&f.key==='kpi_status')value=String(row.record?.kpi_status||'');
 return <td key={f.key} className={`relative border border-neutral-200 dark:border-neutral-700 ${row.state==='draft'?'bg-warning-50/40 dark:bg-warning-950/10':''}`}>
 {protectedCell&&<Lock aria-hidden="true" className="absolute right-1 top-1 h-3 w-3 text-neutral-400"/>}{row.errors[f.key]&&<span title={row.errors[f.key]} className="absolute right-0 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-red-500"/>}
 {serviceAssurance&&f.key==='team'?<select aria-label={`Team, row ${index+1}`} data-cell={`${index}:${colIndex}`} value={value} className={`block min-w-48 border-0 p-2 text-sm focus:ring-2 focus:ring-primary-500 ${missing(value)?'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200':'bg-transparent'}`} title={missing(value)?'Technician not found':undefined} onPointerDown={()=>{tabStart.current=null;}} onChange={e=>grid.commit(row.id,f.key,e.target.value)} onKeyDown={e=>{if(e.currentTarget.dataset.gridEditing!=='true'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&['Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(index,colIndex,e.key,e.shiftKey,row.id);}}}><option value="">Select Team</option>{value&&!technicians.some(t=>t.id===value)&&<option value={value}>{value} (not found)</option>}{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>:<PlainTextCell value={value} displayValue={serviceAssurance&&f.key==='date'?displayControllerDate(value):undefined} label={`${f.label}, row ${index+1}`} cell={`${index}:${colIndex}`} readOnly={protectedCell} error={row.errors[f.key]} onCommit={value=>grid.commit(row.id,f.key,value)} onCache={value=>grid.cache(row.id,f.key,value)} onSelect={()=>{tabStart.current=null;}} onMove={(key,shift)=>move(index,colIndex,key,shift,row.id)}/>}
 </td>;})}</tr>;})}
 {!displayRows.length&&<tr><td colSpan={fields.length+1} className="p-8">{missingOnly?'No rows with unmatched technicians.':'No records yet. Add a row to begin.'}</td></tr>}
 </tbody></table></div></Card></SpreadsheetInteraction>
 <div className="flex gap-3"><Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {pages}</span><Button variant="outline" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next</Button></div>
 {review&&<section className="rounded-lg border p-4 text-sm"><h3 className="font-semibold">Review retained draft</h3><p>The official record is not overwritten when a draft is invalid or another user has changed it. Compare your typed draft with the latest official record below before applying it.</p><div className="grid gap-3 md:grid-cols-2"><div><h4>Your draft</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.rows.find(r=>r.id===review)?.values,null,2)}</pre></div><div><h4>Latest official record</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.reviewed.get(review)?.record||{},null,2)}</pre></div></div><div className="mt-3 flex gap-2"><Button onClick={()=>{grid.applyReviewed(review);setReview(null);}}>Apply reviewed draft</Button><Button variant="outline" onClick={()=>{grid.closeReview(review);setReview(null);}}>Close review</Button></div></section>}
 </div>;
}
