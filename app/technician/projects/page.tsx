'use client'
import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {api,currentUserId} from '@/components/portal/features/assurance/api'
import ServiceAssuranceTasks from '@/components/portal/features/technician/components/ServiceAssuranceTasks'
import {Button} from '@/components/portal/components/Button'

export default function Projects(){
 const [todo,setTodo]=useState(true)
 const user=useQuery({queryKey:['session-user-id'],queryFn:currentUserId})
 const projects=useQuery({queryKey:['technician-projects'],queryFn:()=>api<Array<{id:string;code:string;name:string}>>('/projects')})
 if(user.isPending||projects.isPending)return <p>Loading projects…</p>
 if(user.error||projects.error)return <p role="alert">{user.error?.message||projects.error?.message}</p>
 const project=projects.data?.find(p=>p.code==='SERVICE_DELIVERY')
 return <div className="space-y-4"><h1 className="text-h2 font-semibold">Projects</h1>
 {project?<><h2 className="text-lg font-semibold">{project.name}</h2><div className="flex gap-2"><Button variant={todo?'primary':'outline'} onClick={()=>setTodo(true)}>To-Do</Button><Button variant={todo?'outline':'primary'} onClick={()=>setTodo(false)}>Submitted</Button></div><ServiceAssuranceTasks userId={user.data!} todo={todo}/></>:<p>No Service Assurance project configured.</p>}
 </div>
}
