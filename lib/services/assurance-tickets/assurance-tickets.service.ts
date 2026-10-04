import 'server-only';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@/lib/http';
import {Database as DataSource,Database as EntityManager} from '@/lib/db';

export interface Actor { userId: string; role: string }
export interface Field { key: string; label: string; excelColumn: string; storage: string; type: string; options?: string[] }
// JSON is copied by nest build assets; source path also supports development.
import fields from './assurance-fields.json';
export const assuranceFields: Field[] = fields;
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException('Invalid record ID');
  return value;
}
export function managerOnly(actor: Actor) {
  if (!['admin', 'controller'].includes(actor.role)) throw new ForbiddenException('Controller access required');
}
export function translateDatabaseError(error: any): never {
  if (error.code === '23505') throw new ConflictException('This ticket number already exists. Refresh and edit the existing record.');
  if (['23503','22P02','22007','22008','23502'].includes(error.code)) throw new BadRequestException('Invalid field value or referenced record');
  throw error;
}
const joinedTicket = `SELECT t.*, p.full_name AS technician_name, c.full_name AS controller_name
 FROM assurance_tickets t LEFT JOIN profiles p ON p.id=t.technician_id LEFT JOIN profiles c ON c.id=t.controller_id`;


export class AssuranceTicketsService {
  constructor(private readonly db: DataSource) {}

  async metadata(actor: Actor) {
    managerOnly(actor);
    return { fields: assuranceFields, technicians: await this.db.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active ORDER BY full_name") };
  }

  async findAll(actor: Actor, projectId?: string) {
    if (actor.role === 'technician') return this.db.query(`${joinedTicket} WHERE t.technician_id=$1 AND t.status='Resolved' ORDER BY t.updated_at DESC`, [actor.userId]);
    managerOnly(actor);
    return this.db.query(`${joinedTicket} WHERE ($1::uuid IS NULL OR t.project_id=$1) ORDER BY t.updated_at DESC`, [projectId ? uuid(projectId) : null]);
  }

  async findOne(id: string, actor: Actor) {
    const [ticket] = await this.db.query(`${joinedTicket} WHERE t.id=$1`, [uuid(id)]);
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (actor.role === 'technician') {
      const [history] = await this.db.query('SELECT id FROM assurance_submissions WHERE ticket_id=$1 AND technician_id=$2 AND submitted_at IS NOT NULL', [id, actor.userId]);
      if (!(ticket.technician_id === actor.userId && ticket.status === 'Resolved') && !history) throw new ForbiddenException('This ticket is not assigned to you');
    } else managerOnly(actor);
    return ticket;
  }

  async saveRows(body: any, actor: Actor) {
    managerOnly(actor);
    if (!Array.isArray(body?.rows) || !body.rows.length || body.rows.length > 100) throw new BadRequestException('Save between 1 and 100 rows at a time');
    const ids = body.rows.map((r: any) => uuid(r.id));
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate row IDs');
    try {
      return await this.db.transaction(async em => {
        const result = [];
        // Stable lock order avoids deadlocks between overlapping batch saves.
        for (const row of [...body.rows].sort((a, b) => a.id.localeCompare(b.id))) result.push(await this.saveRow(em, row, actor));
        return result;
      });
    } catch (error) { translateDatabaseError(error); }
  }

  async saveRow(em: EntityManager, row: any, actor: Actor) {
    const id = uuid(row.id), mutation = uuid(row.mutation_id);
    await em.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [id]);
    const [old] = await em.query('SELECT * FROM assurance_tickets WHERE id=$1 FOR UPDATE', [id]);
    if (old?.last_mutation_id === mutation) return old; // Retry after a lost response.
    if (old ? row.base_version !== old.version : row.base_version != null) throw new ConflictException(`Ticket ${old?.ticket_number || id} changed on the server. Review the latest row before saving.`);
    const projectId = uuid(row.project_id);
    const [project] = await em.query("SELECT id FROM projects WHERE id=$1 AND code='SERVICE_ASSURANCE'", [projectId]);
    if (!project || (old && old.project_id !== projectId)) throw new BadRequestException('Select the Service Delivery project');
    const values: Record<string, unknown> = {}, extra: Record<string, unknown> = {};
    for (const field of assuranceFields) {
      if (['controller_id','sla_from_creation'].includes(field.key)) continue;
      let value = row[field.key] ?? null;
      if (value !== null && typeof value !== 'string') throw new BadRequestException(`${field.label} must be text`);
      if (typeof value === 'string') value = value.trim() || null;
      if (typeof value === 'string' && value.length > 20000) throw new BadRequestException(`${field.label} is too long`);
      if (value && field.options && !field.options.includes(value)) throw new BadRequestException(`Choose a valid ${field.label}`);
      if (value && ['date','datetime-local'].includes(field.type) && !Number.isFinite(Date.parse(value))) throw new BadRequestException(`Invalid ${field.label}`);
      if (field.storage.startsWith('spreadsheet_fields.')) extra[field.key] = value;
      else values[field.key] = value;
    }
    if (!values.ticket_number || !values.work_date || !values.status) throw new BadRequestException('Date, Ticket No and Status are required');
    if (values.technician_id) {
      uuid(values.technician_id);
      const [technician] = await em.query("SELECT id FROM profiles WHERE id=$1 AND role='technician' AND is_active FOR SHARE", [values.technician_id]);
      if (!technician) throw new BadRequestException('Team must be an active Technician');
    }
    const start = values.creation_datetime, end = values.close_datetime;
    values.sla_from_creation = start && end ? (Date.parse(String(end)) - Date.parse(String(start))) / 86400000 : null;
    if (Number(values.sla_from_creation) < 0) throw new BadRequestException('Close Date/Time must follow Creationdate/time');
    values.project_id = projectId;
    values.controller_id = old?.controller_id || actor.userId;
    values.spreadsheet_fields = JSON.stringify(extra);
    values.last_mutation_id = mutation;
    const columns = Object.keys(values);
    let saved;
    if (old) {
      [saved] = await em.query(`UPDATE assurance_tickets SET ${columns.map((c,i)=>`"${c}"=$${i+2}`).join(',')}, version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING *`, [id,...Object.values(values)]);
    } else {
      [saved] = await em.query(`INSERT INTO assurance_tickets(id,${columns.map(c=>`"${c}"`).join(',')}) VALUES($1,${columns.map((_,i)=>`$${i+2}`).join(',')}) RETURNING *`, [id,...Object.values(values)]);
    }
    // Assignment is the ticket's technician FK + Resolved status, never a copied Todo.
    await em.query('INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6)', [actor.userId,'assurance_tickets',id,old?'update':'create',old ? JSON.stringify({status:old.status,technician_id:old.technician_id,version:old.version}):null,JSON.stringify({status:saved.status,technician_id:saved.technician_id,version:saved.version})]);
    return saved;
  }
}
