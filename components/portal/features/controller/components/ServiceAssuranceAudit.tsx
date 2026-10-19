'use client'
import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {api} from '../../assurance/api'
import {Button} from '../../../components/Button'
import {Table} from '../../../components/Table'
import {Modal} from '../../../components/Modal'
import {filterAssuranceAudit,type AssuranceAuditRow,type AssuranceAuditTab} from '@/lib/service-assurance-rules'
import {assuranceReportColumns,assuranceReportGroups} from '@/lib/service-assurance-fields'

export default function ServiceAssuranceAudit({projectId}:{projectId:string}){
 const [tab,setTab]=useState<AssuranceAuditTab>('all'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<AssuranceAuditRow|null>(null),[error,setError]=useState('')
 const query=useQuery({queryKey:['service-assurance-audit',projectId],queryFn:()=>api<AssuranceAuditRow[]>(`/service-assurance/audit?project_id=${projectId}`),refetchInterval:30000})
 const {rows,counts}=filterAssuranceAudit(query.data||[],from,to,search,tab),pages=Math.max(1,Math.ceil(rows.length/50)),current=Math.min(page,pages-1)
 const field='mt-1 block rounded border bg-transparent p-2 dark:border-neutral-600'
 async function exportReport(){
  try{
   const x=await import('xlsx')
   const headers=[...assuranceReportGroups,assuranceReportColumns.map(c=>c.code),assuranceReportColumns.map(c=>c.unit),assuranceReportColumns.map(c=>c.label)]
   const sheet=x.utils.aoa_to_sheet([...headers,...rows.filter(r=>r.submitted_at&&r.report).map(r=>r.report!)])
   sheet['!cols']=assuranceReportColumns.map(()=>({wch:22}))
   const book=x.utils.book_new()
   x.utils.book_append_sheet(book,sheet,'Material Consumption')
   x.writeFile(book,'Service Assurance Material Consumption.xlsx')
  }catch(e){setError((e as Error).message)}
 }
 return <section className="space-y-4" aria-label="Service Assurance audit">
 <div role="tablist" aria-label="Audit filters" className="flex flex-wrap gap-2">{([['all','Total Orders'],['submitted','Submitted'],['unfilled','Not Submitted'],['ont','ONT Replaced'],['mismatches','Material Mismatches'],['po','PO Missing']] as const).map(([key,label])=><Button key={key} role="tab" aria-selected={tab===key} variant={tab===key?'primary':'outline'} onClick={()=>{setTab(key);setPage(0)}}>{label} ({counts[key]})</Button>)}<Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}>Refresh</Button><Button onClick={exportReport} disabled={!rows.some(r=>r.submitted_at)}>Export filtered report</Button></div>
 <div className="flex flex-wrap gap-3"><label>Assigned date from<input type="date" className={field} value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}}/></label><label>Assigned date to<input type="date" className={field} value={to} onChange={e=>{setTo(e.target.value);setPage(0)}}/></label><label className="min-w-64 flex-1">Search<input className={`${field} w-full`} placeholder="Ticket, team, or serial number" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label></div>
 {(error||query.error)&&<p role="alert">{error||query.error?.message}</p>}
 <Table columns={[
  {key:'id',label:'Details',render:(_v:unknown,row:AssuranceAuditRow)=><Button variant="outline" onClick={()=>setSelected(row)}>Inspect</Button>},
  {key:'ticket_number',label:'Ticket No'},{key:'team',label:'Team'},{key:'status',label:'Controller Status'},{key:'resolution',label:'Resolution'},
  {key:'ont_model',label:'New CPE Model'},{key:'new_serial',label:'Controller New CPE SN'},
  {key:'submitted_at',label:'Submission',render:v=>v?'Submitted':'Not Submitted'},{key:'technician_ont',label:'Technician ONT Replaced'},{key:'technician_serial',label:'Technician New ONT SN'},
  {key:'materials',label:'Materials',render:(_v:unknown,r:AssuranceAuditRow)=>r.submitted_at?(r.materials?.map(m=>`${m.name}: ${m.quantity}`).join(', ')||'No materials recorded'):'Awaiting submission'},
  {key:'po_number',label:'PO / Reservation',render:(_v:unknown,r:AssuranceAuditRow)=>String(r.po_number||r.po_status||'')},
  {key:'issues',label:'Audit Status',render:(_v:unknown,r:AssuranceAuditRow)=>r.issues?.join('; ')||(r.submitted_at?'Matched':'Awaiting submission')},
 ]} data={rows.slice(current*50,(current+1)*50)} rowKey="id" isLoading={query.isPending} emptyMessage="No eligible tickets match these filters."/>
 <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={!current} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {pages} · {rows.length} records</span><Button variant="outline" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next</Button></div>
 {selected&&<Modal isOpen onClose={()=>setSelected(null)} title={`Ticket ${selected.ticket_number}`} size="full">
  <p>ONT expected: {selected.ont_replaced?'Yes':'No'} · Reported: {String(selected.technician_ont||'No response')} · PO: {String(selected.po_number||selected.po_status)}</p>
  <p role="status">{selected.issues?.join(' · ')||(selected.submitted_at?'Matched':'Awaiting submission')}</p>
  <Table columns={[{key:'name',label:'Material'},{key:'quantity',label:'Quantity'},{key:'code',label:'Item code'},{key:'unit',label:'Unit'}]} data={selected.materials||[]} rowKey="column"/>
  <details><summary>Controller and Technician source values</summary><pre className="whitespace-pre-wrap">{JSON.stringify({controller:selected.controller_values,technician:selected.response_values},null,2)}</pre></details>
  {selected.report?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{assuranceReportColumns.map(c=><th key={c.column} className="min-w-40 border p-2">{c.column}<br/>{c.code}<br/>{c.unit}<br/>{c.label}</th>)}</tr></thead><tbody><tr>{selected.report.map((v,i)=><td key={i} className="border p-2">{v}</td>)}</tr></tbody></table></div>:<p>No submitted material output.</p>}
 </Modal>}
 </section>
}
