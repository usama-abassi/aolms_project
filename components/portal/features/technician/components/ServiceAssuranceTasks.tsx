'use client';
import {useState,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Modal} from '../../../components/Modal';
import {Table} from '../../../components/Table';
import {serviceAssuranceResponseFields,responseIdentifiers} from '@/lib/service-assurance-fields';

type Task={id:string;ticket_number:string;team_name:string;assigned_datetime:string;old_serial:string;new_serial:string;submitted_at:string|null};
type ResponseData={id:string;version:number;values:Record<string,string>;submitted_at:string|null};
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
 const submitted=!!query.data?.submitted_at;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(saving.current||!query.data)return;saving.current=true;setBusy(true);setError('');
  try{await api(`/service-assurance/responses/${id}`,{method:'POST',body:JSON.stringify({version:query.data.version,values:{...query.data.values,...edits}})});
   await Promise.all([client.invalidateQueries({queryKey:['service-assurance-tasks',userId]}),client.invalidateQueries({queryKey:['service-assurance-response',userId,id]}),client.invalidateQueries({queryKey:['service-assurance-audit']})]);close();
  }catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}
 }
 return <Modal isOpen onClose={()=>{if(!busy)close();}} title={submitted?'Service Assurance response':'Non-Genuine Ticket Tracker'} size="full" closeOnEscape={!busy} closeOnOverlayClick={!busy}>
 {query.isPending?<p>Loading response…</p>:query.error?<p role="alert">{query.error.message}</p>:<form onSubmit={submit} className="space-y-4"><p className="text-sm text-neutral-500">{submitted?'This response has been submitted.':'Ticket details are prefilled and read-only. Enter the applicable answers, then submit once.'}</p>
 <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{serviceAssuranceResponseFields.map(key=><label key={key} className="block text-sm">{key}<textarea rows={2} readOnly={submitted||Object.hasOwn(responseIdentifiers,key)} value={edits[key]??query.data!.values[key]??''} onChange={e=>setEdits(v=>({...v,[key]:e.target.value}))} className={`mt-1 block w-full rounded-lg border p-2 dark:border-neutral-600 ${submitted||Object.hasOwn(responseIdentifiers,key)?'bg-neutral-100 dark:bg-neutral-800':'bg-white dark:bg-neutral-900'}`}/></label>)}</fieldset>
 {error&&<p role="alert" className="text-danger-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>Close</Button>{!submitted&&<Button type="submit" disabled={busy}>{busy?'Submitting…':'Submit response'}</Button>}</div></form>}
 </Modal>;
}
