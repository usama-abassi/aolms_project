'use client';
import {useRef,useState} from 'react';
import {inventoryItemLabel,inventoryQuantityLabel,inventoryStep,isPieceUnit} from '@/lib/inventory-units';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {randomId} from '../../../lib/uuid';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {Select} from '../../../components/Select';
import {Input} from '../../../components/Input';
import {Table} from '../../../components/Table';

type Item={id:string;name:string;item_code:string;unit:string;available:number};
type PastEntry=Omit<Item,'available'>&{created_at:string;reference:string;project:string;quantity:number};
const emptyLine=()=>({id:randomId(),material_id:'',quantity:''});
export default function RequestInventory({userId}:{userId:string}){
 const client=useQueryClient(),submitting=useRef(false),requestId=useRef('');
 const [open,setOpen]=useState(false),[project,setProject]=useState(''),[lines,setLines]=useState([emptyLine()]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const history=useQuery({queryKey:['inventory-request-history',userId],queryFn:()=>api<PastEntry[]>('/inventory-requests?history=true'),enabled:open&&historyOpen,staleTime:0});
 const projects=useQuery({queryKey:['inventory-request-projects',userId],queryFn:()=>api<Array<{id:string;name:string;is_active:boolean}>>('/projects'),enabled:open});
 const stock=useQuery({queryKey:['inventory-request-stock',userId,project],queryFn:()=>api<Item[]>(`/inventory-requests?project_id=${project}`),enabled:open&&!!project,staleTime:0});
 const items=stock.data||[];
 function changed(){requestId.current='';setError('');}
 function update(id:string,patch:Partial<typeof lines[number]>){changed();setLines(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  if(!requestId.current)requestId.current=randomId();
  try{
   await api('/inventory-requests',{method:'POST',body:JSON.stringify({request_id:requestId.current,project_id:project,items:lines.map(row=>({material_id:row.material_id,quantity:Number(row.quantity)}))})});
   setOpen(false);setSuccess('Inventory request recorded and stock deducted.');setProject('');setLines([emptyLine()]);requestId.current='';
   await Promise.all([client.invalidateQueries({queryKey:['inventory-request-stock']}),client.invalidateQueries({queryKey:['material-inventory']}),client.invalidateQueries({queryKey:['inventory-request-history',userId]})]);
  }catch(err){setError(err instanceof Error?err.message:'Unable to request inventory');void stock.refetch();}
  finally{submitting.current=false;setBusy(false);}
 }
 return <div>
 <Button onClick={()=>{setSuccess('');setOpen(true);}}>Request Inventory</Button>
 {success&&<p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
 <Modal key={historyOpen?'history':'request'} isOpen={open} onClose={()=>{if(!busy){if(historyOpen)setHistoryOpen(false);else setOpen(false);}}} title={historyOpen?'My inventory past entries':'Request Inventory'} size={historyOpen?'full':'lg'} closeOnEscape={!busy} closeOnOverlayClick={!busy}>
 {historyOpen?<div className="space-y-4"><Button variant="outline" onClick={()=>setHistoryOpen(false)}>Back to request</Button><p className="text-sm text-neutral-500">Your latest 100 requested items across all projects. Times shown in Bahrain time.</p>
 {history.error?<div role="alert"><p>{history.error.message}</p><Button variant="outline" onClick={()=>history.refetch()}>Retry</Button></div>:<Table columns={[{key:'created_at',label:'Requested at',render:v=>new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Bahrain'})},{key:'project',label:'Project'},{key:'name',label:'Inventory item',render:(_v:unknown,row:PastEntry)=>inventoryItemLabel(row)},{key:'quantity',label:'Quantity / length',render:(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:4})},{key:'unit',label:'Unit',render:v=>v||'Not specified'},{key:'reference',label:'Request',render:v=>String(v).replace('inventory-request:','')}]} data={history.data||[]} rowKey="id" isLoading={history.isPending} emptyMessage="You have no past inventory requests."/>}</div>:<form onSubmit={submit} className="space-y-4"><div className="flex justify-end"><Button type="button" variant="outline" disabled={busy} onClick={()=>setHistoryOpen(true)}>Past entries</Button></div><p className="text-sm text-neutral-500">Submitting deducts all listed items from project stock.</p>
 <fieldset disabled={busy} className="space-y-4">
 <Select id="request-project" label="Project" required value={project} placeholder="Choose project" disabled={projects.isPending||!!projects.error} options={(projects.data||[]).filter(p=>p.is_active).map(p=>({value:p.id,label:p.name}))} onChange={e=>{changed();setProject(e.target.value);setLines([emptyLine()]);}}/>
 {lines.map((line,index)=>{const item=items.find(i=>i.id===line.material_id);return <div key={line.id} className="space-y-3 rounded-lg border p-3 dark:border-neutral-700">
 <Select id={`request-item-${line.id}`} label={`Inventory item ${index+1}`} required value={line.material_id} placeholder={project?'Choose inventory item':'Choose project first'} disabled={!project||stock.isFetching||!!stock.error} options={items.filter(i=>i.id===line.material_id||!lines.some(l=>l.material_id===i.id)).map(i=>({value:i.id,label:inventoryItemLabel(i)}))} onChange={e=>update(line.id,{material_id:e.target.value,quantity:''})}/>
 <Input id={`request-quantity-${line.id}`} label={inventoryQuantityLabel(item?.unit)} type="number" required min={inventoryStep(item?.unit)} step={inventoryStep(item?.unit)} max={item?.available} disabled={!item||stock.isFetching||!!stock.error} value={line.quantity} onChange={e=>update(line.id,{quantity:e.target.value})}/>
 {item&&<p className="text-sm text-neutral-500">Available: {item.available.toLocaleString(undefined,{maximumFractionDigits:4})} {item.unit||'(unit not specified)'}</p>}
 <div className="flex gap-2"><Button type="button" variant="outline" aria-label={`Add item after item ${index+1}`} disabled={!item||!line.quantity||Number(line.quantity)<=0||Number(line.quantity)>item.available||(isPieceUnit(item.unit)&&!Number.isInteger(Number(line.quantity)))||lines.length>=items.length||lines.length>=100} onClick={()=>{changed();setLines(rows=>[...rows.slice(0,index+1),emptyLine(),...rows.slice(index+1)]);}}>+ Add item</Button>{lines.length>1&&<Button type="button" variant="ghost" aria-label={`Remove item ${index+1}`} onClick={()=>{changed();setLines(rows=>rows.filter(r=>r.id!==line.id));}}>Remove</Button>}</div>
 </div>;})}
 </fieldset>
 {project&&!stock.isFetching&&!stock.error&&!items.length&&<p>No available inventory for this project.</p>}
 {(error||projects.error||stock.error)&&<p role="alert" className="text-sm text-danger-600">{error||projects.error?.message||stock.error?.message}</p>}
 <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" isLoading={busy} disabled={busy||!project||stock.isFetching||!!stock.error||!!projects.error||lines.some(l=>!l.material_id||!l.quantity||!items.some(i=>i.id===l.material_id))}>Submit request</Button></div>
 </form>}</Modal></div>;
}
