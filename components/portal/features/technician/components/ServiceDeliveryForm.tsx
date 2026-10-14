'use client';
import {randomId} from '../../../lib/uuid';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,currentUserId} from '../../assurance/api';
import {calculateResponse,responseTotals,responseFields,type Values} from '@/lib/services/service-delivery/model';
import {Button} from '../../../components/Button';

export default function ServiceDeliveryForm(){
 const params=useParams<{ticketId:string}>(),id=params.ticketId;
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId});
 const query=useQuery({queryKey:['delivery-form',id,user.data],enabled:!!user.data,queryFn:()=>api<any>(`/service-delivery/workflow/${id}`)});
 if(query.isPending)return <p>Loading form…</p>;if(query.error)return <p role="alert">{query.error.message}</p>;
 return <Form key={`${user.data}:${id}`} id={id} userId={user.data!} initial={query.data}/>;
}
function Form({id,userId,initial}:{id:string;userId:string;initial:any}){
 const client=useQueryClient(),key=`service-delivery-form:${userId}:${id}`;
 const [values,setValues]=useState<Values>(initial.values),[version,setVersion]=useState<number|null>(initial.submission?.version??null),[submitted,setSubmitted]=useState(initial.submission?.submitted_at),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[now,setNow]=useState(Date.now()),[conflict,setConflict]=useState(false);
 const saving=useRef(false),revision=useRef(0);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){setValues(saved.values);setVersion(saved.version);setDirty(true);if(saved.version!==(initial.submission?.version??null))setConflict(true);}}catch{}const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[key,initial]);
 const editable=initial.can_edit&&(!submitted||now<new Date(submitted).getTime()+86400000);
 function change(k:string,v:string){const next=calculateResponse({...values,[k]:v});revision.current++;setValues(next);setDirty(true);setMessage('');try{localStorage.setItem(key,JSON.stringify({values:next,version}));}catch{setError('Local storage is unavailable. Save before leaving.');}}
 async function save(intent:'draft'|'submit'){
  if(saving.current||!editable||conflict)return;saving.current=true;setBusy(true);setError('');const rev=revision.current;
  try{const saved=await api<any>(`/service-delivery/workflow/${id}`,{method:'POST',body:JSON.stringify({values,base_version:version,mutation_id:randomId(),intent})});setVersion(saved.version);setSubmitted(saved.submitted_at);if(rev===revision.current){setValues({...values,A:saved.submitted_at||''});setDirty(false);localStorage.removeItem(key);}setMessage(intent==='submit'?'Submitted successfully':'Saved');void client.invalidateQueries({queryKey:['assurance-tasks']});void client.invalidateQueries({queryKey:['delivery-audit']});}
  catch(e){const text=(e as Error).message;setError(text);if(text.includes('changed. Reload'))setConflict(true);}finally{saving.current=false;setBusy(false);}
 }
 useEffect(()=>{if(!dirty||busy||conflict||!editable||error)return;const timer=setTimeout(()=>void save('draft'),2000);return()=>clearTimeout(timer);},[values,dirty,busy,conflict,editable,error]);
 return <div className="mx-auto max-w-5xl space-y-4"><h1 className="text-2xl font-semibold">Service Delivery Form · {initial.ticket.ticket_number}</h1><Link href="/technician/todo" className="underline">Back to tasks</Link><p>{submitted?`Submitted ${new Date(submitted).toLocaleString()} · Edit until ${new Date(new Date(submitted).getTime()+86400000).toLocaleString()}`:'Draft — not submitted'}</p>{!editable&&<p>View only: assignment changed or editing window expired.</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {conflict&&<div className="rounded border p-3"><p>The server has a newer version. Your local draft is retained.</p><details><summary>Compare saved and local values</summary><pre className="max-h-64 overflow-auto">{JSON.stringify({saved:initial.values,local:values},null,2)}</pre></details><Button onClick={()=>{localStorage.removeItem(key);window.location.reload();}}>Discard local draft and reload</Button></div>}
 <form onSubmit={e=>{e.preventDefault();void save('submit');}}><fieldset disabled={!editable||busy||conflict} className="grid gap-4 sm:grid-cols-2">{responseFields.map(f=><label key={f.key} className="text-sm">{f.label}{f.options.length?<><input list={`options-${f.key}`} className="mt-1 block w-full rounded border bg-transparent p-2" value={values[f.key]??''} required onChange={e=>change(f.key,e.target.value)}/><datalist id={`options-${f.key}`}>{f.options.map(option=><option key={option} value={option}/>)}</datalist></>:<input className="mt-1 block w-full rounded border bg-transparent p-2" aria-label={f.label} type={f.key==='A'?'text':f.type} readOnly={f.key==='A'||f.key==='D'||!!responseTotals[f.key]} value={values[f.key]??''} min={f.type==='number'?0:undefined} step={f.type==='number'?'any':undefined} required={['B','C','D','E','F','G','BN'].includes(f.key)} onChange={e=>change(f.key,e.target.value)}/>}</label>)}</fieldset><div className="mt-5 flex gap-3"><Button type="button" variant="outline" disabled={!editable||busy||conflict} onClick={()=>void save('draft')}>Save</Button><Button type="submit" disabled={!editable||busy||conflict}>Submit</Button><span role="status">{busy?'Saving…':dirty?'Unsaved changes':''}</span></div></form></div>;
}
