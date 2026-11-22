'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../assurance/api';
import { Modal } from '../../../components/Modal';

type RecordRow={id:string;category:string;data:Record<string,string|number|null>;version:number;source_sheet:string|null;source_row:number|null;source_year:string|null};
const ontFields=['serial_number','model','quantity','item_code','receiving_date','reservation_number','po_number'];
const cpeFields=['serial_number','order_number','installation_date','asset_description','quantity','stock_type','service','cost_center','exchange','block','road','house','flat','po_number','asset_class','contractor','connection_type','lo_name','labor_charge','cpe_charge','reference'];
const label=(key:string)=>key==='lo_name'?'LO':key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const control='w-full min-w-0 rounded-lg border border-neutral-300 bg-white p-3 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100';
export default function EquipmentDatabase({kind}:{kind:'ont'|'cpe'}) {
 const cache=useQueryClient();
 const [selectedCategory,setCategory]=useState('');const [year,setYear]=useState('');const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [page,setPage]=useState(1);
 const [editing,setEditing]=useState<Partial<RecordRow>|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 const fields=kind==='ont'?ontFields:cpeFields;
 useEffect(()=>{setCategory('');setYear('');setSearch('');setQuery('');setPage(1);setEditing(null)},[kind]);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1)},300);return()=>clearTimeout(timer)},[search]);
 const meta=useQuery({queryKey:['equipment',kind,'meta'],queryFn:()=>api<{categories:{category:string;count:number}[];years:string[]}>(`/equipment/${kind}/meta`)});
 const category=meta.data?.categories.some(c=>c.category===selectedCategory)?selectedCategory:(meta.data?.categories[0]?.category||'');
 const records=useQuery({enabled:!!category,queryKey:['equipment',kind,category,year,query,page],queryFn:()=>api<{rows:RecordRow[];total:number}>(`/equipment/${kind}?${new URLSearchParams({category,year,search:query,page:String(page)})}`)});
 async function save(e:React.FormEvent){e.preventDefault();if(!editing)return;setSaving(true);setError('');try{
  await api(`/equipment/${kind}${editing.id?'/'+editing.id:''}`,{method:editing.id?'PATCH':'POST',body:JSON.stringify(editing)});
  await cache.invalidateQueries({queryKey:['equipment',kind]});setEditing(null);
 }catch(e){setError(e instanceof Error?e.message:'Unable to save record')}finally{setSaving(false)}}
 const open=(row:Partial<RecordRow>)=>{setError('');setEditing({...row,data:{...row.data}})};
 const pagination=<div className="flex flex-wrap items-center gap-3"><button className="task-action" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil((records.data?.total||0)/50))}</span><button className="task-action" disabled={page*50>=(records.data?.total||0)} onClick={()=>setPage(p=>p+1)}>Next</button></div>;
 return <section className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{kind.toUpperCase()} DB</h1><p className="text-sm text-neutral-600 dark:text-neutral-300">{kind==='ont'?'Stock organized by model':'Project equipment and complete Delivery Assurance history'}</p></div><button className="task-action" onClick={()=>open({category:category||(kind==='cpe'?'Delivery Assurance':''),source_year:String(new Date().getFullYear()),data:kind==='ont'?{model:category,quantity:1}:{quantity:1}})}>Add record</button></div>
  <nav aria-label={kind==='ont'?'ONT models':'CPE projects'} className="flex max-w-full gap-2 overflow-x-auto pb-2">
   {(meta.data?.categories||[]).map(c=><button key={c.category} aria-pressed={category===c.category} onClick={()=>{setCategory(c.category);setPage(1)}} className={`shrink-0 rounded-lg border px-3 py-3 text-sm ${category===c.category?'border-primary-600 bg-primary-600 text-white':'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'}`}>{c.category} ({c.count.toLocaleString()})</button>)}
  </nav>
  <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="min-w-0">Search<input className={control} placeholder="Serial, order, PO or any field" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Source year<select className={control} value={year} onChange={e=>{setYear(e.target.value);setPage(1)}}><option value="">All years</option>{meta.data?.years.map(y=><option key={y}>{y}</option>)}</select></label></div>
  {(meta.error||records.error)&&<div role="alert" className="text-red-600 dark:text-red-300">{(meta.error||records.error)?.message}<button className="ml-3 underline" onClick={()=>{void meta.refetch();void records.refetch()}}>Retry</button></div>}
  {meta.isPending||(!!category&&records.isPending)?<LoadingState message="Loading records…"/>:<>
   <div className="max-w-full overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700"><table className="w-full text-left text-sm"><thead className="bg-neutral-100 dark:bg-neutral-800"><tr><th className="p-3">Action</th>{fields.map(f=><th className="whitespace-nowrap p-3" key={f}>{label(f)}</th>)}</tr></thead><tbody>{records.data?.rows.map(row=><tr key={row.id} className="border-t border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"><td className="sticky left-0 bg-white p-2 dark:bg-neutral-900"><button className="task-action" onClick={()=>open(row)}>Edit</button></td>{fields.map(f=><td className="max-w-xs whitespace-nowrap p-3" key={f}>{row.data[f]??'—'}</td>)}</tr>)}</tbody></table></div>
   {!records.error&&records.data?.total===0&&<p>No matching records.</p>}
   <div className="flex flex-wrap items-center justify-between gap-3">
    {pagination}
    <p className="ml-auto text-right text-sm">Showing {records.data?.total?(page-1)*50+1:0}–{Math.min(page*50,records.data?.total||0)} of {records.data?.total.toLocaleString()||0} records · 50 per page</p>
   </div>
  </>}
  <Modal isOpen={!!editing} onClose={()=>{if(!saving)setEditing(null)}} title={editing?.id?'Edit record':'Add record'} size="xl">
   <form onSubmit={save} className="space-y-4">
    {editing?.source_sheet&&<p className="text-sm">Imported from {editing.source_sheet}, row {editing.source_row}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
     {kind==='cpe'&&<label>Project<input required maxLength={200} className={control} list="equipment-categories" value={editing?.category||''} onChange={e=>setEditing(v=>({...v,category:e.target.value}))}/><datalist id="equipment-categories">{meta.data?.categories.map(c=><option key={c.category} value={c.category}/>)}</datalist></label>}
     <label>Source year<input className={control} inputMode="numeric" pattern="[0-9]{4}" value={editing?.source_year||''} onChange={e=>setEditing(v=>({...v,source_year:e.target.value}))}/></label>
     {fields.map(f=><label className="min-w-0" key={f}>{label(f)}<input className={control} required={f==='serial_number'||f==='model'} maxLength={1000} type={f.endsWith('_date')?'date':['quantity','labor_charge','cpe_charge'].includes(f)?'number':'text'} min={['quantity','labor_charge','cpe_charge'].includes(f)?0:undefined} step="any" value={editing?.data?.[f]??''} onChange={e=>setEditing(v=>({...v,category:kind==='ont'&&f==='model'?e.target.value:v?.category,data:{...v?.data,[f]:e.target.value}}))}/></label>)}
    </div>
    {error&&<p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
    <div className="form-actions"><button type="submit" className="task-action" disabled={saving}>{saving?'Saving…':'Save record'}</button><button type="button" className="task-action" disabled={saving} onClick={()=>setEditing(null)}>Cancel</button></div>
   </form>
  </Modal>
 </section>;
}
