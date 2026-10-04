import 'server-only';
import {Database} from '@/lib/db';
import {BadRequestException,ConflictException,HttpException} from '@/lib/http';
import {AssuranceTicketsService,assuranceFields,managerOnly,uuid,type Actor} from './assurance-tickets.service';
import {normalizeGrid,protectedGridFields} from './grid-values';

export class DeliveryGridService{
 constructor(private db:Database){}
 async list(projectId:string,actor:Actor){
  managerOnly(actor);
  return this.db.query(`SELECT DISTINCT ON (d.id) d.*,COALESCE(mine.version,0) AS own_version FROM delivery_grid_drafts d
   LEFT JOIN assurance_tickets t ON t.id=d.id
   LEFT JOIN delivery_grid_drafts mine ON mine.id=d.id AND mine.user_id=$1
   WHERE d.project_id=$2 AND (d.user_id=$1 OR (d.state='record' AND d.record_version=t.version))
   ORDER BY d.id,(d.user_id=$1 AND d.state='draft') DESC,(d.record_version=t.version) DESC NULLS LAST,(d.user_id=$1) DESC,d.updated_at DESC`,[actor.userId,uuid(projectId)]);
 }
 async save(body:any,actor:Actor){
  managerOnly(actor);
  if(!body||!body.values||typeof body.values!=='object'||Array.isArray(body.values))throw new BadRequestException('Cell values are required');
  const id=uuid(body.id),project=uuid(body.project_id),mutation=uuid(body.mutation_id);
  if(!Number.isInteger(body.draft_version)||body.draft_version<0)throw new BadRequestException('Draft version is required');
  if(body.base_version!==null&&(!Number.isInteger(body.base_version)||body.base_version<1))throw new BadRequestException('Record version is required');
  const raw:Record<string,string>={};
  for(const field of assuranceFields){
   if(protectedGridFields.has(field.key))continue;
   const value=body.values[field.key]??'';
   if(typeof value!=='string'||value.length>20000)throw new BadRequestException(`${field.label} must be text of at most 20000 characters`);
   raw[field.key]=value;
  }
  return this.db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
   const [existing]=await tx.query('SELECT * FROM delivery_grid_drafts WHERE user_id=$1 AND id=$2 FOR UPDATE',[actor.userId,id]);
   if(existing?.mutation_id===mutation){
    const [record]=await tx.query('SELECT * FROM assurance_tickets WHERE id=$1',[id]);
    return {draft:existing,record:record||null};
   }
   if((existing?.version??0)!==body.draft_version)throw new ConflictException('This draft changed in another tab. Your local text is retained. Refresh to review the server version.');
   const [p]=await tx.query("SELECT id FROM projects WHERE id=$1 AND code='SERVICE_ASSURANCE'",[project]);
   if(!p||(existing&&existing.project_id!==project))throw new BadRequestException('Select the Service Delivery project');
   const [old]=await tx.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE',[id]);
   if(old&&old.project_id!==project)throw new BadRequestException('Record belongs to another project');
   const techs=await tx.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active ORDER BY id");
   const normalized=normalizeGrid(raw,techs,old);
   let errors=normalized.errors,record:any=null,recordVersion=body.base_version;
   if((old?.version??null)!==body.base_version)errors={...errors,_row:'The official record changed elsewhere. Your draft is saved without overwriting it. Refresh and review before retrying.'};
   if(!Object.keys(errors).length){
    await tx.query('SAVEPOINT grid_promotion');
    try{
     record=await new AssuranceTicketsService(tx).saveRow(tx,{...normalized.values,id,project_id:project,base_version:body.base_version,mutation_id:mutation},actor);
     recordVersion=record.version;
     await tx.query('RELEASE SAVEPOINT grid_promotion');
    }catch(error){
     await tx.query('ROLLBACK TO SAVEPOINT grid_promotion');
     const dbError=error as {code?:string};
     if(error instanceof HttpException&&[400,409].includes(error.status))errors._row=error.message;
     else if(dbError.code==='23505')errors.ticket_number='This ticket number already exists. Your text is saved as a draft.';
     else if(['23503','22P02','22007','22008','23502','22001','23514'].includes(dbError.code||''))errors._row='A value does not satisfy the existing record rules. Your text is saved as a draft.';
     else throw error;
    }
   }
   const [draft]=await tx.query(`INSERT INTO delivery_grid_drafts(user_id,id,project_id,raw_values,errors,version,record_version,state,mutation_id)
    VALUES($1,$2,$3,$4,$5,1,$6,$7,$8) ON CONFLICT(user_id,id) DO UPDATE SET raw_values=EXCLUDED.raw_values,errors=EXCLUDED.errors,
    version=delivery_grid_drafts.version+1,record_version=EXCLUDED.record_version,state=EXCLUDED.state,mutation_id=EXCLUDED.mutation_id,updated_at=clock_timestamp() RETURNING *`,
    [actor.userId,id,project,JSON.stringify(raw),JSON.stringify(errors),recordVersion,record?'record':'draft',mutation]);
   await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)',[actor.userId,'delivery_grid_drafts',id,existing?'update':'create',existing?JSON.stringify(existing):null,JSON.stringify(draft)]);
   return {draft,record};
  });
 }
}
