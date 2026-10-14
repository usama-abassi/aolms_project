import 'server-only';
import {Database} from '@/lib/db';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@/lib/http';
import {managerOnly,uuid,type Actor} from '../assurance-tickets/assurance-tickets.service';
import {gridDate} from '../assurance-tickets/grid-values';
import {auditOrder,calculateResponse,controllerFields,norm,orderValues,responseFields,responseValues} from './model';

export class ServiceDelivery {
 constructor(private db:Database){}
 async list(project:string,actor:Actor){managerOnly(actor);return this.db.query(`SELECT t.*,p.full_name technician_name,c.full_name controller_name FROM assurance_tickets t LEFT JOIN profiles p ON p.id=t.technician_id LEFT JOIN profiles c ON c.id=t.controller_id WHERE t.project_id=$1 ORDER BY t.work_date DESC,t.id`,[uuid(project)]);}
 async metadata(actor:Actor){managerOnly(actor);return {technicians:await this.db.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active ORDER BY full_name")};}
 async saveOrder(body:any,actor:Actor){
  managerOnly(actor);const id=uuid(body.id),project=uuid(body.project_id),mutation=uuid(body.mutation_id);
  const values=this.validate(body.values,controllerFields);
  if(!values.work_date||!values.ticket_number||!values.actioned)throw new BadRequestException('Date, Order and Actioned are required');
  for(const f of controllerFields)if(values[f.key]&&['date','datetime-local'].includes(f.type)){const date=gridDate(values[f.key],f.type==='datetime-local');if(!date)throw new BadRequestException(`Invalid ${f.label}`);values[f.key]=date;}
  return this.db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
   const [p]=await tx.query("SELECT id FROM projects WHERE id=$1 AND code='SERVICE_ASSURANCE'",[project]);if(!p)throw new BadRequestException('Select Service Delivery');
   const [old]=await tx.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE',[id]);
   if(old?.last_mutation_id===mutation)return old;
   if(old&&(old.project_id!==project||old.version!==body.base_version)||!old&&body.base_version!=null)throw new ConflictException('Order changed. Refresh and review your retained draft.');
   if(values.technician_id){const [tech]=await tx.query("SELECT id FROM profiles WHERE id=$1 AND role='technician' AND is_active FOR SHARE",[uuid(values.technician_id)]);if(!tech)throw new BadRequestException('Team must be an active Technician');}
   const extra={...old?.spreadsheet_fields,delivery:values,wbs_type:values.order_type,wbs_connection_type:values.connection_type,new_ont_sn:values.nce_sn};
   // Resolved remains the internal legacy state; eligibility also checks the exact Actioned value.
   const fields:any={project_id:project,ticket_number:values.ticket_number,work_date:values.work_date,technician_id:values.technician_id||null,controller_id:old?.controller_id||actor.userId,status:norm(values.actioned)==='delivered'?'Resolved':'Open',spreadsheet_fields:JSON.stringify(extra),last_mutation_id:mutation};
   for(const k of ['exchange','mobile','lo_name','circuit','block','road','building','flat','package'])fields[k]=values[k]||null;
   const keys=Object.keys(fields);let saved;
   if(old)[saved]=await tx.query(`UPDATE assurance_tickets SET ${keys.map((k,i)=>`"${k}"=$${i+2}`).join(',')},version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[id,...Object.values(fields)]);
   else [saved]=await tx.query(`INSERT INTO assurance_tickets(id,${keys.map(k=>`"${k}"`).join(',')}) VALUES($1,${keys.map((_,i)=>`$${i+2}`).join(',')}) RETURNING *`,[id,...Object.values(fields)]);
   await this.log(tx,actor,'assurance_tickets',id,old,saved);return saved;
  });
 }
 private validate(input:any,fields:Array<{key:string;label:string;type:string}>){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Fields are required');
  const result:Record<string,string>={};
  for(const field of fields){const v=input[field.key]??'';if(typeof v!=='string'||v.length>20000)throw new BadRequestException(`Invalid ${field.label}`);result[field.key]=v;
   if(field.type==='number'&&v.trim()&&(!Number.isFinite(Number(v))||Number(v)<0))throw new BadRequestException(`${field.label} must be a nonnegative quantity`);
  }return result;
 }
 async form(id:string,actor:Actor){
  const [t]=await this.db.query('SELECT t.*,p.full_name technician_name FROM assurance_tickets t LEFT JOIN profiles p ON p.id=t.technician_id WHERE t.id=$1',[uuid(id)]);if(!t)throw new NotFoundException('Order not found');
  const [s]=await this.db.query('SELECT * FROM assurance_submissions WHERE ticket_id=$1 AND technician_id=$2',[id,actor.userId]);
  if(actor.role!=='technician')throw new ForbiddenException('Technician access required');
  const active=t.technician_id===actor.userId&&norm(orderValues(t).actioned)==='delivered';
  if(!active&&!s?.submitted_at)throw new ForbiddenException('Order is not an active assignment');
  const values=responseValues(s,t);if(!s)values.B=(actor as Actor&{email?:string}).email||'';
  return {ticket:t,submission:s||null,values,can_edit:active&&s?.status!=='locked'&&(!s?.submitted_at||Date.now()<new Date(s.submitted_at).getTime()+86400000)};
 }
 async saveForm(id:string,body:any,actor:Actor){
  uuid(id);const mutation=uuid(body.mutation_id);if(actor.role!=='technician')throw new ForbiddenException('Technician access required');
  if(!['draft','submit'].includes(body.intent))throw new BadRequestException('Choose Save or Submit');
  const fields=calculateResponse(this.validate(body.values,responseFields));
  if(body.intent==='submit'&&['B','C','D','E','F','G','BN'].some(k=>!fields[k]?.trim()))throw new BadRequestException('Email, Team, Order Number, Order Type, Package, Connection Type and Installed ONT are required');
  if(fields.B&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.B))throw new BadRequestException('Invalid email address');
  return this.db.transaction(async tx=>{
   const [t]=await tx.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE',[id]);if(!t)throw new NotFoundException('Order not found');
   const [old]=await tx.query('SELECT * FROM assurance_submissions WHERE ticket_id=$1 AND technician_id=$2 FOR UPDATE',[id,actor.userId]);
   if(t.technician_id!==actor.userId||norm(orderValues(t).actioned)!=='delivered'||old?.status==='locked'||old?.submitted_at&&Date.now()>=new Date(old.submitted_at).getTime()+86400000)throw new ForbiddenException('Assignment changed or the original 24-hour editing window expired');
   if(old?.last_mutation_id===mutation)return old;
   if(old?old.version!==body.base_version:body.base_version!=null)throw new ConflictException('Form changed. Reload and review your local draft.');
   if(fields.D.trim()!==String(t.ticket_number).trim())throw new BadRequestException('Order Number must match the assigned order');
   const [clock]=await tx.query('SELECT clock_timestamp() now');const submitted=old?.submitted_at||(body.intent==='submit'?clock.now:null);
   fields.A=submitted?new Date(submitted).toISOString():'';
   const data:any={delivery_fields:JSON.stringify(fields),response_order_type:fields.E,response_connection_type:fields.G,submitted_at:submitted,edit_deadline:submitted?new Date(new Date(submitted).getTime()+86400000):null,status:submitted?'submitted':'draft',last_saved_at:clock.now,last_mutation_id:mutation};
   const keys=Object.keys(data);let saved;
   if(old)[saved]=await tx.query(`UPDATE assurance_submissions SET ${keys.map((k,i)=>`"${k}"=$${i+2}`).join(',')},version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[old.id,...Object.values(data)]);
   else [saved]=await tx.query(`INSERT INTO assurance_submissions(ticket_id,technician_id,${keys.map(k=>`"${k}"`).join(',')}) VALUES($1,$2,${keys.map((_,i)=>`$${i+3}`).join(',')}) RETURNING *`,[id,actor.userId,...Object.values(data)]);
   await this.log(tx,actor,'assurance_submissions',saved.id,old,saved);return saved;
  });
 }
 async audit(project:string,actor:Actor){
  managerOnly(actor);
  return this.db.transaction(async tx=>{
   await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const records=await new ServiceDelivery(tx).list(project,actor);
   const submissions=await tx.query('SELECT s.* FROM assurance_submissions s JOIN assurance_tickets t ON t.id=s.ticket_id WHERE t.project_id=$1 ORDER BY s.submitted_at DESC NULLS LAST,s.id',[project]);
   const serials=records.map(t=>norm(orderValues(t).nce_sn)).filter(Boolean);
   const inventory=await tx.query(`SELECT serial_number,po_number,item_code,model FROM ont_inventory WHERE lower(trim(serial_number))=ANY($1::text[]) UNION ALL SELECT data->>'serial_number',data->>'po_number',data->>'item_code',data->>'model' FROM equipment_records WHERE kind='ont' AND lower(trim(data->>'serial_number'))=ANY($1::text[])`,[serials]);
   return records.map(t=>auditOrder(t,submissions.filter(s=>s.ticket_id===t.id),inventory));
  });
 }
 async correct(id:string,body:any,actor:Actor){
  managerOnly(actor);uuid(id);
  if(!['controller','technician'].includes(body.source)||!['order_type','connection_type'].includes(body.field)||typeof body.value!=='string'||!body.value.trim()||body.value.length>20000)throw new BadRequestException('Select a source, field and nonempty corrected value');
  return this.db.transaction(async tx=>{
   const [t]=await tx.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE',[id]);if(!t)throw new NotFoundException('Order not found');
   let old=t,saved,table='assurance_tickets';
   if(body.source==='controller'){
    const v=orderValues(t);if(v[body.field]!==body.previous)throw new ConflictException('Value changed; reopen the correction');v[body.field]=body.value.trim();
    const extra={...t.spreadsheet_fields,delivery:v,[body.field==='order_type'?'wbs_type':'wbs_connection_type']:body.value.trim()};
    [saved]=await tx.query('UPDATE assurance_tickets SET spreadsheet_fields=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *',[id,JSON.stringify(extra)]);
   }else{
    table='assurance_submissions';[old]=await tx.query('SELECT * FROM assurance_submissions WHERE id=$1 AND ticket_id=$2 FOR UPDATE',[uuid(body.submission_id),id]);if(!old)throw new NotFoundException('Response not found');
    const key=body.field==='order_type'?'E':'G',column=key==='E'?'response_order_type':'response_connection_type';
    if(responseValues(old,t)[key]!==body.previous)throw new ConflictException('Value changed; reopen the correction');
    const v={...old.delivery_fields,[key]:body.value.trim()};
    [saved]=await tx.query(`UPDATE assurance_submissions SET delivery_fields=$2,${column}=$3,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[old.id,JSON.stringify(v),body.value.trim()]);
   }
   await this.log(tx,actor,table,old.id,{order_id:id,source:body.source,field:body.field,value:body.previous},{order_id:id,source:body.source,field:body.field,value:body.value.trim()});return saved;
  });
 }
 async history(id:string,actor:Actor){managerOnly(actor);return this.db.query(`SELECT a.*,p.full_name modified_by FROM audit_logs a LEFT JOIN profiles p ON p.id=a.user_id WHERE (a.table_name='assurance_tickets' AND a.record_id=$1) OR (a.table_name='assurance_submissions' AND a.record_id IN (SELECT id FROM assurance_submissions WHERE ticket_id=$1)) ORDER BY a.created_at DESC LIMIT 200`,[uuid(id)]);}
 private async log(tx:Database,actor:Actor,table:string,id:string,old:any,value:any){await tx.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)',[actor.userId,table,id,old?'update':'create',old?JSON.stringify(old):null,JSON.stringify(value)]);}
}
