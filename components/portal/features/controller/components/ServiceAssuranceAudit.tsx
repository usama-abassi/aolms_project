'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Table} from '../../../components/Table';
import {filterAssuranceAudit,type AssuranceAuditRow} from '@/lib/service-assurance-rules';
export default function ServiceAssuranceAudit({projectId}:{projectId:string}){
 const [tab,setTab]=useState<'all'|'submitted'|'unfilled'>('all'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0);
 const query=useQuery({queryKey:['service-assurance-audit',projectId],queryFn:()=>api<AssuranceAuditRow[]>(`/service-assurance/audit?project_id=${projectId}`),refetchInterval:30000});
 const {rows,counts}=filterAssuranceAudit(query.data||[],from,to,search,tab),pages=Math.max(1,Math.ceil(rows.length/50)),current=Math.min(page,pages-1);
 const field='mt-1 block rounded border bg-transparent p-2 dark:border-neutral-600';
 return <section className="space-y-4" aria-label="Service Assurance audit"><div role="tablist" aria-label="Response status" className="flex flex-wrap gap-2">{([['all','All'],['submitted','Submitted'],['unfilled','Not filled']] as const).map(([key,label])=><Button key={key} role="tab" aria-selected={tab===key} variant={tab===key?'primary':'outline'} onClick={()=>{setTab(key);setPage(0);}}>{label} ({counts[key]})</Button>)}<Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
 <div className="flex flex-wrap gap-3"><label>Assigned date from<input type="date" className={field} value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label><label>Assigned date to<input type="date" className={field} value={to} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label><label className="min-w-64 flex-1">Search<input className={`${field} w-full`} placeholder="Ticket ID, team, or serial number" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label></div>
 {query.error?<p role="alert">{query.error.message}</p>:<Table columns={[{key:'ticket_number',label:'Ticket No'},{key:'team',label:'Team'},{key:'assigned_datetime',label:'Assigned Date/Time'},{key:'old_serial',label:'SN OLD ONT'},{key:'new_serial',label:'New SN No As Per NCE'},{key:'response_status',label:'Response',render:(_v:unknown,row:AssuranceAuditRow)=>row.submitted_at?'Submitted':'Not filled'},{key:'technician',label:'Submitted by'},{key:'submitted_at',label:'Submitted at (Bahrain)',render:v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Asia/Bahrain'}):'—'}]} data={rows.slice(current*50,(current+1)*50)} rowKey="id" isLoading={query.isPending} emptyMessage="No qualifying replacement tickets match these filters."/>}
 <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={!current} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {pages} · {rows.length} records</span><Button variant="outline" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</Button></div></section>;
}
