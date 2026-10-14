'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import { api, currentUserId } from '../../assurance/api';
import DeliverySpreadsheet from '../components/DeliverySpreadsheet';
import AssuranceSpreadsheet from '../components/AssuranceSpreadsheet';
import { Card } from '../../../components/Card';

export default function ControllerProjects(){
 const params=useSearchParams();const router=useRouter();const pathname=usePathname();const setParams=(values:Record<string,string>)=>router.push(pathname+'?'+new URLSearchParams(values));
 const [error,setError]=useState('');
 const projects=useQuery({queryKey:['controller-projects'],queryFn:()=>api<Array<{id:string;name:string;code:string;is_active:boolean}>>('/projects'),refetchInterval:30000});
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId});
 const list=projects.data||[];
 const project=list.find(p=>p.id===params.get('project'))||list[0];
 if(projects.isPending||user.isPending)return <p>Loading projects...</p>;
 if(projects.error||user.error)return <p role="alert">{projects.error?.message||user.error?.message}</p>;
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Projects</h1>
 <div role="tablist" aria-label="Projects" className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-700">
 {list.map(p=><button key={p.id} role="tab" aria-selected={p.id===project?.id} onClick={()=>{setError('');setParams({project:p.id});}} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${p.id===project?.id?'bg-primary-600 text-white':'bg-neutral-100 dark:bg-neutral-800'}`}>{p.name}</button>)}
 </div>{error&&<p role="alert">{error}</p>}
 {!project?<Card>No projects configured.</Card>:project.code==='SERVICE_ASSURANCE'?<DeliverySpreadsheet key={`${user.data}:${project.id}`} projectId={project.id} userId={user.data!}/>:project.code==='SERVICE_DELIVERY'?<AssuranceSpreadsheet key={`${user.data}:${project.id}`} projectId={project.id} userId={user.data!} serviceAssurance/>:<Card title={project.name}>This project workflow is not available yet.</Card>}
 </div>;
}
