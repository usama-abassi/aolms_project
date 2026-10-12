'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import { api } from '../../assurance/api';
import { Button } from '../../../components/Button';
import ServiceAssuranceAudit from '../components/ServiceAssuranceAudit';
import { Table, type Column } from '../../../components/Table';

type Project={id:string;name:string;code:string};
type Row=Record<string,any>;
type AuditResult={verification:Row[];crossVerification:Row[];finalOutput:Row[];generatedAt:string};
const mark=(v:boolean)=><span className={v?'text-emerald-700 dark:text-emerald-300':'text-rose-700 dark:text-rose-300'}>{v?'Matched':'Missing / mismatch'}</span>;
const columns:Record<string,Column[]>={
 verification:[{key:'date',label:'Date'},{key:'wbsOrder',label:'Order'},{key:'orderMatch',label:'Form filled',render:v=>v?'Filled':'Not filled'},
 {key:'wbsType',label:'WBS Type'},{key:'responseFttrOrderType',label:'Technician Type'},{key:'typeMatch',label:'Type check',render:mark},
 {key:'wbsConnectionType',label:'WBS Connection Type'},{key:'responseConnectionType',label:'Technician Connection Type'},{key:'connectionMatch',label:'Connection check',render:mark},{key:'wbsNceSN',label:'NCE SN'}],
 crossVerification:[{key:'date',label:'Date'},{key:'orderNumber',label:'Order'},{key:'team',label:'Team'},{key:'orderType',label:'WBS Type'},{key:'connectionType',label:'Connection Type'},{key:'nceSN',label:'NCE SN'},{key:'scenario',label:'Scenario'},{key:'poNumber',label:'PO Number'},{key:'foundInOnt',label:'ONT found',render:v=>v?'Yes':'No'},{key:'foundInCpe',label:'CPE found',render:v=>v?'Yes':'No'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}],
 finalOutput:[{key:'date',label:'Date'},{key:'orderNumber',label:'Order'},{key:'projectType',label:'Project Type'},{key:'wbsType',label:'WBS Type'},{key:'exchange',label:'Exchange'},{key:'lo',label:'LO'},{key:'connectionType',label:'Connection Type'},{key:'serialNumber',label:'Serial Number'},{key:'poNumber',label:'PO Number'},{key:'assetDescription',label:'Asset Description'},{key:'labourCharge',label:'Labour Charge'},{key:'cpeCharge',label:'CPE Charge'},{key:'warnings',label:'Warnings',render:v=>v.join('; ')}],
};
export default function Audit(){
 const params=useSearchParams();const router=useRouter();const pathname=usePathname();const setParams=(values:Record<string,string>)=>router.push(pathname+'?'+new URLSearchParams(values));
 const projects=useQuery({queryKey:['controller-projects'],queryFn:()=>api<Project[]>('/projects'),refetchInterval:30000});
 const list=projects.data||[],project=list.find(p=>p.id===params.get('project'))||list[0];
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Audit</h1>
 {projects.error&&<p role="alert">{projects.error.message}</p>}{projects.isPending&&<p>Loading projects…</p>}
 <div role="tablist" aria-label="Audit projects" className="flex gap-2 overflow-x-auto border-b pb-2 dark:border-neutral-700">{list.map(p=><button role="tab" aria-selected={p.id===project?.id} key={p.id} onClick={()=>setParams({project:p.id})} className={`shrink-0 rounded-lg px-4 py-2 ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}</div>
 {project?.code==='SERVICE_ASSURANCE'&&<ProjectAudit key={project.id} project={project}/>}{project?.code==='SERVICE_DELIVERY'&&<ServiceAssuranceAudit key={project.id} projectId={project.id}/>} {!projects.isPending&&!project&&<p>No projects configured.</p>}
 </div>;
}
function ProjectAudit({project}:{project:Project}){
 const [stage,setStage]=useState<'verification'|'crossVerification'|'finalOutput'>('verification');
 const [search,setSearch]=useState(''),[dateFrom,setFrom]=useState(''),[dateTo,setTo]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
 const query=useQuery({queryKey:['project-audit',project.id],queryFn:()=>api<AuditResult>(`/project-audit/${project.id}`),refetchInterval:60000});
 const baseRows=(query.data?.[stage]||[]).filter(r=>(!dateFrom||r.date>=dateFrom)&&(!dateTo||r.date<=dateTo)&&Object.values(r).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())));
 const filters:Array<{key:string;label:string;matches:(r:Row)=>boolean}>=stage==='verification'
  ?[{key:'all',label:'Total',matches:()=>true},{key:'filled',label:'Filled',matches:r=>!!r.orderMatch},{key:'unfilled',label:'Not filled',matches:r=>!r.orderMatch}]
  :stage==='crossVerification'
   ?[{key:'all',label:'Total',matches:()=>true},{key:'ont',label:'Found in ONT',matches:r=>!!r.foundInOnt},{key:'ok',label:'OK',matches:r=>r.status==='OK'},{key:'investigate',label:'Investigate',matches:r=>r.status==='Investigate'}]
   :[{key:'all',label:'Total',matches:()=>true},{key:'clean',label:'Clean',matches:r=>!r.warnings?.length},{key:'warning',label:'Warning',matches:r=>!!r.warnings?.length}];
 const rows=baseRows.filter(filters.find(f=>f.key===filter)?.matches||(()=>true));
 const pages=Math.max(1,Math.ceil(rows.length/50)),current=Math.min(page,pages-1);
 return <div className="space-y-4">
 <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Audit stages">{([['verification','Data Verification'],['crossVerification','Cross Verification & ONT Check'],['finalOutput','Final Output']] as const).map(([key,label])=><Button key={key} role="tab" aria-selected={stage===key} variant={stage===key?'primary':'outline'} onClick={()=>{setStage(key);setFilter('all');setPage(0);}}>{label}</Button>)}<Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}>Refresh audit</Button></div>
 <p className="text-sm">{stage==='verification'?'Checks every order for a submitted form, WBS Type and WBS Connection Type. Blank technician answers remain unmatched.':stage==='crossVerification'?'Uses the same Service Assurance rules: resolved/closed tickets with submitted forms; ONT serial and PO lookup; CPE order check for non-New orders with a PO.':'Uses the same Service Assurance output and charge rules: resolved/closed tickets with WBS Type New. Verification issues remain visible in the preceding tabs.'}</p>
 <div className="flex flex-wrap gap-3"><label className="min-w-0">Search<input className="block rounded border bg-transparent p-2 dark:border-neutral-600" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} /></label>
 <label>From<input type="date" className="block rounded border bg-transparent p-2 dark:border-neutral-600" value={dateFrom} onChange={e=>{setFrom(e.target.value);setPage(0);}}/></label><label>To<input type="date" className="block rounded border bg-transparent p-2 dark:border-neutral-600" value={dateTo} onChange={e=>{setTo(e.target.value);setPage(0);}}/></label>
 </div>
 {query.error&&<p role="alert">{query.error.message}</p>}
 {stage==='finalOutput'&&<div className="space-y-2"><p>Labour total: {rows.reduce((s,r)=>s+r.labourCharge,0).toFixed(2)} · CPE total: {rows.reduce((s,r)=>s+r.cpeCharge,0).toFixed(2)}</p><Button disabled title="Customer template has not been supplied yet">Export customer template</Button><p className="text-sm">Customer-format export will be enabled after your template and column mapping are supplied.</p></div>}
 <div role="group" aria-label="Audit count filters" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
 {filters.map(f=><button key={f.key} type="button" aria-pressed={filter===f.key} onClick={()=>{setFilter(f.key);setPage(0);}} className={`min-h-[76px] rounded-xl border px-5 py-3 text-left sm:min-w-[140px] ${filter===f.key?'border-primary-600 bg-primary-600 text-white':'border-neutral-200 bg-white text-neutral-800 hover:bg-primary-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'}`}><span className="block text-sm">{f.label}</span><span className="block text-2xl font-semibold">{baseRows.filter(f.matches).length}</span></button>)}
 </div>
 <Table columns={columns[stage]} data={rows.slice(current*50,(current+1)*50)} rowKey={r=>`${r.date}:${r.wbsOrder||r.orderNumber}`} isLoading={query.isPending} emptyMessage="No matching order records for this project and filter."/>
 <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {pages}</span><Button variant="outline" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Next</Button></div><p className="ml-auto text-right text-sm">Showing {rows.length?current*50+1:0}–{Math.min((current+1)*50,rows.length)} of {rows.length} records · 50 per page</p></div>
 </div>;
}
