'use client'
import {useQuery} from '@tanstack/react-query'
import {api} from '@/components/portal/features/assurance/api'
import ServiceAssuranceAudit from '@/components/portal/features/controller/components/ServiceAssuranceAudit'

export default function Audit(){
 const projects=useQuery({queryKey:['admin-assurance-projects'],queryFn:()=>api<Array<{id:string;code:string}>>('/projects')})
 if(projects.isPending)return <p>Loading audit…</p>
 if(projects.error)return <p role="alert">{projects.error.message}</p>
 const project=projects.data?.find(p=>p.code==='SERVICE_DELIVERY')
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Service Assurance Audit</h1>{project?<ServiceAssuranceAudit projectId={project.id}/>:<p>No Service Assurance project configured.</p>}</div>
}
