import 'server-only';
import {Database} from '@/lib/db';
import {uuid} from '@/lib/api';
import {type Actor} from '@/lib/auth';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@/lib/http';
import {serviceAssuranceFields,serviceAssuranceResponseFields} from '@/lib/service-assurance-fields';
import {needsAssuranceResponse,hasAssuranceAnswer,invalidAssuranceQuantities,assurancePOLookup,assuranceMaterialOutput} from '@/lib/service-assurance-rules'
import {gridDate} from './assurance-tickets/grid-values';

function textValues(input:unknown,keys:string[]){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Text values are required');
 const values:Record<string,string>={};
 for(const key of keys){const value=(input as Record<string,unknown>)[key]??'';if(typeof value!=='string'||value.length>20000)throw new BadRequestException(`${key} must be text of at most 20000 characters`);values[key]=value;}
 return values;
}
function record(row:any){return {...row.raw_values,id:row.id,project_id:row.project_id,version:row.version,technician_id:row.technician_id,spreadsheet_fields:{}};}
export class ServiceAssurance{
 constructor(private db:Database){}
 private async project(id:string,db=this.db){
  // Stored project codes predate the display-name swap.
  const [project]=await db.query("SELECT id FROM projects WHERE id=$1 AND code='SERVICE_DELIVERY'",[uuid(id)]);
  if(!project)throw new BadRequestException('Select the Service Assurance project');
 }
 async metadata(){return {fields:serviceAssuranceFields,technicians:await this.db.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active ORDER BY full_name,id")};}
 async list(projectId:string){await this.project(projectId);return (await this.db.query('SELECT * FROM service_assurance_rows WHERE project_id=$1 ORDER BY created_at,id',[projectId])).map(record);}
 async save(body:any,actor:Actor){
  const id=uuid(body?.id),projectId=uuid(body?.project_id),mutation=uuid(body?.mutation_id);
  if(body.base_version!==null&&(!Number.isInteger(body.base_version)||body.base_version<1))throw new BadRequestException('Record version is required');
  const values=textValues(body.values,serviceAssuranceFields.map(f=>f.key));
  return this.db.transaction(async tx=>{
   await this.project(projectId,tx)
   await tx.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[projectId])
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
   const [old]=await tx.query('SELECT * FROM service_assurance_rows WHERE id=$1 FOR UPDATE',[id]);
   if(old&&old.project_id!==projectId)throw new BadRequestException('Row belongs to another project');
   const result=(row:any)=>({record:record(row),draft:{id,user_id:actor.userId,project_id:projectId,raw_values:row.raw_values,errors:{},version:row.version,record_version:row.version,state:'record',mutation_id:row.mutation_id}});
   if(old?.mutation_id===mutation){
    if(old.updated_by!==actor.userId||serviceAssuranceFields.some(f=>old.raw_values[f.key]!==values[f.key]))throw new ConflictException('Submission ID has already been used');
    return result(old);
   }
   if((old?.version??null)!==body.base_version)throw new ConflictException('This row changed elsewhere. Review the latest record before submitting again.');
   const technician=values.team?uuid(values.team):null;
   if(technician&&technician!==old?.technician_id){const [team]=await tx.query("SELECT id FROM profiles WHERE id=$1 AND role='technician' AND is_active",[technician]);if(!team)throw new BadRequestException('Select an active Team');}
   const [row]=await tx.query(`INSERT INTO service_assurance_rows(id,project_id,technician_id,raw_values,mutation_id,updated_by,created_at)
    VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET technician_id=EXCLUDED.technician_id,raw_values=EXCLUDED.raw_values,
    mutation_id=EXCLUDED.mutation_id,updated_by=EXCLUDED.updated_by,version=service_assurance_rows.version+1,updated_at=clock_timestamp() RETURNING *`,[id,projectId,technician,JSON.stringify({...old?.raw_values,...values}),mutation,actor.userId]);
   await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)',[actor.userId,'service_assurance_rows',id,old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(row)]);
   return result(row);
  });
 }
 // Creation order determines the latest historical row, before eligibility or team filtering.
 private async authoritative(projectId:string|null,db=this.db){
  return db.query(`SELECT r.*,p.full_name AS team,a.submitted_values AS response_values,a.submitted_at,a.submitted_by AS responder_id,s.raw_values AS draft_values,s.technician_id AS draft_responder_id,s.version AS response_version,t.full_name AS responder
   FROM (SELECT DISTINCT ON (project_id,btrim(raw_values->>'ticket_number')) * FROM service_assurance_rows
    WHERE ($1::uuid IS NULL OR project_id=$1) AND btrim(coalesce(raw_values->>'ticket_number',''))<>''
    ORDER BY project_id,btrim(raw_values->>'ticket_number'),created_at DESC,id DESC) r
   JOIN projects pr ON pr.id=r.project_id AND pr.code='SERVICE_DELIVERY'
   LEFT JOIN profiles p ON p.id=r.technician_id
   LEFT JOIN LATERAL (SELECT s.* FROM service_assurance_responses s JOIN service_assurance_rows source ON source.id=s.row_id
    WHERE source.project_id=r.project_id AND s.ticket_number=btrim(r.raw_values->>'ticket_number')
    ORDER BY s.updated_at DESC,s.row_id DESC LIMIT 1) s ON true
   LEFT JOIN LATERAL (SELECT a.* FROM service_assurance_responses a JOIN service_assurance_rows source ON source.id=a.row_id
    WHERE source.project_id=r.project_id AND a.ticket_number=btrim(r.raw_values->>'ticket_number') AND a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC,a.row_id DESC LIMIT 1) a ON true
   LEFT JOIN profiles t ON t.id=a.submitted_by`,[projectId])
 }
 async tasks(actor:Actor){
  const rows=await this.authoritative(null)
  return rows.filter(r=>r.technician_id===actor.userId&&needsAssuranceResponse(r.raw_values)).map(r=>({...record(r),team_name:r.team||'',submitted_at:r.submitted_at}))
 }
 async audit(projectId:string){
  await this.project(projectId)
  const rows=await this.authoritative(projectId)
  const serials=[...new Set(rows.map(r=>String(r.raw_values.new_serial||'').trim().toLowerCase()).filter(Boolean))]
  const equipment=serials.length?await this.db.query("SELECT data FROM equipment_records WHERE kind='ont' AND lower(btrim(data->>'serial_number'))=ANY($1::text[])",[serials]):[]
  return rows.filter(r=>r.technician_id&&needsAssuranceResponse(r.raw_values)).map(r=>{
   const v=r.raw_values,serial=String(v.new_serial||'').trim().toLowerCase()
   const po=serial?assurancePOLookup(equipment.filter(e=>String(e.data.serial_number||'').trim().toLowerCase()===serial).map(e=>e.data)):{po_number:'',po_status:'Not required'}
   const output=assuranceMaterialOutput(v,r.submitted_at?r.response_values:null,po.po_number,r.submitted_at)
   if(r.submitted_at&&!Object.hasOwn(r.response_values||{},'SR / Ticket number'))output.issues.push('Submission uses the legacy form: material quantities need review')
   if(r.submitted_at&&r.responder_id!==r.technician_id)output.issues.push('Submission retained from previous technician')
   const material_mismatch=output.issues.length>0
   if(serial&&po.po_status!=='Found')output.issues.push(po.po_status)
   if(output.report)output.report[50]=[r.response_values?.['Comments and/or questions']||'',...output.issues].filter(Boolean).join('\n')
   const assigned=gridDate(v.assigned_datetime||'',true)
   return {id:r.id,ticket_number:v.ticket_number||'',team:r.team||'',assigned_date:assigned?new Date(Date.parse(assigned)+3*3600000).toISOString().slice(0,10):null,
    assigned_datetime:v.assigned_datetime||'',old_serial:v.old_serial||'',new_serial:v.new_serial||'',status:v.status,resolution:v.resolution,ont_model:v.ont_model,
    submitted_at:r.submitted_at,technician:r.responder||'',technician_ont:r.response_values?.['ONT Replaced ']||'',technician_serial:r.response_values?.['New ONT Serial No ']||'',
    controller_values:v,response_values:r.response_values,ont_replaced:!!serial,material_mismatch,...po,...output}
  })
 }
 async form(id:string,actor:Actor){
  const [source]=await this.db.query('SELECT * FROM service_assurance_rows WHERE id=$1',[uuid(id)])
  if(!source)throw new NotFoundException('Ticket not found')
  const row=(await this.authoritative(source.project_id)).find(r=>r.id===id)
  if(!row||row.technician_id!==actor.userId)throw new ForbiddenException('This ticket is not currently assigned to you')
  if(!needsAssuranceResponse(row.raw_values))throw new BadRequestException('This ticket is no longer eligible')
  const own=row.draft_responder_id===actor.userId
  const values=Object.fromEntries(serviceAssuranceResponseFields.map(key=>[key,own?row.draft_values?.[key]??'':'']))
  values['Team Name']=row.team||''
  values['SR / Ticket number']=row.raw_values.ticket_number||''
  return {id:row.id,version:row.version,response_version:row.response_version||0,values,submitted_at:row.responder_id===actor.userId?row.submitted_at:null}
 }
 async submit(id:string,body:any,actor:Actor){
  uuid(id)
  const values=textValues(body?.values,serviceAssuranceResponseFields)
  const draft=body?.draft===true
  if(!draft&&!hasAssuranceAnswer(values))throw new BadRequestException('Enter at least one response before submitting')
  const invalid=invalidAssuranceQuantities(values)
  if(invalid.length)throw new BadRequestException(invalid.join(', ')+' must be nonnegative numeric quantities')
  return this.db.transaction(async tx=>{
   const [source]=await tx.query('SELECT * FROM service_assurance_rows WHERE id=$1',[id])
   if(!source)throw new NotFoundException('Ticket not found')
   await tx.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[source.project_id])
   const row=(await this.authoritative(source.project_id,tx)).find(r=>r.id===id)
   if(!row||row.technician_id!==actor.userId)throw new ForbiddenException('This ticket is not currently assigned to you')
   if(!needsAssuranceResponse(row.raw_values))throw new BadRequestException('This ticket is no longer eligible')
   if(body.version!==row.version||body.response_version!==(row.response_version||0))throw new ConflictException('This ticket or response changed. Reopen the form before saving.')
   values['Team Name']=row.team||''
   values['SR / Ticket number']=row.raw_values.ticket_number||''
   values.Timestamp=new Date().toISOString()
   const [existing]=await tx.query('SELECT * FROM service_assurance_responses WHERE row_id=$1',[id])
   const [response]=await tx.query(`INSERT INTO service_assurance_responses(row_id,technician_id,ticket_number,raw_values,submitted_values,submitted_by,submitted_at,updated_at)
    VALUES($1,$2,$3,$4,CASE WHEN $5 THEN NULL ELSE $4::jsonb END,CASE WHEN $5 THEN NULL ELSE $2::uuid END,CASE WHEN $5 THEN NULL ELSE clock_timestamp() END,clock_timestamp())
    ON CONFLICT(row_id) DO UPDATE SET technician_id=EXCLUDED.technician_id,ticket_number=EXCLUDED.ticket_number,raw_values=EXCLUDED.raw_values,
    submitted_by=CASE WHEN $5 THEN service_assurance_responses.submitted_by ELSE EXCLUDED.technician_id END,
    submitted_values=CASE WHEN $5 THEN service_assurance_responses.submitted_values ELSE EXCLUDED.raw_values END,
    submitted_at=CASE WHEN $5 THEN service_assurance_responses.submitted_at ELSE clock_timestamp() END,version=service_assurance_responses.version+1,updated_at=clock_timestamp()
    RETURNING submitted_at,version`,[id,actor.userId,row.raw_values.ticket_number.trim(),JSON.stringify(values),draft])
   await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)',[actor.userId,'service_assurance_responses',id,existing?'update':'create',existing?JSON.stringify(existing):null,JSON.stringify(values)])
   return response
  })
 }
}
