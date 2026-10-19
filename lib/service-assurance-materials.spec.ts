import {describe,it,expect} from 'vitest'
import {needsAssuranceResponse,assuranceMaterialOutput,assurancePOLookup,invalidAssuranceQuantities,filterAssuranceAudit,type AssuranceAuditRow} from './service-assurance-rules'
import {serviceAssuranceFields,serviceAssuranceResponseFields,assuranceReportColumns} from './service-assurance-fields'

describe('October Service Assurance workbook mapping',()=>{
 it('preserves A:AO and A:AZ positions and exact technician fields',()=>{
  expect(serviceAssuranceFields).toHaveLength(41)
  for(const [i,label] of [[1,'Team'],[3,'Ticket No'],[23,'Status'],[25,'Resolution (List)'],[29,'Replaced CPE Model'],[30,'Replaced CPE SN'],[31,'New CPE Model'],[32,'New CPE SN']] as const)expect(serviceAssuranceFields[i].label).toBe(label)
  expect(serviceAssuranceResponseFields).toHaveLength(30)
  expect(assuranceReportColumns).toHaveLength(52)
  expect(assuranceReportColumns[48].column).toBe('AW')
  expect(assuranceReportColumns[49].column).toBe('AX')
 })
 it('assigns verified small-material replacements without requiring ONT serials',()=>{
  for(const resolution of [' Patch Cord Damaged - Replaced ','POWER ADAPTOR REPLACED','Replaced OLD ONT'])expect(needsAssuranceResponse({status:' ReSoLvEd ',resolution})).toBe(true)
  for(const status of ['Hold','Pending','Appointment','Monitoring','Rejected'])expect(needsAssuranceResponse({status,resolution:'Replaced Faulty ONT'})).toBe(false)
  expect(needsAssuranceResponse({status:'Resolved',resolution:'Not Replaced'})).toBe(false)
 })
 it('maps physical quantities once and keeps identifiers as strings',()=>{
  const result=assuranceMaterialOutput({ticket_number:'000123',new_serial:''},{'ONT Replaced ':'No','Fiber Termination Box (FTB)':'2','Quick SC/UPC Connector Blue ':'3','Quick SC/APC Connector Green':'4','Patch Chord':'1.5'},'',null)
  expect(result.report?.[1]).toBe('000123')
  expect(result.report?.[13]).toBe(2)
  expect(result.report?.[20]).toBe('')
  expect(result.report?.[16]).toBe(3)
  expect(result.report?.[25]).toBe(4)
  expect(result.materials.reduce((sum,m)=>sum+m.quantity,0)).toBe(10.5)
  expect(result.issues).toEqual(['Report item code missing: Quick SC/UPC Connector Green for GPON'])
 })
 it('routes ONT models separately and checks serials, models, and AG',()=>{
  for(const [model,index] of [['WiFi-6',31],['H-5',32],['2G',33]] as const){
   const result=assuranceMaterialOutput({new_serial:' SN001 ',old_serial:'OLD',ont_model:model},{'ONT Replaced ':'Yes','Replaced ONT ':model,'New ONT Serial No ':'sn001','OLD ONT Serial No ':' old '},'00099',null)
   expect(result.report?.[index]).toBe(1)
   expect(result.report?.[49]).toBe('00099')
   expect(result.issues).toEqual(model==='H-5'?['Report item code missing: ONT - Bnet H5']:[])
  }
  expect(assuranceMaterialOutput({new_serial:''},{'ONT Replaced ':'Yes','Replaced ONT ':'FTTR Master ONT'},'',null).issues).toContain('ONT reported but Controller AG is empty')
  expect(assuranceMaterialOutput({new_serial:'NEW',old_serial:'OLD',ont_model:'H-5'},{'ONT Replaced ':'Yes','New ONT Serial No ':'WRONG','OLD ONT Serial No ':'BAD','Replaced ONT ':'WiFi-6'},'',null).issues).toEqual(expect.arrayContaining(['New ONT serial mismatch','Old ONT serial mismatch','ONT model mismatch']))
 })
 it('validates quantities without altering blanks and flags unmapped materials',()=>{
  const values={'Patch Chord':'','Pigtail':'-1','DRAWROPE':'NaN','FIBER CAPPING ':'Infinity'}
  expect(invalidAssuranceQuantities(values)).toEqual(['Pigtail','DRAWROPE','FIBER CAPPING '])
  expect(values['Patch Chord']).toBe('')
  expect(assuranceMaterialOutput({}, {'ONT  Power Adaptor':'1'},'',null).issues[0]).toContain('No verified report column')
  expect(assuranceMaterialOutput({},null,'',null).report).toBeNull()
 })
 it('returns actual PO strings, handles reservations and flags conflicting records',()=>{
  expect(assurancePOLookup([{po_number:' 00099 ',reservation_number:'other'}])).toEqual({po_number:'00099',po_status:'Found'})
  expect(assurancePOLookup([{reservation_number:'001'}]).po_number).toBe('001')
  expect(assurancePOLookup([]).po_status).toBe('PO Not Found')
  expect(assurancePOLookup([{po_number:'1'},{po_number:'2'}]).po_status).toBe('PO Ambiguous')
  expect(assurancePOLookup([{po_number:'1'},{po_number:'1'}]).po_status).toBe('Found')
 })
 it('counts replacements from AG independently from missing submissions',()=>{
  const base={team:'Team',assigned_date:null,old_serial:'',technician:''}
  const rows:AssuranceAuditRow[]=[{...base,id:'1',ticket_number:'1',new_serial:'SN',ont_replaced:true,submitted_at:null,po_status:'PO Not Found'}, {...base,id:'2',ticket_number:'2',new_serial:'',ont_replaced:false,submitted_at:'now',issues:['Mismatch']}]
  expect(filterAssuranceAudit(rows,'','','','all').counts).toEqual({all:2,submitted:1,unfilled:1,ont:1,mismatches:1,po:1})
  expect(filterAssuranceAudit(rows,'','','','po').rows.map(r=>r.id)).toEqual(['1'])
  expect(filterAssuranceAudit(rows,'','','','mismatches').rows.map(r=>r.id)).toEqual(['2'])
 })
})
