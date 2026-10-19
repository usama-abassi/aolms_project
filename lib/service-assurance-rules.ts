import {responseIdentifiers,serviceAssuranceResponseFields,materialFields,assuranceReportColumns,assuranceMaterialMapping,replacementResolutions} from './service-assurance-fields'

export const normalizeAssurance = (value:unknown) => String(value??'').trim().toLowerCase()
export function needsAssuranceResponse(values:Record<string,string>){
 return normalizeAssurance(values.status)==='resolved'&&replacementResolutions.has(normalizeAssurance(values.resolution))
}
export function hasAssuranceAnswer(values:Record<string,string>){
 return serviceAssuranceResponseFields.some(key=>key!=='Timestamp'&&!Object.hasOwn(responseIdentifiers,key)&&!!values[key]?.trim())
}
export function invalidAssuranceQuantities(values:Record<string,string>){
 return materialFields.filter(key=>values[key]?.trim()&&(!/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(values[key].trim())||!Number.isFinite(Number(values[key]))))
}
export function ontReportColumn(model:string){
 const value=normalizeAssurance(model).replace(/[\s-]/g,'')
 return ({'wifi6':'AF','w6':'AF','h5':'AG','2g':'AH','2gont':'AH'} as Record<string,string>)[value]
}
export function assurancePOLookup(records:Array<{po_number?:unknown;reservation_number?:unknown}>){
 const numbers=[...new Set(records.map(r=>String(r.po_number??'').trim()||String(r.reservation_number??'').trim()).filter(Boolean))]
 return numbers.length===1?{po_number:numbers[0],po_status:'Found'}:{po_number:'',po_status:numbers.length?'PO Ambiguous':'PO Not Found'}
}
export function assuranceMaterialOutput(controller:Record<string,string>,values:Record<string,string>|null,po:string,submittedAt:string|null){
 if(!values)return {report:null,materials:[],issues:[] as string[]}
 const report:Array<string|number>=assuranceReportColumns.map(()=> '')
 const issues:string[]=invalidAssuranceQuantities(values).map(key=>`Invalid quantity: ${key}`)
 const materials:Array<{column:string;name:string;quantity:number;code:string;unit:string}>=[]
 const add=(column:string,quantity:number)=>{
  const index=assuranceReportColumns.findIndex(c=>c.column===column),meta=assuranceReportColumns[index]
  report[index]=quantity
  if(quantity){
   materials.push({column,name:meta.label,quantity,code:meta.code,unit:meta.unit})
   if(!meta.code||meta.code==='None')issues.push(`Report item code missing: ${meta.label}`)
  }
 }
 report[0]=values.Timestamp||submittedAt||''
 report[1]=controller.ticket_number||''
 for(const [column,source] of Object.entries(assuranceMaterialMapping)){
  const quantity=Number(values[serviceAssuranceResponseFields[source]]||0)
  add(column,Number.isFinite(quantity)&&quantity>=0?quantity:0)
 }
 const mapped=new Set(Object.values(assuranceMaterialMapping).map(i=>serviceAssuranceResponseFields[i]))
 for(const key of materialFields)if(!mapped.has(key)&&Number(values[key])>0)issues.push(`No verified report column: ${key} (${values[key]})`)
 const expected=!!controller.new_serial?.trim(),reported=normalizeAssurance(values['ONT Replaced '])==='yes'
 if(expected!==reported)issues.push(expected?'ONT replacement not reported':'ONT reported but Controller AG is empty')
 if(expected||reported){
  if(normalizeAssurance(values['New ONT Serial No '])!==normalizeAssurance(controller.new_serial))issues.push('New ONT serial mismatch')
  if(controller.old_serial?.trim()&&normalizeAssurance(values['OLD ONT Serial No '])!==normalizeAssurance(controller.old_serial))issues.push('Old ONT serial mismatch')
  const column=ontReportColumn(values['Replaced ONT ']||'')
  if(!column)issues.push('ONT model has no verified material column')
  if(controller.ont_model?.trim()&&normalizeAssurance(values['Replaced ONT '])!==normalizeAssurance(controller.ont_model)&&(!column||column!==ontReportColumn(controller.ont_model)))issues.push('ONT model mismatch')
  if(reported&&column)add(column,1)
 }
 report[48]=values['New ONT Serial No ']||''
 report[49]=po
 report[50]=values['Comments and/or questions']||''
 return {report,materials,issues}
}
export type AssuranceAuditRow={id:string;ticket_number:string;team:string;assigned_date:string|null;old_serial:string;new_serial:string;submitted_at:string|null;technician:string;ont_replaced?:boolean;material_mismatch?:boolean;po_status?:string;issues?:string[];report?:Array<string|number>|null;materials?:Array<{column:string;name:string;quantity:number;code:string;unit:string}>;[key:string]:unknown}
export type AssuranceAuditTab='all'|'submitted'|'unfilled'|'ont'|'mismatches'|'po'
export function filterAssuranceAudit(rows:AssuranceAuditRow[],from:string,to:string,search:string,tab:AssuranceAuditTab){
 const term=normalizeAssurance(search)
 const base=rows.filter(r=>(!from||!!r.assigned_date&&r.assigned_date>=from)&&(!to||!!r.assigned_date&&r.assigned_date<=to)&&[r.ticket_number,r.team,r.old_serial,r.new_serial].some(v=>normalizeAssurance(v).includes(term)))
 const matches=(r:AssuranceAuditRow,key:AssuranceAuditTab)=>key==='all'||(key==='submitted'?!!r.submitted_at:key==='unfilled'?!r.submitted_at:key==='ont'?!!r.ont_replaced:key==='mismatches'?(r.material_mismatch??!!r.issues?.length):!!r.ont_replaced&&r.po_status!=='Found')
 const counts=Object.fromEntries((['all','submitted','unfilled','ont','mismatches','po'] as const).map(key=>[key,base.filter(r=>matches(r,key)).length])) as Record<AssuranceAuditTab,number>
 return {counts,rows:base.filter(r=>matches(r,tab))}
}
