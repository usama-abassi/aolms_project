import {describe,it,expect,vi} from 'vitest';
import {ServiceDelivery} from './service';
import {controllerFields} from './model';
import {canEdit} from '../assurance-submissions/assurance-submissions.service';
const id='11111111-1111-4111-8111-111111111111',tech='22222222-2222-4222-8222-222222222222',mutation='33333333-3333-4333-8333-333333333333';
const actor={userId:tech,role:'technician'},manager={userId:tech,role:'controller'};
const ticket={id,ticket_number:'123',technician_id:tech,status:'Resolved',version:1,spreadsheet_fields:{unrelated:'preserve',delivery:{actioned:'Delivered',order_type:'New',connection_type:'Home Connect'}}};
function setup(t:any=ticket,s:any=null){
 const query=vi.fn(async(sql:string,_args?:any[])=>{
  if(sql.startsWith('SELECT * FROM assurance_tickets'))return t?[t]:[];
  if(sql.startsWith('SELECT * FROM assurance_submissions'))return s?[s]:[];
  if(sql.includes('SELECT clock_timestamp()'))return [{now:new Date('2026-10-14T00:00:00Z')}];
  if(sql.startsWith('UPDATE assurance_tickets'))return [{...t,version:2}];
  if(sql.startsWith('UPDATE assurance_submissions')||sql.startsWith('INSERT INTO assurance_submissions'))return [{id,version:2,submitted_at:s?.submitted_at}];
  if(sql.includes('SELECT id FROM projects')||sql.includes('SELECT id FROM profiles'))return [{id}];
  return [];
 });
 const db:any={query,transaction:async(fn:any)=>fn(db)};return {service:new ServiceDelivery(db),query};
}
const values={B:'test@example.com',C:'Team',D:'123',E:'New',F:'Package',G:'Home Connect',BN:'Customer Existing ONT'};
const payload={values,base_version:null,mutation_id:mutation,intent:'draft'};
describe('Service Delivery backend authorization and concurrency',()=>{
 it('rejects a non-Delivered order even when its legacy status is Resolved',async()=>{const t={...ticket,spreadsheet_fields:{delivery:{actioned:'Rejected'}}};const {service,query}=setup(t);await expect(service.saveForm(id,payload,actor)).rejects.toThrow('Assignment changed');expect(query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);expect(canEdit(t,null,actor)).toBe(false);});
 it('rejects another technician',async()=>{await expect(setup().service.saveForm(id,payload,{...actor,userId:id})).rejects.toThrow('Assignment changed');});
 it('rejects missing required submission fields',async()=>{await expect(setup().service.saveForm(id,{...payload,intent:'submit',values:{D:'123'}},actor)).rejects.toThrow('required');});
 it('rejects negative material quantities',async()=>{await expect(setup().service.saveForm(id,{...payload,values:{...values,H:'-1'}},actor)).rejects.toThrow('nonnegative');});
 it('rejects a different order number without changing the linked order',async()=>{await expect(setup().service.saveForm(id,{...payload,values:{...values,D:'999'}},actor)).rejects.toThrow('Order Number must match');});
 it('saves drafts without setting a submission timestamp',async()=>{const {service,query}=setup();await service.saveForm(id,payload,actor);const call=query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO assurance_submissions'));expect(call?.[1]).toContain('draft');expect(call?.[1]?.filter(v=>v===null)).toHaveLength(2);});
 it('returns the existing result on an identical mutation retry',async()=>{const saved={id,version:2,last_mutation_id:mutation};const {service,query}=setup(ticket,saved);expect(await service.saveForm(id,payload,actor)).toBe(saved);expect(query.mock.calls.some(([sql])=>sql.startsWith('UPDATE')||sql.startsWith('INSERT'))).toBe(false);});
 it('rejects concurrent stale saves',async()=>{await expect(setup(ticket,{id,version:4}).service.saveForm(id,payload,actor)).rejects.toThrow('Form changed');});
 it('preserves the original submission timestamp within its editing window',async()=>{const original=new Date(Date.now()-1000).toISOString();const {service,query}=setup(ticket,{id,version:1,submitted_at:original});await service.saveForm(id,{...payload,base_version:1,intent:'submit'},actor);expect(query.mock.calls.find(([sql])=>sql.startsWith('UPDATE assurance_submissions'))?.[1]).toContain(original);});
 it('enforces the original 24-hour deadline',async()=>{await expect(setup(ticket,{id,version:1,submitted_at:new Date(Date.now()-86400001).toISOString()}).service.saveForm(id,{...payload,base_version:1},actor)).rejects.toThrow('editing window expired');});
 it('prevents technicians from correcting audit values',async()=>{await expect(setup().service.correct(id,{source:'controller',field:'order_type',value:'New'},actor)).rejects.toThrow('Controller access');});
 it('allows administrative corrections after the editing window and logs previous/current values',async()=>{const old={id,version:1,submitted_at:'2020-01-01',response_order_type:'Old',delivery_fields:{E:'Old',H:'2'}};const {service,query}=setup(ticket,old);await service.correct(id,{source:'technician',field:'order_type',previous:'Old',value:'New',submission_id:id},manager);const update=query.mock.calls.find(([sql])=>sql.startsWith('UPDATE assurance_submissions'));expect(update?.[0]).not.toContain('submitted_at=');expect(JSON.parse(update![1]![1]).H).toBe('2');const log=query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO audit_logs'));expect(JSON.parse(log![1]![4]).value).toBe('Old');expect(JSON.parse(log![1]![5]).value).toBe('New');});
 it('rejects a correction based on an obsolete current value',async()=>{await expect(setup().service.correct(id,{source:'controller',field:'order_type',previous:'Old',value:'External'},manager)).rejects.toThrow('Value changed');});
 it('preserves unrelated Controller fields during a correction',async()=>{const {service,query}=setup();await service.correct(id,{source:'controller',field:'order_type',previous:'New',value:'External'},manager);const update=query.mock.calls.find(([sql])=>sql.startsWith('UPDATE assurance_tickets'));expect(JSON.parse(update![1]![1])).toMatchObject({unrelated:'preserve',delivery:{connection_type:'Home Connect',order_type:'External'}});});
 it('validates the Team against the database',async()=>{const {service,query}=setup();query.mockImplementation(async(sql:string)=>sql.includes('SELECT id FROM projects')?[{id}]:[]);const rowValues=Object.fromEntries(controllerFields.map(f=>[f.key,'']));Object.assign(rowValues,{work_date:'2026-10-14',ticket_number:'123',actioned:'Delivered',technician_id:tech});await expect(service.saveOrder({id,project_id:id,mutation_id:mutation,base_version:null,values:rowValues},manager)).rejects.toThrow('active Technician');});
});
