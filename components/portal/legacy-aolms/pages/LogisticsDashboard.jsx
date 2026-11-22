'use client';
import { useState,useEffect } from 'react';
import LogisticsTable from '../components/logistics/LogisticsTable';
import OntCheckTable from '../components/logistics/OntCheckTable';
import dynamic from 'next/dynamic';
import {DeferredSection} from '../../components/DeferredSection';
import {ChartSkeleton} from '../../components/Skeleton';
const LogisticsPieChart = dynamic(()=>import('../components/logistics/LogisticsPieChart'),{loading:ChartSkeleton});
import { api } from '../../features/assurance/api';
export default function LogisticsDashboard(){
 const [data,setData]=useState([]),[dates,setDates]=useState([]),[date,setDate]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[ont,setOnt]=useState(null),[tab,setTab]=useState('logistics');
 const [filter,setFilter]=useState('');
 const remote=r=>/remotely resolved|resolved remotely/.test((r.status||'').toLowerCase().replace(/_/g,' '));
 const resolved=r=>(r.status||'').toLowerCase().includes('resolved')&&!remote(r);
 const visible=data.filter(r=>filter==='resolved'?resolved(r):filter==='remotelyResolved'?remote(r):filter==='other'?!resolved(r)&&!remote(r):filter==='missing'?!r.isMatch:true);
 async function load(selected){setLoading(true);setError('');try{const r=await api(selected?'/logistics/change-date':'/logistics',selected?{method:'POST',body:JSON.stringify({selectedDate:selected})}:{});setData(r.data||[]);setDates(r.allDates||[]);setDate(r.selectedDate||'');setOnt(null)}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function check(){setLoading(true);setError('');try{const r=await api('/logistics/check-ont',{method:'POST',body:JSON.stringify({selectedDate:date})});setOnt(r.data||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
 return <div className="space-y-4 min-w-0">
  <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Logistics Management</h1><p>Tickets and technician responses</p></div><button className="task-action" onClick={()=>load(date)} disabled={loading}>Refresh</button></header>
  {error&&<p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
  <div className="flex flex-wrap gap-3"><label>Work date<select className="block rounded-lg border p-3" value={date} onChange={e=>load(e.target.value)}>{dates.map(d=><option key={d}>{d}</option>)}</select></label><button className="task-action" onClick={()=>setTab('logistics')}>Logistics</button><button className="task-action" onClick={()=>{setTab('ont');void check()}}>ONT Check</button></div>
  {tab==='logistics'?<>
   <div className="flex flex-wrap gap-3"><button className="task-action" onClick={()=>setFilter('')}>Tickets: {data.length}</button><button className="task-action" onClick={()=>setFilter('resolved')}>Resolved: {data.filter(resolved).length}</button><button className="task-action" onClick={()=>setFilter('remotelyResolved')}>Remotely resolved: {data.filter(remote).length}</button><button className="task-action" onClick={()=>setFilter('missing')}>Missing responses: {data.filter(r=>!r.isMatch).length}</button></div>
   {!!data.length&&<DeferredSection fallback={<ChartSkeleton/>}><LogisticsPieChart data={data} activeFilter={filter} onSegmentClick={key=>setFilter(filter===key?'':key)}/></DeferredSection>}
   <LogisticsTable data={visible} loading={loading} hasComparison/>
  </>:<OntCheckTable data={ont} loading={loading} onCheckClick={check}/>}
 </div>;
}
