import {describe,it,expect} from 'vitest';
import {needsAssuranceResponse,hasAssuranceAnswer,filterAssuranceAudit,type AssuranceAuditRow} from './service-assurance-rules';

describe('Service Assurance replacement detection',()=>{
 const replacement={status:'  ReSoLvEd  ',resolution:' Replaced Faulty ONT ',old_serial:' OLD-001 ',new_serial:' NEW-002 '};
 it('requires resolved status and a verified replacement resolution',()=>{
  expect(needsAssuranceResponse(replacement)).toBe(true);
  expect(replacement.status).toBe('  ReSoLvEd  ');
  for(const patch of [{status:'open'},{status:'closed'},{status:'Resolved_Remotely'},{status:'resolved(SAAS)'},{resolution:'not replaced'},{resolution:'Network reset'}])expect(needsAssuranceResponse({...replacement,...patch})).toBe(false);
  expect(needsAssuranceResponse({status:'resolved',resolution:'Network reset'})).toBe(false);
 });
});
describe('Service Assurance filled / not filled tracking',()=>{
 const row=(id:string,submitted_at:string|null,patch:Partial<AssuranceAuditRow>={}):AssuranceAuditRow=>({id,ticket_number:`00${id}`,team:'Team One',old_serial:`OLD-${id}`,new_serial:`NEW-${id}`,assigned_date:'2026-04-01',submitted_at,technician:'Technician',...patch});
 const rows=[row('1',null),row('2','2026-04-03T10:00:00Z'),row('3',null,{assigned_date:'2026-04-30',team:'Team Two'}),row('4',null,{assigned_date:null})];
 it('does not count identifiers or whitespace as an editable response',()=>{
  expect(hasAssuranceAnswer({'SR / Ticket number':'001','Team Name':'Team','Comments and/or questions':'  '})).toBe(false);
  expect(hasAssuranceAnswer({'Comments and/or questions':'Replaced cord'})).toBe(true);
 });
 it('counts all qualifying rows and filters submitted / unfilled without changing them',()=>{
  expect(filterAssuranceAudit(rows,'','','','all').counts).toMatchObject({all:4,submitted:1,unfilled:3});
  expect(filterAssuranceAudit(rows,'','','','submitted').rows.map(r=>r.id)).toEqual(['2']);
  expect(filterAssuranceAudit(rows,'','','','unfilled').rows.map(r=>r.id)).toEqual(['1','3','4']);
  expect(rows[0].submitted_at).toBeNull();
 });
 it('applies inclusive assigned-date bounds and searches ticket, team and both serials',()=>{
  expect(filterAssuranceAudit(rows,'2026-04-01','2026-04-30','','all').counts.all).toBe(3);
  expect(filterAssuranceAudit(rows,'2026-04-30','2026-04-30','','all').rows.map(r=>r.id)).toEqual(['3']);
  for(const search of ['002','old-2','NEW-2'])expect(filterAssuranceAudit(rows,'','',search,'all').counts).toMatchObject({all:1,submitted:1,unfilled:0});
  expect(filterAssuranceAudit(rows,'','','  team TWO  ','unfilled').rows.map(r=>r.id)).toEqual(['3']);
 });
});
