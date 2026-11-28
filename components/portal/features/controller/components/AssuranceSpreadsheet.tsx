'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import {displayControllerDate,recordMonth,type SyncColumn} from '@/lib/services/google-sheets/sync-model';
import {useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Lock} from 'lucide-react';
import {api,type Field,type Ticket} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {GridSaveStatus} from './GridSaveStatus';
import ShortcutsGuide from './ShortcutsGuide';
import PlainTextCell from './PlainTextCell';
import SpreadsheetInteraction from './SpreadsheetInteraction'
import {gridDestination,gridPage,hasCellData} from './spreadsheet-rows';
import type {CSSProperties} from 'react';
import {spreadsheetColumnLabel,useSpreadsheetSizing} from './useSpreadsheetSizing';
import {useGridFocus} from './useGridFocus';
import {useDeliveryGrid,type ServerDraft} from './useDeliveryGrid';
import {gridDate,protectedGridFields} from '@/lib/services/assurance-tickets/grid-values';

export default function AssuranceSpreadsheet({projectId,userId,serviceAssurance=false,month='',columns}:{projectId:string;userId:string;serviceAssurance?:boolean;month?:string;columns?:SyncColumn[]}){
 const base=serviceAssurance?'/service-assurance':'/assurance-tickets';
 const meta=useQuery({queryKey:serviceAssurance?[base,'metadata',userId]:['assurance-metadata',userId],queryFn:()=>api<{fields:Field[];technicians:Array<{id:string;full_name:string}>}>(`${base}/metadata`)});
 const records=useQuery({queryKey:serviceAssurance?[base,userId,projectId]:['assurance-tickets',userId,projectId],staleTime:15_000,queryFn:()=>api<Ticket[]>(`${base}?project_id=${projectId}`)});
 const drafts=useQuery({queryKey:serviceAssurance?[base,'grid-drafts',userId,projectId]:['delivery-grid-drafts',userId,projectId],queryFn:()=>api<ServerDraft[]>(`${base}/grid?project_id=${projectId}`)});
 const [refreshKey,setRefreshKey]=useState(0);
 if(meta.isPending||records.isPending||drafts.isPending)return <LoadingState message={'Loading '+(serviceAssurance?'Service Assurance':'Service Delivery')+"…"}/>;
 if(meta.error||records.error||drafts.error)return <p role="alert">{meta.error?.message||records.error?.message||drafts.error?.message}</p>;
 return <DeliveryGrid key={`${projectId}:${userId}:${refreshKey}`} projectId={projectId} userId={userId} serviceAssurance={serviceAssurance} month={month} fields={columns?.length?columns.filter(c=>c.active).map(c=>({...meta.data!.fields.find(f=>f.key===c.key),key:c.key,label:c.label,excelColumn:spreadsheetColumnLabel(c.index),storage:c.key,type:meta.data!.fields.find(f=>f.key===c.key)?.type||'text'})):meta.data!.fields} technicians={meta.data!.technicians} tickets={records.data!.filter(t=>!month||recordMonth(String(t.date||''))===month)} drafts={drafts.data!} refresh={async()=>{await Promise.all([records.refetch(),drafts.refetch()]);setRefreshKey(v=>v+1);}}/>;
}
function DeliveryGrid({projectId,userId,serviceAssurance,month,fields,technicians,tickets,drafts,refresh}:{projectId:string;userId:string;serviceAssurance:boolean;month:string;fields:Field[];technicians:Array<{id:string;full_name:string}>;tickets:Ticket[];drafts:ServerDraft[];refresh:()=>Promise<void>}){
 const sizing=useSpreadsheetSizing(fields.map(f=>f.key));
 const grid=useDeliveryGrid(projectId,userId,fields,tickets,drafts,technicians,serviceAssurance?{manual:true,month,recordsPath:'/service-assurance',gridPath:'/service-assurance/grid'}:{month});
 const title=serviceAssurance?'Service Assurance':'Service Delivery';
 const [page,setPage]=useState(0),[review,setReview]=useState<string|null>(null);
 const table=useRef<HTMLTableElement>(null),tabStart=useRef<number|null>(null);
 const focusCell=useGridFocus(table);
 const [notice,setNotice]=useState('');
 const [missingOnly,setMissingOnly]=useState(false);
 const missing=(value:string)=>!!value.trim()&&!technicians.some(t=>t.id===value);
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[team,setTeam]=useState('');
 const [sort,setSort]=useState({key:'date',ascending:false});
 const hasData=(row:(typeof grid.rows)[number])=>!!row.record||row.base_version!==null||row.draft_version>0||row.pending.length>0||hasCellData(row.values);
 const records=grid.rows.filter(hasData),missingCount=serviceAssurance?records.filter(r=>missing(r.values.team??'')).length:0;
 const statuses=[...new Set(records.map(r=>r.values.status).filter(Boolean))].sort();
 const sortValue=(value:string)=>sort.key==='date'?gridDate(value,false)??value:value;
 const matches=records.filter(r=>missingOnly?missing(r.values.team??''):
  (!status||r.values.status===status)&&(!team||r.values.team===team)&&
  (!search.trim()||Object.values(r.values).some(value=>value.toLowerCase().includes(search.trim().toLowerCase()))));
 const ordered=[...matches].sort((a,b)=>(sort.ascending?1:-1)*sortValue(a.values[sort.key]??'').localeCompare(sortValue(b.values[sort.key]??''),undefined,{numeric:true}));
 const displayRows=[...ordered,...(missingOnly?[]:grid.rows.filter(r=>!hasData(r)))];
 const displayCount=ordered.length;
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
  grid.add();
  const index=displayCount,nextPage=gridPage(index,displayCount);setPage(nextPage);
  const existing=nextPage===current?table.current?.querySelector<HTMLElement>(`[data-cell="${index}:0"]`):null;
  if(existing)existing.focus();else focusCell(index,0);
 }
 const pending=grid.rows.filter(r=>r.pending.length).length;
 const failed=grid.rows.some(r=>!!r.errors._save);
 const filterClass='h-10 max-w-full rounded-lg border-neutral-300 bg-transparent text-sm dark:border-neutral-600';
 return <section aria-label={title} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 sm:p-4">
 <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h2 className="text-h4 font-semibold">{title}</h2><GridSaveStatus pending={pending} failed={failed} saving={grid.rows.some(r=>r.state==='saving')}/></div>
 <p className="text-sm text-neutral-600 dark:text-neutral-400">Eligible resolved tickets appear in technician work. Changes save automatically.</p>
 <div className="flex flex-wrap items-center gap-2">
  <Button disabled={missingOnly} onClick={add}>Add row</Button>
  {serviceAssurance&&<Button variant="outline" aria-pressed={missingOnly} onClick={()=>{setMissingOnly(v=>!v);setPage(0);}}>Technicians not found: {missingCount} {missingOnly&&"· Show all"}</Button>}
  {failed&&<Button variant="outline" onClick={grid.retry}>Retry save</Button>}
  <Button variant="outline" onClick={()=>{if(pending){grid.retry();setNotice('Pending changes are being saved before refreshing.');}else void refresh();}}>Refresh</Button>
  <Button variant="ghost" onClick={grid.exportDraft}>Export draft</Button>
  {!serviceAssurance&&<ShortcutsGuide userId={userId}/>}
  <details className="text-sm text-neutral-600 dark:text-neutral-300"><summary className="cursor-pointer rounded-lg px-2 py-2 focus-visible:ring-2 focus-visible:ring-primary-500">Editing tips</summary><p className="max-w-md px-2 py-1">Type to replace a cell. Press F2 or double-click to edit. Use Enter, Tab or the arrow keys to save the cell and move. Drag column or row edges to resize.</p></details>
 </div>
 <div className="flex flex-wrap gap-2">
  <input aria-label="Search tickets" placeholder="Search tickets" className="h-10 w-full rounded-lg border-neutral-300 bg-transparent px-3 text-sm dark:border-neutral-600 sm:w-56" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
  <select aria-label="Status filter" className={filterClass} value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
  <select aria-label="Team filter" className={filterClass} value={team} onChange={e=>{setTeam(e.target.value);setPage(0);}}><option value="">All Teams</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
 </div>
 {!technicians.length&&<p className="text-sm text-warning-700">No active Technicians are configured. An Admin must add one before a task can be assigned.</p>}
 {grid.error&&<p role="alert" className="text-danger-600">{grid.error}</p>}{notice&&<p role="status">{notice}</p>}
 {grid.hasRecovery&&<div className="text-sm">Uncommitted text from a previous visit is available. <Button variant="outline" onClick={grid.recover}>Restore uncommitted text</Button></div>}
 <SpreadsheetInteraction rows={displayRows} fields={fields.map(f=>({...f,readOnly:!serviceAssurance&&protectedGridFields.has(f.key)}))} technicians={technicians} apply={grid.commitMany} focus={focus}><div className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"><p className="border-b px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300 md:hidden">Swipe to see more columns. Tap a cell to edit.</p><div data-grid-scroll className="max-h-[65vh] overflow-auto overscroll-x-contain" role="region" aria-label="Scrollable project grid" tabIndex={0}><table ref={table} style={{width:sizing.width}} className="project-spreadsheet table-fixed border-collapse text-sm" aria-label={`${title} spreadsheet`}>{sizing.columns}<thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800"><tr><th scope="col" className="whitespace-nowrap px-3 py-2 text-right">Row</th>{fields.map(f=><th scope="col" aria-sort={sort.key===f.key?(sort.ascending?'ascending':'descending'):undefined} key={f.key} className="relative break-words border border-neutral-200 py-1 pl-2 pr-4 text-left dark:border-neutral-700"><button type="button" className="block max-w-full truncate text-left" title={f.label} onClick={()=>{setSort({key:f.key,ascending:sort.key===f.key?!sort.ascending:true});setPage(0);}}>{f.excelColumn} · {f.label}{sort.key===f.key?(sort.ascending?' ↑':' ↓'):''}</button>{sizing.columnHandle(f.key,f.label)}</th>)}</tr></thead><tbody>
 {visible.map((row,rowIndex)=>{const index=current*25+rowIndex;return <tr key={row.id} style={{height:sizing.rowHeight(row.id),'--project-editor-height':sizing.editorHeight(row.id)?sizing.editorHeight(row.id)+'px':undefined} as CSSProperties}><td className="relative border border-neutral-200 px-3 py-2 text-right text-xs tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{!hasData(row)?'New':row.state==='record'?index+1:<span className="font-medium text-warning-700 dark:text-warning-300" aria-label={`Row ${index+1}, ${row.state}`}>{index+1} ·</span>}{(row.errors._row||row.errors._save)&&<div className="max-w-48 text-xs text-danger-600">{row.errors._row||row.errors._save}<button className="block underline" onClick={async()=>{try{if(await grid.loadReview(row.id))setReview(row.id);}catch(e){setNotice((e as Error).message);}}}>Review draft</button></div>}{sizing.rowHandle(row.id,index)}</td>
 {fields.map((f,colIndex)=>{const protectedCell=!serviceAssurance&&protectedGridFields.has(f.key);let value=row.values[f.key]??'';
 if(!serviceAssurance&&f.key==='controller_id')value=String(row.record?.controller_name||'You');
 if(!serviceAssurance&&f.key==='sla_from_creation')value=row.record?.sla_from_creation!=null?`${(Number(row.record.sla_from_creation)*24).toFixed(2)} h`:'';
 if(!serviceAssurance&&f.key==='kpi_status')value=String(row.record?.kpi_status||'');
 return <td key={f.key} className={`relative border border-neutral-200 dark:border-neutral-700 ${row.state==='draft'?'bg-warning-50/40 dark:bg-warning-950/10':''}`}>
 {protectedCell&&<Lock aria-hidden="true" className="absolute right-1 top-1 h-3 w-3 text-neutral-400"/>}{row.errors[f.key]&&<span title={row.errors[f.key]} className="absolute right-0 top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-red-500"/>}
 {serviceAssurance&&f.key==='team'?<select aria-label={`Team, row ${index+1}`} data-cell={`${index}:${colIndex}`} value={value} className={`block min-w-48 border-0 p-2 text-sm focus:ring-2 focus:ring-primary-500 ${missing(value)?'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200':'bg-transparent'}`} title={missing(value)?'Technician not found':undefined} onPointerDown={()=>{tabStart.current=null;}} onChange={e=>grid.commit(row.id,f.key,e.target.value)} onKeyDown={e=>{if(e.currentTarget.dataset.gridEditing!=='true'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&['Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(index,colIndex,e.key,e.shiftKey,row.id);}}}><option value="">Select Team</option>{value&&!technicians.some(t=>t.id===value)&&<option value={value}>{value} (not found)</option>}{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>:<PlainTextCell value={value} displayValue={serviceAssurance&&f.key==='date'?displayControllerDate(value):undefined} label={`${f.label}, row ${index+1}`} cell={`${index}:${colIndex}`} readOnly={protectedCell} error={row.errors[f.key]} onCommit={value=>grid.commit(row.id,f.key,value)} onCache={value=>grid.cache(row.id,f.key,value)} onSelect={()=>{tabStart.current=null;}} onMove={(key,shift)=>move(index,colIndex,key,shift,row.id)}/>}
 </td>;})}</tr>;})}
 {!displayRows.length&&<tr><td colSpan={fields.length+1} className="p-8">{missingOnly?'No rows with unmatched technicians.':'No records yet. Add a row to begin.'}</td></tr>}
 </tbody></table></div></div></SpreadsheetInteraction>
 <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>Previous</Button><span>{displayCount} tickets · Page {current+1} of {pages}</span><Button variant="outline" disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Next</Button></div>
 {review&&<Modal isOpen onClose={()=>{grid.closeReview(review);setReview(null);}} title="Review retained draft" size="lg"><p>The official record is not overwritten when a draft is invalid or another user has changed it. Compare your typed draft with the latest official record below before applying it.</p><div className="grid gap-3 md:grid-cols-2"><div><h4>Your draft</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.rows.find(r=>r.id===review)?.values,null,2)}</pre></div><div><h4>Latest official record</h4><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(grid.reviewed.get(review)?.record||{},null,2)}</pre></div></div><div className="mt-3 flex gap-2"><Button onClick={()=>{grid.applyReviewed(review);setReview(null);}}>Apply reviewed draft</Button><Button variant="outline" onClick={()=>{grid.closeReview(review);setReview(null);}}>Close review</Button></div></Modal>}
 </section>;
}
