import 'server-only';
import {norm,orderValues} from '../service-delivery/model';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@/lib/http';
import {Database as DataSource} from '@/lib/db';
import { Actor, assuranceFields, managerOnly, uuid, translateDatabaseError } from '../assurance-tickets/assurance-tickets.service';

export const submissionFields = ['response_order_type','response_connection_type','root_cause','resolution','resolution_description','mims','replacement_reason','replaced_cpe_model','replaced_cpe_sn','new_cpe_model','new_cpe_sn','ont_protection_box','saas_type','box_number','replacement','saas_non_saas','model','physical_verification','location','remarks'];
export function withinWindow(submittedAt: string | Date | null, now = Date.now()) {
  return !submittedAt || now < new Date(submittedAt).getTime() + 86400000;
}
export function canEdit(ticket: any, submission: any, actor: Actor, now = Date.now()) {
  if (['admin','controller'].includes(actor.role)) return true;
  return actor.role === 'technician' && ticket.technician_id === actor.userId && norm(orderValues(ticket).actioned) === 'delivered'
    && (!submission || submission.technician_id === actor.userId)
    && submission?.status !== 'locked' && withinWindow(submission?.submitted_at, now);
}


export class AssuranceSubmissionsService {
  constructor(private readonly db: DataSource) {}

  async audit(actor: Actor, projectId?:string) {
    if(projectId) uuid(projectId);
    managerOnly(actor);
    const rows = await this.db.query(`SELECT t.id,t.ticket_number,t.work_date,t.circuit,t.exchange,t.service_type,t.status,
      owners.technician_id AS submission_technician_id,p.full_name AS technician_name,
      s.id AS submission_id,s.submitted_at,(s.submitted_at IS NOT NULL) AS completed,
      (owners.technician_id=t.technician_id AND (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END)) AS active_assignment,
      s.submitted_at + interval '24 hours' AS edit_deadline,
      (owners.technician_id=t.technician_id AND (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END) AND coalesce(s.status::text,'draft') <> 'locked'
        AND (s.submitted_at IS NULL OR clock_timestamp() < s.submitted_at + interval '24 hours')) AS can_edit
      FROM assurance_tickets t
      JOIN LATERAL (
        SELECT t.technician_id WHERE (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END)
        UNION SELECT historical.technician_id FROM assurance_submissions historical
          WHERE historical.ticket_id=t.id AND historical.submitted_at IS NOT NULL
      ) owners ON true
      LEFT JOIN assurance_submissions s ON s.ticket_id=t.id AND s.technician_id=owners.technician_id
      LEFT JOIN profiles p ON p.id=owners.technician_id
      WHERE ($1::uuid IS NULL OR t.project_id=$1)
      ORDER BY (s.submitted_at IS NOT NULL) DESC,coalesce(s.submitted_at,t.updated_at) DESC,t.id,owners.technician_id`,[projectId??null]);
    return { rows, counts: { completed: rows.filter((r:any)=>r.completed).length, pending: rows.filter((r:any)=>!r.completed).length }, server_time: new Date().toISOString() };
  }

  async tasks(actor: Actor) {
    if (actor.role !== 'technician') throw new ForbiddenException('Technician access required');
    const rows = await this.db.query(`SELECT t.id,t.ticket_number,t.work_date,t.circuit,t.exchange,t.service_type,t.status,t.technician_id,
      p.full_name AS technician_name,s.id AS submission_id,s.status AS submission_status,s.submitted_at,s.updated_at AS submission_updated_at,
      (t.technician_id=$1 AND (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END)) AS active_assignment,
      (s.submitted_at IS NOT NULL) AS completed,
      (s.submitted_at + interval '24 hours') AS edit_deadline,
      (t.technician_id=$1 AND (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END) AND coalesce(s.status::text,'draft') <> 'locked'
       AND (s.submitted_at IS NULL OR clock_timestamp() < s.submitted_at + interval '24 hours')) AS can_edit
      FROM assurance_tickets t LEFT JOIN assurance_submissions s ON s.ticket_id=t.id AND s.technician_id=$1
      LEFT JOIN profiles p ON p.id=t.technician_id
      WHERE (t.technician_id=$1 AND (CASE WHEN t.spreadsheet_fields->'delivery' IS NOT NULL THEN lower(trim(t.spreadsheet_fields->'delivery'->>'actioned'))='delivered' ELSE t.status='Resolved' END)) OR s.submitted_at IS NOT NULL
      ORDER BY (s.submitted_at IS NOT NULL) DESC,coalesce(s.submitted_at,t.updated_at) DESC,t.id`, [actor.userId]);
    return { rows, counts: { completed: rows.filter((r:any)=>r.completed).length, pending: rows.filter((r:any)=>!r.completed).length }, server_time: new Date().toISOString() };
  }

