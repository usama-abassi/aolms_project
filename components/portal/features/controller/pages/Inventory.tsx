'use client';
import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {Table,type Column} from '../../../components/Table';
import {randomId} from '../../../lib/uuid';
import {inventoryItemLabel,inventoryQuantityLabel,inventoryStep} from '@/lib/inventory-units';

type Project={id:string;name:string;code:string};
type Material={id:string;item_code:string;name:string;unit:string;opening:number;received:number;used:number;faulty:number;remaining:number};
type Entry={id:string;item_code:string;name:string;unit:string;kind:string;quantity:number;date:string;reference:string};
type RequestEntry={id:string;created_at:string;technician:string;project:string;item_code:string;name:string;unit:string;quantity:number;reference:string};
type InventoryData={rows:Material[];history:Entry[];requestHistory?:RequestEntry[]};
const field='block w-full rounded-lg border border-neutral-300 bg-white p-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100';
const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:4});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export default function Inventory(){
 const params=useSearchParams(),router=useRouter(),path=usePathname();
 const [historyOpen,setHistoryOpen]=useState(false);
 const projects=useQuery({queryKey:['controller-projects'],queryFn:()=>api<Project[]>('/projects')});
 const list=projects.data||[];
 const project=list.find(p=>p.id===params.get('project'))||list.find(p=>p.code==='SERVICE_ASSURANCE')||list[0];
 return <div className="space-y-5"><div><h1 className="text-h2 font-semibold">Inventory</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Monthly material stock by project</p></div>
 {projects.isPending&&<p>Loading projects…</p>}{projects.error&&<p role="alert">{projects.error.message}</p>}
 <div className="flex items-center gap-3 border-b pb-2 dark:border-neutral-700"><div role="tablist" aria-label="Inventory projects" className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{list.map(p=><button key={p.id} role="tab" aria-selected={p.id===project?.id} onClick={()=>{setHistoryOpen(false);router.push(path+'?'+new URLSearchParams({project:p.id}));}} className={`shrink-0 rounded-lg px-4 py-2 text-sm ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}</div><Button className="shrink-0" variant="outline" disabled={project?.code!=='SERVICE_ASSURANCE'} onClick={()=>setHistoryOpen(true)}>Request history</Button></div>
 {project?.code==='SERVICE_ASSURANCE'&&<DeliveryInventory key={project.id} project={project} historyOpen={historyOpen} onCloseHistory={()=>setHistoryOpen(false)}/>}
 {!projects.isPending&&!projects.error&&!project&&<p>No projects configured.</p>}
 </div>;
}
function DeliveryInventory({project,historyOpen,onCloseHistory}:{project:Project;historyOpen:boolean;onCloseHistory:()=>void}){
 const client=useQueryClient();
 const [month,setMonth]=useState(today().slice(0,7)),[search,setSearch]=useState('');
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const [mode,setMode]=useState<'entry'|'material'|'adjustment'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [form,setForm]=useState({material_id:'',kind:'received',date:today(),quantity:'',reference:'',name:'',unit:'',item_code:''});
 const mutation=useRef(''),saving=useRef(false);
 const query=useQuery({queryKey:['material-inventory',project.id,month],queryFn:()=>api<InventoryData>(`/material-inventory/${project.id}?month=${month}`),enabled:!!month,refetchInterval:30000});
 const rows=query.data?.rows||[],selected=rows.find(r=>r.id===form.material_id);
 const filtered=rows.filter(r=>`${r.item_code} ${r.name}`.toLowerCase().includes(search.toLowerCase()));
 const open=(next:'entry'|'material'|'adjustment',item?:Material)=>{
  setError('');setSuccess('');mutation.current=randomId();
  setForm({material_id:item?.id||rows[0]?.id||'',kind:'received',date:month===today().slice(0,7)?today():month+'-01',quantity:'',reference:'',name:'',unit:'',item_code:''});setMode(next);
 };
 const change=(key:string,value:string)=>{setForm(f=>({...f,[key]:value}));mutation.current=randomId();};
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   const body=mode==='material'?{kind:'material',name:form.name,unit:form.unit,item_code:form.item_code}:{kind:mode==='adjustment'?'adjustment':form.kind,direction:form.kind==='received'?'add':'deduct',material_id:form.material_id,date:form.date,quantity:Number(form.quantity),reference:form.reference,mutation_id:mutation.current};
   await api(`/material-inventory/${project.id}`,{method:'POST',body:JSON.stringify(body)});
   setMode(null);setSuccess(mode==='material'?'Material added. You can now record its stock.':'Stock entry saved.');
   if(mode!=='material')setMonth(form.date.slice(0,7));
   await client.invalidateQueries({queryKey:['material-inventory',project.id]});
  }catch(err){setError(err instanceof Error?err.message:'Unable to save inventory');}finally{setBusy(false);saving.current=false;}
 };
 async function downloadInventory(){
  if(exporting)return;setExporting(true);setExportError('');
  try{
   const [{exportInventory},data]=await Promise.all([import('@/lib/inventory-export'),api<InventoryData>(`/material-inventory/${project.id}?month=${month}`)]);
   const bytes=exportInventory(month,data.rows);
   const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const link=document.createElement('a');link.href=url;link.download=`Delivery Material Consumption Report ${month}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(err){setExportError(err instanceof Error?err.message:'Unable to export inventory');}finally{setExporting(false);}
 }
 const columns:Column[]=[{key:'name',label:'Material',render:(_v:unknown,row:Material)=>inventoryItemLabel(row)},{key:'unit',label:'Unit',render:v=>v||'Not specified'},...(['opening','received','used','faulty','remaining'] as const).map(key=>({key,label:{opening:'Opening stock',received:'Received',used:'Used',faulty:'Faulty',remaining:'Remaining'}[key],render:(v:number)=><span className={`tabular-nums ${key==='remaining'?'font-semibold':''}`}>{number(v)}</span>})),{key:'id',label:'',render:(_v:unknown,row:Material)=><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>open('entry',row)}>Add entry</Button><Button variant="outline" size="sm" onClick={()=>open('adjustment',row)}>Edit stock</Button></div>}];
 return <section aria-label={`${project.name} inventory`} className="space-y-4">
 <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Month<input type="month" required className={field} value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label><Button variant="outline" disabled={month===today().slice(0,7)} onClick={()=>setMonth(today().slice(0,7))}>Current month</Button><label className="min-w-48 flex-1 text-sm">Search materials<input className={field} placeholder="Material name or item code" value={search} onChange={e=>setSearch(e.target.value)}/></label><Button variant="outline" disabled={exporting||!month||query.isPending||!!query.error} onClick={downloadInventory}>{exporting?'Exporting…':'Export Excel'}</Button><Button variant="outline" onClick={()=>open('material')}>New material</Button><Button disabled={!rows.length||query.isPending||!!query.error} onClick={()=>open('entry')}>Add stock</Button></div>
 <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"><p className="font-medium">Opening stock + received − used − faulty = remaining</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Opening stock equals the remaining balance after the last entry of the previous month. It carries forward automatically, including months with no entries. Enter initial stock only when starting a material. Automatic usage from Service Delivery will be connected later.</p></div>
 {exportError&&<p role="alert" className="text-red-600">{exportError}</p>}
 {success&&<p role="status" className="text-emerald-700 dark:text-emerald-300">{success}</p>}
 {query.error?<div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>query.refetch()}>Retry</Button></div>:<><Table columns={columns} data={filtered} rowKey="id" isLoading={query.isPending} emptyMessage="No materials match your search."/><p className="text-sm text-neutral-500">{filtered.length} of {rows.length} materials · Quantities are shown in each material’s unit.</p></>}
 <details className="rounded-xl border p-4 dark:border-neutral-700"><summary className="cursor-pointer font-medium">Stock history for {month}</summary><p className="my-3 text-sm text-neutral-500">Latest 100 entries in this month</p><Table columns={[{key:'date',label:'Date'},{key:'name',label:'Material',render:(_v:unknown,row:Entry)=>inventoryItemLabel(row)},{key:'kind',label:'Entry'},{key:'quantity',label:'Quantity',render:number},{key:'unit',label:'Unit',render:v=>v||'Not specified'},{key:'reference',label:'Reference / note'}]} data={query.data?.history||[]} rowKey="id" emptyMessage="No stock entries for this month."/></details>
 <Modal isOpen={historyOpen} onClose={onCloseHistory} title={`Request history for ${month}`} size="xl"><p className="my-3 text-sm text-neutral-500">Latest 100 requested items · Times shown in Bahrain time · Updates every 30 seconds</p><Table columns={[{key:'created_at',label:'Requested at',render:v=>new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Bahrain'})},{key:'technician',label:'Technician'},{key:'project',label:'Project'},{key:'name',label:'Inventory item',render:(_v:unknown,row:RequestEntry)=>inventoryItemLabel(row)},{key:'quantity',label:'Quantity / length',render:number},{key:'unit',label:'Unit',render:v=>v||'Not specified'},{key:'reference',label:'Request',render:v=>String(v).replace('inventory-request:','')}]} data={query.data?.requestHistory||[]} rowKey="id" isLoading={query.isPending} emptyMessage="No inventory requests for this month."/>{query.error&&<p role="alert" className="mt-3 text-red-600">{query.error.message}</p>}</Modal>
 <Modal isOpen={mode!==null} onClose={()=>{if(!busy)setMode(null);}} title={mode==='material'?'New material':mode==='adjustment'?'Edit stock':'Add inventory entry'} size="xl">
 <form onSubmit={save} className="space-y-4">{mode==='adjustment'&&<p className="text-sm text-neutral-500">Enter the amount to add or deduct, not the new total. The correction and reason will be recorded in stock history.</p>}<fieldset disabled={busy} className="space-y-4">
 {mode==='material'?<><label className="block text-sm">Material name<input required maxLength={300} className={field} value={form.name} onChange={e=>change('name',e.target.value)}/></label><label className="block text-sm">Item code (optional)<input maxLength={100} className={field} value={form.item_code} onChange={e=>change('item_code',e.target.value)}/></label><label className="block text-sm">Unit<input required maxLength={40} placeholder="e.g. Meter, piece, box" className={field} value={form.unit} onChange={e=>change('unit',e.target.value)}/></label></>:<>
 <label className="block text-sm">Material<select required className={field} value={form.material_id} onChange={e=>change('material_id',e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{inventoryItemLabel(r)}</option>)}</select></label>
 <label className="block text-sm">{mode==='adjustment'?'Correction type':'Entry type'}<select className={field} value={form.kind} onChange={e=>change('kind',e.target.value)}>{mode==='adjustment'?<><option value="received">Add to stock</option><option value="used">Deduct from stock / used elsewhere</option></>:<><option value="received">Received stock</option><option value="opening">Opening stock (first entry only)</option><option value="faulty">Faulty material</option></>}</select></label>
 <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"><label className="text-sm">Date<input type="date" required className={field} value={form.date} onChange={e=>change('date',e.target.value)}/></label><label className="text-sm">{inventoryQuantityLabel(selected?.unit)}{mode==='adjustment'?' to add / deduct':''}<input type="number" min={inventoryStep(selected?.unit)} max="999999999999.9999" step={inventoryStep(selected?.unit)} required className={field} value={form.quantity} onChange={e=>change('quantity',e.target.value)}/></label></div>
 {!selected?.unit&&<p className="text-sm text-amber-700 dark:text-amber-300">The reference workbook does not specify a valid unit for this material.</p>}
 <label className="block text-sm">{mode==='adjustment'?'Reason for correction':'Reference / note (optional)'}<input required={mode==='adjustment'} maxLength={mode==='adjustment'?480:500} placeholder={mode==='adjustment'?'Wrong quantity, used elsewhere, or other reason':'Delivery note or receipt number'} className={field} value={form.reference} onChange={e=>change('reference',e.target.value)}/></label></>}
 </fieldset>{error&&<p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save'}</Button></div></form>
 </Modal></section>;
}
