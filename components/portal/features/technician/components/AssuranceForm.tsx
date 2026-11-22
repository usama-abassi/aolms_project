'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import { randomId } from '../../../lib/uuid';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import { api, currentUserId, type FormDataResponse, type Submission } from '../../assurance/api';
import { readDraft, writeDraft } from '../../assurance/drafts';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Textarea } from '../../../components/Textarea';
import { Select } from '../../../components/Select';

const fields=[['response_order_type','Order Type'],['response_connection_type','Connection Type'],['root_cause','Root Cause'],['resolution','Resolution'],['resolution_description','Resolution Description'],['mims','MIMS'],['replacement_reason','Replacement Reason'],['replaced_cpe_model','Old CPE Model'],['replaced_cpe_sn','SN OLD ONT'],['new_cpe_model','New CPE Model'],['new_cpe_sn','New SN No As Per NCE'],['ont_protection_box','ONT Protection Box'],['saas_type','SAAS Type'],['box_number','Box Number'],['replacement','Replacement'],['saas_non_saas','SAAS / Non-SAAS'],['model','Model'],['physical_verification','Physical Verification'],['location','Location'],['remarks','Remarks']];
interface Draft {fields:Record<string,string|boolean>;base_version:number|null;mutation_id:string}
export default function AssuranceForm(){
 const {ticketId}=useParams<{ticketId:string}>();
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId});
 const query=useQuery({queryKey:['assurance-form',user.data,ticketId],enabled:!!user.data,queryFn:async()=>({...await api<FormDataResponse>(`/assurance-submissions/${ticketId}`),received_at:Date.now()}),refetchInterval:30000});
 if(user.isPending||query.isPending)return <LoadingState message="Loading form…"/>;
 if(query.error||user.error)return <p role="alert">{query.error?.message||user.error?.message}</p>;
 return <FormEditor key={`${user.data}:${ticketId}`} data={query.data!} ticketId={ticketId!} userId={user.data!} refresh={()=>query.refetch()}/>;
}
function FormEditor({data,ticketId,userId,refresh}:{data:FormDataResponse;ticketId:string;userId:string;refresh:()=>unknown}){
 const router=useRouter();
 const key=`aolms:assurance-form:v1:${userId}:${ticketId}`;
 const fresh=(submission:Submission|null):Draft=>({fields:Object.fromEntries([...fields.map(([k])=>[k,String(submission?.[k]??'')]),['closed',Boolean(submission?.closed)]]),base_version:submission?.version??null,mutation_id:randomId()});
 const [draft,setDraft]=useState<Draft>(()=>readDraft(key,fresh(data.submission)));
 const storageSnapshot=useRef(localStorage.getItem(key));
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [now,setNow]=useState(()=>Date.now());
 const cache=useQueryClient();
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 const offset=new Date(data.server_time).getTime()-data.received_at;
 const expired=!!data.submission?.submitted_at&&now+offset>=new Date(data.submission.submitted_at).getTime()+86400000;
 const editable=data.can_edit&&!expired;
 const conflict=draft.base_version!==(data.submission?.version??null);
 function change(k:string,v:string|boolean){if(localStorage.getItem(key)!==storageSnapshot.current){setError('Draft changed in another tab. Reload before editing.');return;}const next={...draft,fields:{...draft.fields,[k]:v},mutation_id:randomId()};setDraft(next);setMessage('');try{writeDraft(key,next);storageSnapshot.current=localStorage.getItem(key);}catch{setError('Local draft storage is unavailable. Keep the page open and save to the server.');}}
 async function save(intent:'draft'|'submit'){
  if(localStorage.getItem(key)!==storageSnapshot.current){setError('Draft changed in another tab. Reload before saving.');return;}
  setBusy(true);setError('');
  try{const submission=await api<Submission>(`/assurance-submissions/${ticketId}/save`,{method:'POST',body:JSON.stringify({...draft,intent})});localStorage.removeItem(key);storageSnapshot.current=null;setDraft(fresh(submission));setMessage(intent==='submit'?'Form submitted. The edit window runs from the original submission time.':'Form saved.');await cache.invalidateQueries({queryKey:['assurance-form']});await cache.invalidateQueries({queryKey:['assurance-tasks']});if(intent==='submit')router.push('/technician/todo');}catch(e){setError((e as Error).message);refresh();}finally{setBusy(false);}
 }
 const ticket=data.ticket;
 const displayedFields=editable?draft.fields:fresh(data.submission).fields;
 return <div className="mx-auto max-w-4xl space-y-4 break-words"><div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-h2 font-semibold">Service Delivery Form</h1><Link className="text-primary-600 underline" href={data.submission?.submitted_at?'/technician/submitted':'/technician/todo'}>{data.submission?.submitted_at?'Back to Submitted Orders':'Back to To-Do'}</Link></div>
 <Card title={`Ticket ${ticket.ticket_number}`}><dl className="grid gap-3 sm:grid-cols-3">{[['Circuit',ticket.circuit],['Work date',String(ticket.work_date||'').slice(0,10)],['Exchange',ticket.exchange],['Status',ticket.status],['Address',[ticket.block,ticket.road,ticket.building,ticket.flat].filter(Boolean).join(' / ')],['Service',ticket.service_type],['Mobile',ticket.mobile],['Fault description',ticket.fault_description_from_lo],['Customer description',ticket.customer_description]].map(([label,value])=><div key={String(label)}><dt className="text-xs text-neutral-500">{String(label)}</dt><dd className="whitespace-pre-wrap break-words text-sm">{String(value||'—')}</dd></div>)}</dl></Card>
 <Card><p>{data.submission?.submitted_at?'Completed':'Draft / To be completed'} · {editable?'Edit available':'View only — edit expired or assignment changed'}</p>{data.submission?.submitted_at&&<p className="text-sm">Submitted: {new Date(data.submission.submitted_at).toLocaleString()} · Edit deadline: {new Date(new Date(data.submission.submitted_at).getTime()+86400000).toLocaleString()}</p>}</Card>
 {error&&<p role="alert" className="text-danger-600">{error}</p>}{message&&<p role="status" className="text-success-700">{message}</p>}
 {conflict&&<Card><p>A newer form is saved on the server. Your local draft is preserved; saving is blocked until you review the new version.</p><details><summary>Compare saved values with your draft</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({saved:data.submission,local:draft.fields},null,2)}</pre></details><Button variant="outline" onClick={()=>{localStorage.removeItem(key);storageSnapshot.current=null;setDraft(fresh(data.submission));}}>Discard draft and load saved form</Button></Card>}
 <Card title="Technician findings"><form onSubmit={e=>{e.preventDefault();save('submit');}}><fieldset disabled={!editable||busy} className="grid gap-4 sm:grid-cols-2">{fields.map(([k,label])=>data.options?.[k]?<Select key={k} label={label} value={String(displayedFields[k]??'')} onChange={e=>change(k,e.target.value)} options={[{value:'',label:'Select...'},...Array.from(new Set([...data.options[k],String(displayedFields[k]||'')].filter(Boolean))).map(value=>({value,label:value}))]} required={['root_cause','resolution'].includes(k)}/>:['resolution_description','remarks'].includes(k)?<Textarea key={k} label={label} value={String(displayedFields[k]??'')} onChange={e=>change(k,e.target.value)} required={k==='resolution_description'}/>:<Input key={k} label={label} value={String(displayedFields[k]??'')} onChange={e=>change(k,e.target.value)} required={['root_cause','resolution'].includes(k)}/>)}<label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" checked={Boolean(displayedFields.closed)} onChange={e=>change('closed',e.target.checked)}/>Work completed</label></fieldset>{editable&&<div className="form-actions"><Button type="button" variant="outline" disabled={busy||conflict} onClick={()=>save('draft')}>Save draft</Button><Button type="submit" disabled={busy||conflict} isLoading={busy}>{data.submission?.submitted_at?'Save submitted form':'Submit'}</Button></div>}</form></Card>
 </div>;
}
