import {responseIdentifiers,serviceAssuranceResponseFields} from './service-assurance-fields';
export function needsAssuranceResponse(values:Record<string,string>){
 return values.status?.trim().toLowerCase()==='resolved'&&!!values.old_serial?.trim()&&!!values.new_serial?.trim();
}
export function hasAssuranceAnswer(values:Record<string,string>){
 return serviceAssuranceResponseFields.some(key=>!Object.hasOwn(responseIdentifiers,key)&&!!values[key]?.trim());
}
export type AssuranceAuditRow={id:string;ticket_number:string;team:string;assigned_date:string|null;old_serial:string;new_serial:string;submitted_at:string|null;technician:string;[key:string]:unknown};
export function filterAssuranceAudit(rows:AssuranceAuditRow[],from:string,to:string,search:string,tab:'all'|'submitted'|'unfilled'){
 const term=search.trim().toLowerCase();
 const base=rows.filter(r=>(!from||!!r.assigned_date&&r.assigned_date>=from)&&(!to||!!r.assigned_date&&r.assigned_date<=to)&&[r.ticket_number,r.team,r.old_serial,r.new_serial].some(v=>v.toLowerCase().includes(term)));
 const submitted=base.filter(r=>!!r.submitted_at).length;
 return {counts:{all:base.length,submitted,unfilled:base.length-submitted},rows:base.filter(r=>tab==='all'||(tab==='submitted'?!!r.submitted_at:!r.submitted_at))};
}
