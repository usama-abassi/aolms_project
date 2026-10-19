'use client';
import {useState,useRef,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {Table} from '../../../components/Table';
import {serviceAssuranceResponseFields,responseIdentifiers,materialFields} from '@/lib/service-assurance-fields';

type Task={id:string;ticket_number:string;team_name:string;assigned_datetime:string;old_serial:string;new_serial:string;submitted_at:string|null};
type ResponseData={id:string;version:number;response_version:number;values:Record<string,string>;submitted_at:string|null};
export default function ServiceAssuranceTasks({userId,todo}:{userId:string;todo:boolean}){
 const [selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0);
 const tasks=useQuery({queryKey:['service-assurance-tasks',userId],queryFn:()=>api<Task[]>('/service-assurance/tasks'),refetchInterval:60000});
 const rows=(tasks.data||[]).filter(r=>todo?!r.submitted_at:!!r.submitted_at),pages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,pages-1);
 return <section className="space-y-3" aria-label="Service Assurance tasks"><h2 className="text-lg font-semibold">Service Assurance ({rows.length})</h2>
 {tasks.error?<p role="alert">{tasks.error.message}</p>:<Table columns={[{key:'id',label:'Action',render:(_v:unknown,row:Task)=><Button variant="outline" onClick={()=>setSelected(row.id)}>{row.submitted_at?'View':'Fill response'}</Button>},{key:'ticket_number',label:'Ticket No'},{key:'team_name',label:'Team'},{key:'assigned_datetime',label:'Assigned Date/Time'},{key:'old_serial',label:'SN OLD ONT'},{key:'new_serial',label:'New SN No As Per NCE'},{key:'submitted_at',label:'Response',render:v=>v?'Submitted':'Not filled'}]} data={rows.slice(current*20,(current+1)*20)} rowKey="id" isLoading={tasks.isPending} emptyMessage={`No ${todo?'pending':'submitted'} Service Assurance replacement tickets.`}/>}
 {pages>1&&<div className="flex items-center gap-3"><Button variant="outline" disabled={!current} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {pages}</span><Button variant="outline" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</Button></div>}
 {selected&&<ResponseForm key={selected} id={selected} userId={userId} close={()=>setSelected(null)}/>}
 </section>;
}
function ResponseForm({id,userId,close}:{id:string;userId:string;close:()=>void}){
 const client=useQueryClient(),saving=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[edits,setEdits]=useState<Record<string,string>>({});
 const query=useQuery({queryKey:['service-assurance-response',userId,id],queryFn:()=>api<ResponseData>(`/service-assurance/responses/${id}`)});
 const submitted=!!query.data?.submitted_at
 const draftKey='assurance-response:'+userId+':'+id
 useEffect(()=>{try{const saved=localStorage.getItem(draftKey);if(saved)setEdits(JSON.parse(saved))}catch{}},[draftKey])
 function edit(key:string,value:string){setEdits(previous=>{const next={...previous,[key]:value};try{localStorage.setItem(draftKey,JSON.stringify(next))}catch{}return next})}

 async function submit(e:React.FormEvent,draft=false){
  e.preventDefault();if(saving.current||!query.data)return;saving.current=true;setBusy(true);setError('');
  try{await api(`/service-assurance/responses/${id}`,{method:'POST',body:JSON.stringify({draft,response_version:query.data.response_version,version:query.data.version,values:{...query.data.values,...edits}})});
   await Promise.all([client.invalidateQueries({queryKey:['service-assurance-tasks',userId]}),client.invalidateQueries({queryKey:['service-assurance-response',userId,id]}),client.invalidateQueries({queryKey:['service-assurance-audit']})]);localStorage.removeItem(draftKey);setEdits({});if(!draft)close();
  }catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
 }
 return <Modal isOpen onClose={()=>{if(!busy)close();}} title={submitted?'Edit Service Assurance response':'Service Assurance materials'} size="full" closeOnEscape={!busy} closeOnOverlayClick={!busy}>
 {query.isPending?<p>Loading response…</p>:query.error?<p role="alert">{query.error.message}</p>:<form onSubmit={e=>void submit(e)} className="space-y-4"><p className="text-sm text-neutral-500">Ticket details are prefilled. Changes are cached on this device. Save draft or submit for Audit.</p>
 <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{serviceAssuranceResponseFields.map(key=>{
 const readOnly=Object.hasOwn(responseIdentifiers,key)||key==='Timestamp'
 const value=edits[key]??query.data!.values[key]??''
 const style='mt-1 block w-full rounded-lg border p-2 dark:border-neutral-600 bg-transparent'
 return <label key={key} className="block text-sm">{key}{key==='ONT Replaced '?<select aria-label={key.trim()} className={style} value={value} onChange={e=>edit(key,e.target.value)}><option value="">Select</option><option>Yes</option><option>No</option></select>:materialFields.includes(key)?<input aria-label={key.trim()} type="number" min="0" step="any" className={style} value={value} onChange={e=>edit(key,e.target.value)}/>:<textarea aria-label={key.trim()} rows={2} readOnly={readOnly} value={value} onChange={e=>edit(key,e.target.value)} className={style}/>}</label>
 })}</fieldset>
 {error&&<p role="alert" className="text-danger-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>Close</Button><Button variant="outline" disabled={busy} onClick={e=>void submit(e,true)}>Save draft</Button><Button type="submit" disabled={busy}>{busy?'Saving…':submitted?'Update submission':'Submit response'}</Button></div></form>}
 </Modal>;
}
