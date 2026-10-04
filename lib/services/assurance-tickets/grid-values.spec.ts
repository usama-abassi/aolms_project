import {describe,it,expect} from 'vitest';
import {gridDate,normalizeGrid} from './grid-values';
describe('Phase 1 grid normalization',()=>{
 it('recognizes explicit dates and Bahrain times without changing input text',()=>{
  expect(gridDate(' 02/10/2026 ',false)).toBe('2026-10-02');
  expect(gridDate('02/10/2026 15:30:00',true)).toBe('2026-10-02T12:30:00.000Z');
  expect(gridDate('2026-10-02T15:30:12.123+03:00',true)).toBe('2026-10-02T12:30:12.123Z');
  for(const date of ['31/02/2026','2026-02-29','garbage','2026-10-02 25:10'])expect(gridDate(date,true)).toBeNull();
 });
 it('keeps exact raw text separate from matched operational values',()=>{
  const raw={work_date:'02/10/2026',ticket_number:'000001',status:' resolved ',technician_id:' Team One ',mobile:'0012345',resolution_description:'  first\nsecond  '};
  const before=JSON.stringify(raw),result=normalizeGrid(raw,[{id:'tech',full_name:'Team One'}]);
  expect(JSON.stringify(raw)).toBe(before);expect(result.errors).toEqual({});
  expect(result.values).toMatchObject({work_date:'2026-10-02',status:'Resolved',technician_id:'tech',ticket_number:'000001',mobile:'0012345'});
 });
 it('rejects ambiguous teams, invalid statuses, missing required fields and reversed SLA dates',()=>{
  const result=normalizeGrid({technician_id:'Team',status:'nonsense',creation_datetime:'2026-10-03 14:00',close_datetime:'2026-10-02 14:00'},[{id:'a',full_name:'Team'},{id:'b',full_name:'Team'}]);
  expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['work_date','ticket_number','status','technician_id','close_datetime']));
 });
 it('does not allow typed values to override automatic fields',()=>{
  const result=normalizeGrid({controller_id:'hacked',sla_from_creation:'900',kpi_status:'Changed'},[],{kpi_status:'Within KPI'});
  expect(result.values.controller_id).toBeUndefined();expect(result.values.sla_from_creation).toBeUndefined();expect(result.values.kpi_status).toBe('Within KPI');
 });
});
