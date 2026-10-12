'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api, currentUserId, type AuditData, type AuditRow, type FormDataResponse } from '../../assurance/api';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import ServiceAssuranceTasks from '../components/ServiceAssuranceTasks';
import RequestInventory from '../components/RequestInventory';

export default function AssuranceTasks({ todo = false, audit = false, projectId }: { todo?: boolean; audit?: boolean; projectId?:string }) {
  const client=useQueryClient();
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [todo, audit, filter]);
  const user = useQuery({ queryKey: ['session-user-id'], queryFn: currentUserId });
  const tasks = useQuery({
    queryKey: [audit ? 'assurance-audit' : 'assurance-tasks', user.data, projectId], enabled: !!user.data,
    queryFn: () => api<AuditData>(`/assurance-submissions/${audit ? 'audit' : 'tasks'}${audit&&projectId?'?project_id='+encodeURIComponent(projectId):''}`), refetchInterval: 60000,
  });
  if (user.isPending || tasks.isPending) return <p>Loading tasks...</p>;
  if (user.error || tasks.error) return <p role="alert">{user.error?.message || tasks.error?.message}</p>;
  const rows = (tasks.data?.rows || []).filter(r => audit
    ? filter === 'all' || (filter === 'completed' ? r.completed : !r.completed)
    : todo ? r.active_assignment && !r.completed : r.completed);
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const visibleRows = rows.slice(currentPage * 20, (currentPage + 1) * 20);
  const action = (r: AuditRow) => audit
    ? <Button variant="outline" disabled={!r.submission_technician_id} onClick={() => setSelected(r)}>View</Button>
    : <Link className={`task-action ${r.can_edit ? '' : 'task-action--view'}`} aria-label={`${r.can_edit ? 'Edit' : 'View'} ${r.ticket_number}`} href={`/technician/assurance-form/${r.id}`}>{r.can_edit ? 'Edit' : 'View'}</Link>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-h2 font-semibold">{audit ? 'Audit' : todo ? 'To-Do' : 'Submitted Orders'}</h1>
      <div className="flex flex-wrap items-start gap-2">{todo&&!audit&&<RequestInventory userId={user.data!}/>}<Button variant="outline" onClick={() => { tasks.refetch(); if (!audit) void client.invalidateQueries({queryKey:['service-assurance-tasks',user.data]}); }}>Refresh</Button></div></div>
    {audit && <div className="flex flex-wrap gap-3">{(['all', 'completed', 'pending'] as const).map(f =>
      <Button key={f} variant={filter === f ? 'primary' : 'outline'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
        {f === 'all' ? 'All' : f === 'completed' ? `Completed: ${tasks.data?.counts.completed || 0}` : `To be completed: ${tasks.data?.counts.pending || 0}`}
      </Button>)}</div>}
    {!audit && !todo && <p className="text-sm text-neutral-500">Service Delivery forms can be edited for 24 hours after their original submission. After that, they remain available to view.</p>}
    <section aria-label="Service Delivery tasks" className="md:hidden">
      <h2 className="mb-3 text-lg font-semibold">Service Delivery <span className="text-sm font-normal text-neutral-500">({rows.length})</span></h2>
      {visibleRows.map(r => <article key={`${r.id}:${r.submission_technician_id || ''}`} className="task-card">
        <div className="mb-4 flex items-start gap-3">{action(r)}<div className="min-w-0"><h3 className="font-semibold">{r.ticket_number}</h3><p className="text-sm text-neutral-500">{r.circuit || 'No circuit'}</p></div></div>
        <dl><div><dt>Exchange</dt><dd>{r.exchange || '—'}</dd></div><div><dt>Work date</dt><dd>{r.work_date?.slice(0,10) || '—'}</dd></div>
          <div><dt>Status</dt><dd>{r.status}</dd></div><div><dt>Completion</dt><dd>{r.completed ? 'Submitted' : 'To be completed'}</dd></div>
          {audit && <div className="col-span-2"><dt>Technician</dt><dd>{r.technician_name || 'Unassigned'}</dd></div>}
          {r.submitted_at && <div className="col-span-2"><dt>Submitted</dt><dd>{new Date(r.submitted_at).toLocaleString()}</dd></div>}
        </dl>
        {r.completed && <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-500 dark:border-neutral-700">{r.can_edit && r.edit_deadline ? `Edit until ${new Date(r.edit_deadline).toLocaleString()}` : 'View only — editing is closed'}</p>}
      </article>)}
      {!rows.length && <Card>No matching Service Delivery tasks.</Card>}
    </section>
    <Card title="Service Delivery" padding="none" className="hidden overflow-x-auto md:block">
      <table className="w-full text-left text-sm"><thead className="bg-neutral-100 dark:bg-neutral-800"><tr>
        {['Action', 'Ticket / Circuit', 'Work date', 'Exchange / Service', 'Status', 'Technician', 'Completion', 'Submitted', 'Edit availability'].map(h => <th scope="col" className={`whitespace-nowrap p-3 ${h === 'Action' ? 'sticky left-0 z-10 bg-neutral-100 dark:bg-neutral-800' : ''}`} key={h}>{h}</th>)}
      </tr></thead><tbody>{visibleRows.map(r => <tr key={`${r.id}:${r.submission_technician_id || ''}`} className="border-t border-neutral-200 dark:border-neutral-700">
        <td className="sticky left-0 z-10 bg-white p-3 dark:bg-neutral-900">{action(r)}</td>
        <td className="p-3">{r.ticket_number}<div className="text-xs text-neutral-500">{r.circuit}</div></td>
        <td className="p-3">{r.work_date?.slice(0, 10)}</td><td className="p-3">{r.exchange}<div className="text-xs">{r.service_type}</div></td>
        <td className="p-3">{r.status}{!r.active_assignment && <div className="text-xs text-neutral-500">Historical assignment</div>}</td>
        <td className="p-3">{r.technician_name || 'Unassigned'}</td><td className="p-3">{r.completed ? 'Completed' : 'To be completed'}</td>
        <td className="p-3">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
        <td className="p-3">{!r.active_assignment ? 'View only' : r.can_edit ? (r.completed ? 'Edit available' : 'To-Do') : 'Edit expired'}
          {r.edit_deadline && <div className="text-xs">Until {new Date(r.edit_deadline).toLocaleString()}</div>}</td>
      </tr>)}{!rows.length && <tr><td className="p-8" colSpan={9}>No matching Service Delivery tasks.</td></tr>}</tbody></table>
    </Card>
    {!audit && <ServiceAssuranceTasks key={`${user.data}:${todo}`} userId={user.data!} todo={todo}/>}
    {pages > 1 && <nav aria-label="Task pages" className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-sm">Page {currentPage + 1} of {pages}</span><Button variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}
    {selected && <Modal isOpen onClose={() => setSelected(null)} title={`Audit: ${selected.ticket_number}`} size="lg"><AuditDetails key={`${selected.id}:${selected.submission_technician_id}`} row={selected} /></Modal>}
  </div>;
}

function AuditDetails({ row }: { row: AuditRow }) {
  const details = useQuery({ queryKey: ['audit-details', row.id, row.submission_technician_id],
    queryFn: () => api<FormDataResponse>(`/assurance-submissions/${row.id}?technician_id=${row.submission_technician_id}`) });
  if (details.isPending) return <p>Loading submission...</p>;
  if (details.error) return <p role="alert">{details.error.message}</p>;
  if (!details.data?.submission) return <p>This technician has not saved a form yet.</p>;
  return <dl className="grid gap-4 sm:grid-cols-2">{Object.entries(details.data.submission)
    .filter(([key]) => !['id', 'ticket_id', 'technician_id', 'last_mutation_id', 'version', 'project_id'].includes(key))
    .map(([key, value]) => <div key={key}><dt className="text-xs capitalize text-neutral-500">{key.replaceAll('_', ' ')}</dt><dd className="whitespace-pre-wrap break-words">{value == null ? '—' : String(value)}</dd></div>)}</dl>;
}
