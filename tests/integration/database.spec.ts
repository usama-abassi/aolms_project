import {describe,it,expect,afterAll} from 'vitest';
import {db,getPool} from '@/lib/db';
import {MaterialInventory} from '@/lib/services/material-inventory';
import {randomUUID} from 'node:crypto';
import {DeliveryGridService} from '@/lib/services/assurance-tickets/delivery-grid.service';
import {getProjectsService,getOperationsDatabase,getProjectAuditService,getStaffService,getServiceDeliveryService} from '@/lib/services/registry';
describe('Existing Supabase database (read only)',()=>{
 it('Phase 1 grid persists exact drafts and promotes safely without changing old records on invalid edits',async()=>{
  await expect(db.transaction(async tx=>{
   const service=new DeliveryGridService({query:tx.query.bind(tx),transaction:async fn=>fn(tx)} as typeof db);
   const [project]=await tx.query("SELECT id FROM projects WHERE code='SERVICE_ASSURANCE'");
   const [profile]=await tx.query("SELECT id FROM profiles WHERE role='controller' AND is_active LIMIT 1");
   const actor={userId:profile.id,role:'controller'},id=randomUUID();
   const raw={ticket_number:'00'+id,mobile:'001234',resolution_description:'  first\nsecond  ',work_date:'bad date',status:'Open'};
   let payload={id,project_id:project.id,values:raw,mutation_id:randomUUID(),draft_version:0,base_version:null as number|null};
   const first=await service.save(payload,actor);
   expect(first.draft.state).toBe('draft');expect(first.draft.raw_values.resolution_description).toBe(raw.resolution_description);
   expect(await tx.query('SELECT id FROM assurance_tickets WHERE id=$1',[id])).toHaveLength(0);
   const retry=await service.save(payload,actor);expect(retry.draft.version).toBe(first.draft.version);
   payload={...payload,values:{...raw,work_date:'02/10/2026'},mutation_id:randomUUID(),draft_version:first.draft.version};
   const second=await service.save(payload,actor);
   expect(second.draft.errors).toEqual({});expect(second.draft.state).toBe('record');expect(second.record.ticket_number).toBe(raw.ticket_number);
   expect(second.record.controller_id).toBe(actor.userId);expect(second.draft.raw_values.work_date).toBe('02/10/2026');
   const [other]=await tx.query("SELECT id FROM profiles WHERE role IN ('admin','controller') AND id<>$1 LIMIT 1",[actor.userId]);
   if(other)expect((await service.list(project.id,{userId:other.id,role:'controller'})).find(d=>d.id===id)?.raw_values.work_date).toBe('02/10/2026');
   await expect(service.save({...payload,mutation_id:randomUUID()},actor)).rejects.toThrow('another tab');
   const third=await service.save({...payload,values:{...raw,work_date:'still invalid'},draft_version:second.draft.version,base_version:second.record.version,mutation_id:randomUUID()},actor);
   expect(third.draft.state).toBe('draft');expect((await tx.query('SELECT version FROM assurance_tickets WHERE id=$1',[id]))[0].version).toBe(second.record.version);
   const fourth=await service.save({...payload,values:{...raw,work_date:'02/10/2026',creation_datetime:'02/10/2026 12:00',close_datetime:'02/10/2026 15:00',controller_id:randomUUID(),sla_from_creation:'900'},draft_version:third.draft.version,base_version:second.record.version,mutation_id:randomUUID()},actor);
   expect(fourth.draft.state).toBe('record');expect(Number(fourth.record.sla_from_creation)).toBe(0.125);expect(fourth.record.controller_id).toBe(actor.userId);
   await tx.query('UPDATE assurance_tickets SET version=version+1 WHERE id=$1',[id]);
   const conflict=await service.save({...payload,draft_version:fourth.draft.version,base_version:fourth.record.version,mutation_id:randomUUID()},actor);
   expect(conflict.draft.errors._row).toContain('changed elsewhere');expect(conflict.draft.raw_values.work_date).toBe('02/10/2026');
   throw new Error('grid test rollback');
  })).rejects.toThrow('grid test rollback');
 },60000);
 afterAll(async()=>{await getPool().end();});
 it('reads existing projects in the saved display sequence',async()=>{
  const service=await getProjectsService().findAll();
  const sql=await db.query('SELECT id FROM projects ORDER BY display_order,name,id');
  expect(service.map(p=>p.id)).toEqual(sql.map(p=>p.id));
 });
 it('rebuilds database-backed operational pages and audit after a cold start',async()=>{
  const [project]=await db.query("SELECT id FROM projects WHERE code='SERVICE_ASSURANCE'");
  const audit=await getProjectAuditService().run(project.id);
  const [count]=await db.query('SELECT count(*)::int n FROM assurance_tickets WHERE project_id=$1',[project.id]);
  expect(audit.verification).toHaveLength(count.n);
  expect((await getStaffService().getStats()).total).toBeGreaterThan(0);
  expect((await getServiceDeliveryService().getStatus()).responseRecordCount).toBeGreaterThan(0);
  const records=await getOperationsDatabase().delivery();
  expect(records.length).toBeGreaterThan(0);
 },60000);
 it('supports atomic multi-query transactions without persisting a test mutation',async()=>{
  await expect(db.transaction(async tx=>{await tx.query('SELECT 1');throw new Error('rollback probe')})).rejects.toThrow('rollback probe');
  expect((await db.query('SELECT 1 AS value'))[0].value).toBe(1);
 });
 it('carries inventory across months, deduplicates receipts and protects dated balances (rolled back)',async()=>{
  await expect(db.transaction(async tx=>{
   const service=new MaterialInventory({query:tx.query.bind(tx),transaction:async fn=>fn(tx)} as typeof db);
   const [project]=await tx.query("SELECT id FROM projects WHERE code='SERVICE_ASSURANCE'");
   const actor=randomUUID();
   const material=await service.create(project.id,{kind:'material',name:'Inventory rollback test',unit:'Meter'},actor);
   const add=(kind:string,date:string,quantity:number)=>({kind,date,quantity,material_id:material.id,mutation_id:randomUUID()});
   await service.create(project.id,add('opening','2026-07-01',100.125),actor);
   const receipt=add('received','2026-07-31',20);
   await service.create(project.id,receipt,actor);await service.create(project.id,receipt,actor);
   await service.create(project.id,add('faulty','2026-08-01',10),actor);
   let report=await service.list(project.id,'2026-07');
   expect(report.rows.find(r=>r.id===material.id)).toMatchObject({opening:100.125,received:20,used:0,faulty:0,remaining:120.125});
   report=await service.list(project.id,'2026-09');
   expect(report.rows.find(r=>r.id===material.id)).toMatchObject({opening:110.125,received:0,remaining:110.125});
   await expect(service.create(project.id,add('faulty','2026-07-15',115),actor)).rejects.toThrow('exceeds');
   await expect(service.create(project.id,add('received','2026-06-30',1),actor)).rejects.toThrow('precede');
   await expect(service.create(project.id,add('opening','2026-09-01',1),actor)).rejects.toThrow('first entry');
   await service.create(project.id,add('received','2026-10-01',5),actor);
   report=await service.list(project.id,'2026-09');
   expect(report.rows.find(r=>r.id===material.id).remaining).toBe(110.125);
   throw new Error('inventory rollback complete');
  })).rejects.toThrow('inventory rollback complete');
 },30000);
});
