'use client';
import dynamic from 'next/dynamic';
import {RouteSkeleton} from '@/components/portal/components/PageSkeleton';
import {LoadingState} from '@/components/portal/components/LoadingState';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import { api, currentUserId } from '../../assurance/api';
const DeliverySpreadsheet=dynamic(()=>import('../components/DeliverySpreadsheet'),{loading:RouteSkeleton});
const AssuranceSpreadsheet=dynamic(()=>import('../components/AssuranceSpreadsheet'),{loading:RouteSkeleton});
import {type SyncColumn} from '@/lib/services/google-sheets/sync-model';
import { Card } from '../../../components/Card';

export default function ControllerProjects(){
 const params=useSearchParams();const router=useRouter();const pathname=usePathname();const setParams=(values:Record<string,string>)=>router.push(pathname+'?'+new URLSearchParams(values));
 const [error,setError]=useState('');
 const projects=useQuery({queryKey:['controller-projects'],staleTime:30_000,queryFn:()=>api<Array<{id:string;name:string;code:string;is_active:boolean}>>('/projects'),refetchInterval:30000});
 const configs=useQuery({queryKey:['sheet-configurations'],queryFn:()=>api<Array<{project_id:string;month_key:string;columns:SyncColumn[]}>>('/sheet-configurations'),refetchInterval:30000});
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId});
 const list=projects.data||[];
 const project=list.find(p=>p.id===params.get('project'))||list[0];
 const month=params.get('month')||'';
 const config=configs.data?.find(c=>c.project_id===project?.id&&c.month_key===month);
 if(projects.isPending||user.isPending)return <LoadingState message="Loading projects…"/>;
 if(projects.error||user.error)return <p role="alert">{projects.error?.message||user.error?.message}</p>;
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Projects</h1>
 <div role="tablist" aria-label="Projects" className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-700">
 {list.map(p=><button key={p.id} role="tab" aria-selected={p.id===project?.id} onClick={()=>{setError('');setParams({project:p.id});}} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}
 </div><label className="block text-sm">Monthly sheet view<select className="ml-2 rounded border bg-transparent p-2" value={month} onChange={e=>setParams({project:project?.id||'',month:e.target.value})}><option value="">All records (existing columns)</option>{configs.data?.filter(c=>c.project_id===project?.id).map(c=><option key={c.month_key} value={c.month_key}>{c.month_key}</option>)}</select></label>{configs.error&&<p role="alert">Sheet configuration unavailable: {configs.error.message}</p>}{error&&<p role="alert">{error}</p>}
 {!project?<Card>No projects configured.</Card>:project.code==='SERVICE_ASSURANCE'?<DeliverySpreadsheet key={`${user.data}:${project.id}:${month}:${JSON.stringify(config?.columns)}`} projectId={project.id} userId={user.data!} month={month} columns={config?.columns}/>:project.code==='SERVICE_DELIVERY'?<AssuranceSpreadsheet key={`${user.data}:${project.id}:${month}:${JSON.stringify(config?.columns)}`} projectId={project.id} userId={user.data!} month={month} columns={config?.columns} serviceAssurance/>:<Card title={project.name}>This project workflow is not available yet.</Card>}
 </div>;
}
