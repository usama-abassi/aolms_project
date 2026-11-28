'use client';
import dynamic from 'next/dynamic';
import {RouteSkeleton} from '@/components/portal/components/PageSkeleton';
import {LoadingState} from '@/components/portal/components/LoadingState';
import { useQuery } from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import { api, currentUserId } from '../../assurance/api';
import RecordMonthSelect from '../../assurance/RecordMonthSelect';
import {recordMonths} from '../../assurance/record-months';
const DeliverySpreadsheet=dynamic(()=>import('../components/DeliverySpreadsheet'),{loading:RouteSkeleton});
const AssuranceSpreadsheet=dynamic(()=>import('../components/AssuranceSpreadsheet'),{loading:RouteSkeleton});
import {type SyncColumn} from '@/lib/services/google-sheets/sync-model';
import { Card } from '../../../components/Card';

export default function ControllerProjects(){
 const params=useSearchParams();const router=useRouter();const pathname=usePathname();const setParams=(values:Record<string,string>)=>router.push(pathname+'?'+new URLSearchParams(values));
 const projects=useQuery({queryKey:['controller-projects'],staleTime:30_000,queryFn:()=>api<Array<{id:string;name:string;code:string;is_active:boolean}>>('/projects'),refetchInterval:30000});
 const configs=useQuery({queryKey:['sheet-configurations'],queryFn:()=>api<Array<{project_id:string;month_key:string;columns:SyncColumn[]}>>('/sheet-configurations'),refetchInterval:30000});
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId});
 const list=projects.data||[];
 const project=list.find(p=>p.id===params.get('project'))||list[0];
 const delivery=project?.code==='SERVICE_ASSURANCE';
 const supported=delivery||project?.code==='SERVICE_DELIVERY';
 const records=useQuery({
  queryKey:delivery?['delivery-orders',project?.id]:['/service-assurance',user.data,project?.id],
  queryFn:()=>api<Array<{work_date?:string;date?:string}>>(delivery?`/service-delivery/workflow?project_id=${project?.id}`:`/service-assurance?project_id=${project?.id}`),
  enabled:!!project&&!!user.data&&supported,staleTime:15_000
 });
 const months=recordMonths((records.data||[]).map(r=>delivery?r.work_date:r.date));
 const month=params.get('month')??months[0]??'';
 const options=[...months,...(configs.data||[]).filter(c=>c.project_id===project?.id).map(c=>c.month_key)];
 const config=configs.data?.find(c=>c.project_id===project?.id&&c.month_key===month);
 if(projects.isPending||user.isPending)return <LoadingState message="Loading projects…"/>;
 if(projects.error||user.error)return <p role="alert">{projects.error?.message||user.error?.message}</p>;
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Projects</h1>
 <div role="tablist" aria-label="Projects" className="flex min-w-0 gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-700">
 {list.map(p=><button key={p.id} role="tab" aria-selected={p.id===project?.id} onClick={()=>{setParams({project:p.id});}} className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm sm:px-4 ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}
 </div>{(!supported||!records.isPending)&&<RecordMonthSelect months={options} value={month} onChange={month=>setParams({project:project?.id||'',month})}/>}
 {configs.error&&<p role="alert">Sheet configuration unavailable: {configs.error.message}</p>}
 {supported&&records.isPending?<LoadingState message="Loading records…"/>:records.error?<p role="alert">{records.error.message}</p>:!project?<Card>No projects configured.</Card>:project.code==='SERVICE_ASSURANCE'?<DeliverySpreadsheet key={`${user.data}:${project.id}:${month}:${JSON.stringify(config?.columns)}`} projectId={project.id} userId={user.data!} month={month} columns={config?.columns}/>:project.code==='SERVICE_DELIVERY'?<AssuranceSpreadsheet key={`${user.data}:${project.id}:${month}:${JSON.stringify(config?.columns)}`} projectId={project.id} userId={user.data!} month={month} columns={config?.columns} serviceAssurance/>:<Card title={project.name}>This project workflow is not available yet.</Card>}
 </div>;
}
