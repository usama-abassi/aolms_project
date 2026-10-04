'use client';
import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {Table,type Column} from '../../../components/Table';
import {randomId} from '../../../lib/uuid';

type Project={id:string;name:string;code:string};
type Material={id:string;item_code:string;name:string;unit:string;opening:number;received:number;used:number;faulty:number;remaining:number};
type Entry={id:string;name:string;unit:string;kind:string;quantity:number;date:string;reference:string};
type InventoryData={rows:Material[];history:Entry[]};
const field='block w-full rounded-lg border border-neutral-300 bg-white p-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100';
const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:4});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export default function Inventory(){
 const params=useSearchParams(),router=useRouter(),path=usePathname();
 const projects=useQuery({queryKey:['controller-projects'],queryFn:()=>api<Project[]>('/projects')});
 const list=projects.data||[];
 const project=list.find(p=>p.id===params.get('project'))||list.find(p=>p.code==='SERVICE_ASSURANCE')||list[0];
 return <div className="space-y-5"><div><h1 className="text-h2 font-semibold">Inventory</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Monthly material stock by project</p></div>
 {projects.isPending&&<p>Loading projects…</p>}{projects.error&&<p role="alert">{projects.error.message}</p>}
 <div role="tablist" aria-label="Inventory projects" className="flex gap-2 overflow-x-auto border-b pb-2 dark:border-neutral-700">{list.map(p=><button key={p.id} role="tab" aria-selected={p.id===project?.id} onClick={()=>router.push(path+'?'+new URLSearchParams({project:p.id}))} className={`shrink-0 rounded-lg px-4 py-2 text-sm ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}</div>
 {project?.code==='SERVICE_ASSURANCE'&&<DeliveryInventory key={project.id} project={project}/>}
 {!projects.isPending&&!projects.error&&!project&&<p>No projects configured.</p>}
 </div>;
}
function DeliveryInventory({project}:{project:Project}){
 const client=useQueryClient();
 const [month,setMonth]=useState(today().slice(0,7)),[search,setSearch]=useState('');
 const [mode,setMode]=useState<'entry'|'material'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [form,setForm]=useState({material_id:'',kind:'received',date:today(),quantity:'',reference:'',name:'',unit:'',item_code:''});
 const mutation=useRef(''),saving=useRef(false);
 const query=useQuery({queryKey:['material-inventory',project.id,month],queryFn:()=>api<InventoryData>(`/material-inventory/${project.id}?month=${month}`),enabled:!!month});
 const rows=query.data?.rows||[],selected=rows.find(r=>r.id===form.material_id);
 const filtered=rows.filter(r=>`${r.item_code} ${r.name}`.toLowerCase().includes(search.toLowerCase()));
 const open=(next:'entry'|'material',item?:Material)=>{
  setError('');setSuccess('');mutation.current=randomId();
  setForm({material_id:item?.id||rows[0]?.id||'',kind:'received',date:month===today().slice(0,7)?today():month+'-01',quantity:'',reference:'',name:'',unit:'',item_code:''});setMode(next);
 };
 const change=(key:string,value:string)=>{setForm(f=>({...f,[key]:value}));mutation.current=randomId();};
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   const body=mode==='material'?{kind:'material',name:form.name,unit:form.unit,item_code:form.item_code}:{kind:form.kind,material_id:form.material_id,date:form.date,quantity:Number(form.quantity),reference:form.reference,mutation_id:mutation.current};
   await api(`/material-inventory/${project.id}`,{method:'POST',body:JSON.stringify(body)});
   setMode(null);setSuccess(mode==='material'?'Material added. You can now record its stock.':'Stock entry saved.');
   if(mode==='entry')setMonth(form.date.slice(0,7));
   await client.invalidateQueries({queryKey:['material-inventory',project.id]});
  }catch(err){setError(err instanceof Error?err.message:'Unable to save inventory');}finally{setBusy(false);saving.current=false;}
 };
 const columns:Column[]=[{key:'item_code',label:'Item code',render:v=>v||'—'},{key:'name',label:'Material'},{key:'unit',label:'Unit',render:v=>v||'Not specified'},...(['opening','received','used','faulty','remaining'] as const).map(key=>({key,label:{opening:'Opening stock',received:'Received',used:'Used',faulty:'Faulty',remaining:'Remaining'}[key],render:(v:number)=><span className={`tabular-nums ${key==='remaining'?'font-semibold':''}`}>{number(v)}</span>})),{key:'id',label:'',render:(_v:unknown,row:Material)=><Button variant="outline" size="sm" onClick={()=>open('entry',row)}>Add entry</Button>}];
 return <section aria-label={`${project.name} inventory`} className="space-y-4">
 <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Month<input type="month" required className={field} value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label><Button variant="outline" disabled={month===today().slice(0,7)} onClick={()=>setMonth(today().slice(0,7))}>Current month</Button><label className="min-w-48 flex-1 text-sm">Search materials<input className={field} placeholder="Material name or item code" value={search} onChange={e=>setSearch(e.target.value)}/></label><Button variant="outline" onClick={()=>open('material')}>New material</Button><Button disabled={!rows.length||query.isPending||!!query.error} onClick={()=>open('entry')}>Add stock</Button></div>
 <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"><p className="font-medium">Opening stock + received − used − faulty = remaining</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Opening stock equals the remaining balance after the last entry of the previous month. It carries forward automatically, including months with no entries. Enter initial stock only when starting a material. Automatic usage from Service Delivery will be connected later.</p></div>
 {success&&<p role="status" className="text-emerald-700 dark:text-emerald-300">{success}</p>}
 {query.error?<div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>query.refetch()}>Retry</Button></div>:<><Table columns={columns} data={filtered} rowKey="id" isLoading={query.isPending} emptyMessage="No materials match your search."/><p className="text-sm text-neutral-500">{filtered.length} of {rows.length} materials · Quantities are shown in each material’s unit.</p></>}
 <details className="rounded-xl border p-4 dark:border-neutral-700"><summary className="cursor-pointer font-medium">Stock history for {month}</summary><p className="my-3 text-sm text-neutral-500">Latest 100 entries in this month</p><Table columns={[{key:'date',label:'Date'},{key:'name',label:'Material'},{key:'kind',label:'Entry'},{key:'quantity',label:'Quantity',render:number},{key:'unit',label:'Unit',render:v=>v||'Not specified'},{key:'reference',label:'Reference / note'}]} data={query.data?.history||[]} rowKey="id" emptyMessage="No stock entries for this month."/></details>
 <Modal isOpen={mode!==null} onClose={()=>{if(!busy)setMode(null);}} title={mode==='material'?'New material':'Add inventory entry'} size="md">
 <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
 {mode==='material'?<><label className="block text-sm">Material name<input required maxLength={300} className={field} value={form.name} onChange={e=>change('name',e.target.value)}/></label><label className="block text-sm">Item code (optional)<input maxLength={100} className={field} value={form.item_code} onChange={e=>change('item_code',e.target.value)}/></label><label className="block text-sm">Unit<input required maxLength={40} placeholder="e.g. Meter, piece, box" className={field} value={form.unit} onChange={e=>change('unit',e.target.value)}/></label></>:<>
 <label className="block text-sm">Material<select required className={field} value={form.material_id} onChange={e=>change('material_id',e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.item_code?`${r.item_code} · `:''}{r.name}</option>)}</select></label>
 <label className="block text-sm">Entry type<select className={field} value={form.kind} onChange={e=>change('kind',e.target.value)}><option value="received">Received stock</option><option value="opening">Opening stock (first entry only)</option><option value="faulty">Faulty material</option></select></label>
 <div className="grid grid-cols-2 gap-3"><label className="text-sm">Date<input type="date" required className={field} value={form.date} onChange={e=>change('date',e.target.value)}/></label><label className="text-sm">Quantity{selected?.unit?` (${selected.unit})`:''}<input type="number" min="0.0001" max="999999999999.9999" step="0.0001" required className={field} value={form.quantity} onChange={e=>change('quantity',e.target.value)}/></label></div>
 {!selected?.unit&&<p className="text-sm text-amber-700 dark:text-amber-300">The reference workbook does not specify a valid unit for this material.</p>}
 <label className="block text-sm">Reference / note (optional)<input maxLength={500} placeholder="Delivery note or receipt number" className={field} value={form.reference} onChange={e=>change('reference',e.target.value)}/></label></>}
 </fieldset>{error&&<p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setMode(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save'}</Button></div></form>
 </Modal></section>;
}