  async get(ticketId: string, actor: Actor, technicianId?: string) {
    const owner = actor.role === 'technician' ? actor.userId : uuid(technicianId);
    if (actor.role !== 'technician') managerOnly(actor);
    const [ticket] = await this.db.query('SELECT * FROM assurance_tickets WHERE id=$1', [uuid(ticketId)]);
    if (!ticket) throw new NotFoundException('Ticket not found');
    const [submission] = await this.db.query('SELECT * FROM assurance_submissions WHERE ticket_id=$1 AND technician_id=$2', [ticketId,owner]);
    if (actor.role === 'technician' && !(ticket.technician_id===owner && norm(orderValues(ticket).actioned)==='delivered') && !submission?.submitted_at) throw new ForbiddenException('This task is not assigned to you');
    return {ticket, submission:submission || null, can_edit:canEdit(ticket,submission,actor), server_time:new Date().toISOString(), options: Object.fromEntries(assuranceFields.filter(f=>['root_cause','resolution','saas_type'].includes(f.key)).map(f=>[f.key,f.options || []]))};
  }

  async save(ticketId: string, body: any, actor: Actor) {
    const owner = actor.role === 'technician' ? actor.userId : uuid(body?.technician_id);
    if (actor.role !== 'technician') managerOnly(actor);
    uuid(ticketId);const mutation=uuid(body?.mutation_id);
    if (!['draft','submit'].includes(body?.intent)) throw new BadRequestException('Choose draft or submit');
    if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) throw new BadRequestException('Form fields are required');
    for (const key of Object.keys(body.fields)) if (![...submissionFields,'closed'].includes(key)) throw new BadRequestException(`Field ${key} is not editable`);
    try {
      return await this.db.transaction(async em=> {
        // Lock the ticket first: reassignment and form submission cannot race.
        const [ticket]=await em.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE',[ticketId]);
        if(!ticket) throw new NotFoundException('Ticket not found');
        const [old]=await em.query('SELECT * FROM assurance_submissions WHERE ticket_id=$1 AND technician_id=$2 FOR UPDATE',[ticketId,owner]);
        if (!canEdit(ticket,old,actor)) throw new ForbiddenException('Assignment changed or the original 24-hour edit window has expired');
        if(old?.last_mutation_id===mutation) return old;
        if(old ? body.base_version!==old.version : body.base_version!=null) throw new ConflictException('This form changed on the server. Reload and review before saving.');
        const fields: Record<string,unknown>={};
        for(const key of submissionFields) {
          const value=body.fields[key] ?? old?.[key] ?? null;
          if(value!==null && (typeof value!=='string' || value.length>20000)) throw new BadRequestException(`Invalid ${key}`);
          fields[key]=typeof value==='string'?value.trim()||null:value;
        }
        fields.closed=body.fields.closed ?? old?.closed ?? false;
        if(typeof fields.closed!=='boolean') throw new BadRequestException('Invalid closed value');
        if(body.intent==='submit' && (!fields.root_cause || !fields.resolution || !fields.resolution_description)) throw new BadRequestException('Root cause, resolution and resolution description are required to submit');
        const [clock]=await em.query('SELECT clock_timestamp() AS now');
        // Never accept timestamps or submission ownership from the technician.
        fields.submitted_at=old?.submitted_at || (body.intent==='submit'?clock.now:null);
        fields.edit_deadline=fields.submitted_at?new Date(new Date(fields.submitted_at as Date).getTime()+86400000):null;
        fields.status=fields.submitted_at?'submitted':'draft';
        fields.last_saved_at=clock.now;fields.last_mutation_id=mutation;
        const keys=Object.keys(fields);let saved;
        if(old) [saved]=await em.query(`UPDATE assurance_submissions SET ${keys.map((k,i)=>`"${k}"=$${i+2}`).join(',')},version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,[old.id,...Object.values(fields)]);
        else [saved]=await em.query(`INSERT INTO assurance_submissions(ticket_id,technician_id,${keys.map(k=>`"${k}"`).join(',')}) VALUES($1,$2,${keys.map((_,i)=>`$${i+3}`).join(',')}) RETURNING *`,[ticketId,owner,...Object.values(fields)]);
        await em.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,new_values) VALUES($1,$2,$3,$4,$5)',[actor.userId,'assurance_submissions',saved.id,body.intent,JSON.stringify({version:saved.version,submitted_at:saved.submitted_at})]);
        return saved;
      });
    }catch(error){translateDatabaseError(error);}
  }
}
