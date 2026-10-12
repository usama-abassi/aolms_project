import 'server-only';
import {Database} from '@/lib/db';
import {uuid} from '@/lib/api';
import {type Actor} from '@/lib/auth';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@/lib/http';
import {serviceAssuranceFields,serviceAssuranceResponseFields,responseIdentifiers} from '@/lib/service-assurance-fields';
import {needsAssuranceResponse,hasAssuranceAnswer} from '@/lib/service-assurance-rules';
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
   await this.project(projectId,tx);
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
   const [row]=await tx.query(`INSERT INTO service_assurance_rows(id,project_id,technician_id,raw_values,mutation_id,updated_by)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET technician_id=EXCLUDED.technician_id,raw_values=EXCLUDED.raw_values,
    mutation_id=EXCLUDED.mutation_id,updated_by=EXCLUDED.updated_by,version=service_assurance_rows.version+1,updated_at=clock_timestamp() RETURNING *`,[id,projectId,technician,JSON.stringify(values),mutation,actor.userId]);
   await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)',[actor.userId,'service_assurance_rows',id,old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(row)]);
   return result(row);
  });
 }
 async tasks(actor:Actor){
  const rows=await this.db.query(`SELECT r.*,s.submitted_at,p.full_name AS team FROM service_assurance_rows r
   JOIN projects pr ON pr.id=r.project_id AND pr.code='SERVICE_DELIVERY'
   LEFT JOIN profiles p ON p.id=r.technician_id LEFT JOIN service_assurance_responses s ON s.row_id=r.id
   WHERE r.technician_id=$1 ORDER BY r.created_at DESC,r.id`,[actor.userId]);
  return rows.filter(r=>needsAssuranceResponse(r.raw_values)).map(r=>({...record(r),team_name:r.team||'',submitted_at:r.submitted_at}));
 }
 async audit(projectId:string){
  await this.project(projectId);
  const rows=await this.db.query(`SELECT r.*,s.submitted_at,p.full_name AS team,t.full_name AS responder FROM service_assurance_rows r
   LEFT JOIN profiles p ON p.id=r.technician_id LEFT JOIN service_assurance_responses s ON s.row_id=r.id
   LEFT JOIN profiles t ON t.id=s.technician_id WHERE r.project_id=$1 ORDER BY r.created_at DESC,r.id`,[projectId]);
  return rows.filter(r=>needsAssuranceResponse(r.raw_values)).map(r=>{
   const assigned=gridDate(r.raw_values.assigned_datetime||'',true);
   return {id:r.id,ticket_number:r.raw_values.ticket_number||'',team:r.team||'',assigned_date:assigned?new Date(Date.parse(assigned)+3*3600000).toISOString().slice(0,10):null,assigned_datetime:r.raw_values.assigned_datetime||'',old_serial:r.raw_values.old_serial,new_serial:r.raw_values.new_serial,submitted_at:r.submitted_at,technician:r.responder||''};
  });
 }
 async form(id:string,actor:Actor){
  const [row]=await this.db.query('SELECT * FROM service_assurance_rows WHERE id=$1',[uuid(id)]);
  if(!row)throw new NotFoundException('Ticket not found');
  if(row.technician_id!==actor.userId)throw new ForbiddenException('This ticket is assigned to another technician');
  if(!needsAssuranceResponse(row.raw_values))throw new BadRequestException('This ticket does not need a replacement response');
  const [response]=await this.db.query('SELECT * FROM service_assurance_responses WHERE row_id=$1',[id]);
  const values=Object.fromEntries(serviceAssuranceResponseFields.map(key=>[key,response?.raw_values[key]??(responseIdentifiers[key]?row.raw_values[responseIdentifiers[key]]||'':'')]));
  return {id:row.id,version:row.version,values,submitted_at:response?.submitted_at||null};
 }
 async submit(id:string,body:any,actor:Actor){
  uuid(id);
  const values=textValues(body?.values,serviceAssuranceResponseFields);
  if(!hasAssuranceAnswer(values))throw new BadRequestException('Enter at least one response before submitting');
  return this.db.transaction(async tx=>{
   const [row]=await tx.query('SELECT * FROM service_assurance_rows WHERE id=$1 FOR UPDATE',[id]);
   if(!row)throw new NotFoundException('Ticket not found');
   if(row.technician_id!==actor.userId)throw new ForbiddenException('This ticket is assigned to another technician');
   if(!needsAssuranceResponse(row.raw_values))throw new BadRequestException('This ticket no longer needs a replacement response');
   const [existing]=await tx.query('SELECT row_id FROM service_assurance_responses WHERE row_id=$1',[id]);
   if(existing)throw new ConflictException('A response has already been submitted for this ticket');
   if(body.version!==row.version)throw new ConflictException('The controller changed this ticket. Reopen the form before submitting.');
   for(const [key,source] of Object.entries(responseIdentifiers))values[key]=row.raw_values[source]||'';
   const [response]=await tx.query('INSERT INTO service_assurance_responses(row_id,technician_id,raw_values) VALUES($1,$2,$3) RETURNING submitted_at',[id,actor.userId,JSON.stringify(values)]);
   await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,$2,$3,$4,$5)',[actor.userId,'service_assurance_responses',id,'create',JSON.stringify(values)]);
   return response;
  });
 }
}
