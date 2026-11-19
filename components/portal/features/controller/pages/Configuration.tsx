'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../assurance/api';
import {Button} from '../../../components/Button';
import {Input} from '../../../components/Input';
import GoogleAccount from '../components/GoogleAccount';
import {Card} from '../../../components/Card';

type Config={id:string;project_id:string;project_name:string;month_key:string;sheet_url:string;tab_name:string;version:number;last_success_at:string|null;last_attempt_at:string|null;sync_status:string;pending_changes:number;latest_error:string|null};
type Form={id?:string;version?:number;month:string;sheet_url:string;tab_name:string};
const blank:Form={month:'',sheet_url:'',tab_name:''};
const timestamp=(value:string|null)=>value?new Date(value).toLocaleString():'—';
const monthLabel=(value:string)=>{const [year,month]=value.split('-').map(Number);return new Intl.DateTimeFormat('en',{month:'short',year:'numeric'}).format(new Date(year,month-1,1));};

export default function Configuration(){
 const configs=useQuery({queryKey:['sheet-configurations'],queryFn:()=>api<Config[]>('/sheet-configurations'),refetchInterval:30000});
 const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Array<{id:string;name:string}>>('/projects')});
 const [selected,setSelected]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('google')?'google-account':''),[form,setForm]=useState<Form>(blank),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const project=projects.data?.find(p=>p.id===selected)||projects.data?.[0];
 const tabs=[...(projects.data||[]),{id:'google-account',name:'Google Account'}];
 const activeId=selected==='google-account'||!project?'google-account':project.id;
 const monthly=(configs.data||[]).filter(c=>c.project_id===project?.id).sort((a,b)=>b.month_key.localeCompare(a.month_key));
 function selectProject(id:string){setSelected(id);setForm(blank);setError('');}
 async function save(e:React.FormEvent){
  e.preventDefault();if(!project)return;
  if(monthly.some(c=>c.month_key===form.month&&c.id!==form.id)){setError('This project already has a configuration for this month');return;}
  setBusy(true);setError('');
  try{await api('/sheet-configurations',{method:'POST',body:JSON.stringify({...form,project_id:project.id})});setForm(blank);await configs.refetch();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function sync(c:Config){setBusy(true);setError('');try{await api('/sheet-configurations/sync',{method:'POST',body:JSON.stringify({id:c.id})});}catch(e){setError((e as Error).message);}finally{await configs.refetch();setBusy(false);}}
 async function remove(c:Config){
  if(!window.confirm('Delete this integration configuration? Existing operational records will be retained.'))return;
  setBusy(true);setError('');try{await api('/sheet-configurations',{method:'DELETE',body:JSON.stringify({id:c.id,version:c.version})});if(form.id===c.id)setForm(blank);await configs.refetch();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="space-y-4">
  <div><h1 className="text-h2 font-semibold">Configuration</h1><p className="mt-1 text-sm text-neutral-500">Manage monthly spreadsheet connections by project. Connect or remove your Google account in the Google Account tab.</p></div>
  {(error||configs.error||projects.error)&&<p role="alert" className="text-sm text-danger-600 dark:text-danger-400">{error||configs.error?.message||projects.error?.message}</p>}
  <>
   <div role="tablist" aria-label="Configuration projects" className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-700">
    {tabs.map((p,index)=><button key={p.id} id={`configuration-tab-${p.id}`} type="button" role="tab" aria-selected={p.id===activeId} aria-controls={`configuration-panel-${p.id}`} tabIndex={p.id===activeId?0:-1} disabled={busy} onClick={()=>selectProject(p.id)} onKeyDown={e=>{
     const list=tabs;let next=index;
     if(e.key==='ArrowRight')next=(index+1)%list.length;else if(e.key==='ArrowLeft')next=(index-1+list.length)%list.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=list.length-1;else return;
     e.preventDefault();selectProject(list[next].id);document.getElementById(`configuration-tab-${list[next].id}`)?.focus();
    }} className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:opacity-50 ${p.id===activeId?'bg-primary-600 text-white':'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'}`}>{p.name}</button>)}
   </div>
   {activeId==='google-account'?<section role="tabpanel" id="configuration-panel-google-account" aria-labelledby="configuration-tab-google-account"><GoogleAccount/></section>:projects.isPending?<p>Loading projects…</p>:!project?<Card>No projects configured.</Card>:<section role="tabpanel" id={`configuration-panel-${project.id}`} aria-labelledby={`configuration-tab-${project.id}`} className="min-w-0 space-y-4">
    <Card title={form.id?'Edit configuration':'Add configuration'}>
     <form onSubmit={save}><fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Input label="Month" required type="month" value={form.month} onChange={e=>setForm({...form,month:e.target.value})}/>
      <div className="min-w-0 sm:col-span-2 xl:col-span-1"><Input label="Google Sheet URL" required type="url" value={form.sheet_url} onChange={e=>setForm({...form,sheet_url:e.target.value})}/></div>
      <Input label="Sheet/Tab Name" required maxLength={100} value={form.tab_name} onChange={e=>setForm({...form,tab_name:e.target.value})}/>
      <div className="flex flex-wrap items-end gap-2"><Button type="submit" disabled={busy||configs.isPending||!!configs.error}>{busy?'Working…':form.id?'Update configuration':'Add configuration'}</Button>{form.id&&<Button variant="ghost" onClick={()=>{setForm(blank);setError('');}}>Cancel</Button>}</div>
     </fieldset></form>
    </Card>
    <Card padding="none" className="overflow-hidden">
     {configs.isPending?<p className="p-4">Loading configurations…</p>:!monthly.length?<p className="p-4 text-sm text-neutral-500">No configurations yet for {project.name}.</p>:<div className="overflow-x-auto" role="region" aria-label={`${project.name} monthly configurations`} tabIndex={0}><table className="w-full text-left text-sm"><caption className="sr-only">{project.name} monthly Google Sheets configurations</caption>
      <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"><tr>{['Month','Google Sheet URL','Sheet/Tab Name','Synchronization','Last successful sync','Actions'].map(h=><th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold" key={h}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">{monthly.map(c=><tr key={c.id}><td className="whitespace-nowrap px-4 py-3 font-medium">{monthLabel(c.month_key)}</td><td className="px-4 py-3"><a className="block min-w-48 max-w-80 break-all text-primary-600 underline dark:text-primary-300" href={c.sheet_url} target="_blank" rel="noreferrer">{c.sheet_url}</a></td><td className="px-4 py-3">{c.tab_name}</td><td className="min-w-52 px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${c.latest_error?'bg-danger-50 text-danger-700 dark:bg-danger-950 dark:text-danger-300':'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'}`}>{c.sync_status.replace(/_/g,' ')}</span><details className="mt-2 text-xs text-neutral-500"><summary className="cursor-pointer">Sync details</summary><p>Last attempt: {timestamp(c.last_attempt_at)}</p><p>Pending proposals: {c.pending_changes??0}</p>{c.latest_error&&<p className="mt-1 text-danger-600 dark:text-danger-400">{c.latest_error}</p>}</details></td><td className="whitespace-nowrap px-4 py-3">{timestamp(c.last_success_at)}</td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void sync(c)}>Sync now</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setError('');setForm({id:c.id,version:c.version,month:c.month_key,sheet_url:c.sheet_url,tab_name:c.tab_name});}}>Edit</Button><Button size="sm" variant="danger" disabled={busy} onClick={()=>void remove(c)}>Delete</Button></div></td></tr>)}</tbody>
     </table></div>}
    </Card>
    <p className="text-xs text-neutral-500">Existing Sheet values are never overwritten automatically. Proposed updates appear in the spreadsheet’s review tab.</p>
   </section>}
  </>
 </div>;
}
