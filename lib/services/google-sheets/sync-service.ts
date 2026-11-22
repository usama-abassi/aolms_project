import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {type Actor} from '@/lib/auth';
import {BadRequestException,ConflictException} from '@/lib/http';
import {uuid} from '@/lib/api';
import {controllerFields,orderValues} from '../service-delivery/model';
import {serviceAssuranceFields} from '@/lib/service-assurance-fields';
import {ServiceDelivery} from '../service-delivery/service';
import {ServiceAssurance} from '../service-assurance';
import {GoogleSheetsClient} from './google-client';
import {stageProposals} from './proposal-gateway';
import {SheetReader} from './sheet-reader';
import {gridDate} from '../assurance-tickets/grid-values';
import {controllerDate,isRecordIdentifierHeader,recordMonth,mergeCells,sameValues,type Values,type SyncColumn} from './sync-model';
const fingerprint=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class SheetSyncService{
 async run(id:string,actor:Actor){
  uuid(id);
  // A session advisory lock serializes a whole run, including Google calls and local commits.
  return db.transaction(async lock=>{
   await lock.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['configuration:'+id]);
   const [c]=await lock.query(`SELECT c.*,p.code,to_char(c.month,'YYYY-MM') month_key FROM sheet_configurations c JOIN projects p ON p.id=c.project_id WHERE c.id=$1 AND c.deleted_at IS NULL`,[id]);
   if(!c)throw new BadRequestException('Configuration not found');
   const [guard]=await lock.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) locked',['sheet-sync:'+c.spreadsheet_id]);
   if(!guard.locked)return {status:'already_running'};
   if(c.sync_status==='review_required')throw new ConflictException('Synchronization identifiers need review before retrying');
   const [log]=await db.query('INSERT INTO sheet_sync_logs(configuration_id) VALUES($1) RETURNING id',[id]);
   await db.query("UPDATE sheet_configurations SET last_attempt_at=now(),sync_status='running',latest_error=NULL WHERE id=$1",[id]);
   try{
    const result=await this.process(c,actor);
    const staged=await stageProposals(c);
    Object.assign(result,{proposals_staged:staged});
    await db.query("UPDATE sheet_configurations SET last_success_at=now(),last_checked_at=now(),sync_status='success',latest_error=NULL WHERE id=$1",[id]);
    await db.query("UPDATE sheet_sync_logs SET finished_at=now(),status='success',details=$2 WHERE id=$1",[log.id,JSON.stringify(result)]);
    return result;
   }catch(error){
    const message=error instanceof Error?error.message:'Synchronization failed';
    await db.query("UPDATE sheet_configurations SET sync_status=$2,latest_error=$3 WHERE id=$1",[id,message.startsWith('Identity review:')?'review_required':'error',message]);
    await db.query("UPDATE sheet_sync_logs SET finished_at=now(),status='error',details=$2 WHERE id=$1",[log.id,JSON.stringify({message})]);
    throw error;
   }
  });
 }
 private async process(c:any,actor:Actor){
  const delivery=c.code==='SERVICE_ASSURANCE',assurance=c.code==='SERVICE_DELIVERY';
  if(!delivery&&!assurance)throw new BadRequestException('This project has no existing controller workflow adapter');
  const fields=delivery?controllerFields:serviceAssuranceFields,dateKey=delivery?'work_date':'date';
  const all=delivery?await db.query(`SELECT t.*,p.full_name technician_name,c.full_name controller_name FROM assurance_tickets t LEFT JOIN profiles p ON p.id=t.technician_id LEFT JOIN profiles c ON c.id=t.controller_id WHERE t.project_id=$1 AND t.work_date >= $2::date AND t.work_date < ($2::date+interval '1 month') ORDER BY t.id`,[c.project_id,c.month_key+'-01']):(await db.query(`SELECT * FROM service_assurance_rows WHERE project_id=$1 AND (left(raw_values->>'date',7)=$2 OR raw_values->>'date' ~ $3)`,[c.project_id,c.month_key,`^[0-9]{1,2}/0?${Number(c.month_key.slice(5))}/${c.month_key.slice(0,4)}$`])).map(r=>({...r.raw_values,id:r.id,project_id:r.project_id,version:r.version}));
  const locals=new Map<string,{record:any;values:Values}>();
  for(const record of all){const values=delivery?{...orderValues(record),...record.spreadsheet_fields?.delivery}:Object.fromEntries([...serviceAssuranceFields.map(f=>f.key),...(c.columns as SyncColumn[]).map(x=>x.key)].filter(k=>typeof record[k]==='string').map(k=>[k,String(record[k]??'')]));if((delivery?String(record.work_date instanceof Date?record.work_date.toISOString().slice(0,10):record.work_date).slice(0,7):recordMonth(values[dateKey]))===c.month_key)locals.set(record.id,{record,values});}
  const google=new GoogleSheetsClient(),revision=await google.revision(c.spreadsheet_id);
  const snapshots=await db.query('SELECT * FROM sheet_sync_records WHERE configuration_id=$1',[c.id]);
  const byId=new Map(snapshots.map(s=>[s.record_id,s]));
  if(String(revision.version)===c.remote_revision){await this.proposals(c,locals,byId);return {status:'unchanged',records:0};}
  const reader=new SheetReader(google),sheet=await reader.read(c.spreadsheet_id,c.tab_name,fields,snapshots.length===0);
  if(!sheet.columns.some(x=>x.key===dateKey)&&!snapshots.length)throw new BadRequestException('Initial import requires the controller Date column for monthly routing');
  const technicians=await db.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active");
  const teamKey=delivery?'technician_id':'team';
  const identifier=sheet.columns.find(column=>column.key==='ticket_number')??sheet.columns.find(column=>isRecordIdentifierHeader(column.label));
  const normalize=(values:Values)=>{
   if(identifier&&identifier.key!=='ticket_number')values.ticket_number=values[identifier.key];
   if(values[dateKey])values[dateKey]=controllerDate(values[dateKey],c.month_key)||values[dateKey];
   const team=values[teamKey]?.trim();
   if(!team)return;
   const byId=technicians.find(t=>t.id===team.toLowerCase());
   const matches=technicians.filter(t=>t.full_name.trim().toLowerCase()===team.toLowerCase());
   if(byId||matches.length===1)values[teamKey]=(byId??matches[0]).id;
  };
  const latest=new Map<string,(typeof sheet.rows)[number]>();
  let duplicates=0;
  for(const row of sheet.rows){
   const ticket=row.values[identifier?.key??'ticket_number']?.trim();
   if(!ticket)continue;
   const prior=latest.get(ticket);
   if(prior)duplicates++;
   if(!prior||row.index>prior.index)latest.set(ticket,row);
  }
  const rows=[...latest.values()].sort((a,b)=>a.index-b.index);
  for(const row of rows)normalize(row.values);
  const existingByTicket=new Map([...locals].map(([id,l])=>[l.values.ticket_number?.trim(),id]));
  const outsideMonth=delivery&&latest.size?new Set((await db.query(`SELECT id,ticket_number FROM assurance_tickets WHERE ticket_number=ANY($1::text[])`,[[...latest.keys()]])).filter(t=>!locals.has(t.id)).map(t=>t.ticket_number)):new Set<string>();
  let outsideMonthSkipped=0;
  const assignments:Array<{index:number;id:string}>=[],seen=new Set<string>();
  const skipped=new Set<number>();
  for(const row of rows){
   const ticket=row.values.ticket_number.trim();
   if(outsideMonth.has(ticket)){outsideMonthSkipped++;skipped.add(row.index);continue;}
   const month=recordMonth(row.values[dateKey]||locals.get(row.id)?.values[dateKey]||'');
   if(!month)throw new BadRequestException(`Row ${row.index+1} has no valid controller Date. Use YYYY-MM-DD, DD/MM/YYYY, or D-MMM (for example, 1-Sep).`);
   if(month!==c.month_key){if(byId.has(row.id))throw new ConflictException('A synchronized row moved to another month. Review its Date and configuration before retrying.');skipped.add(row.index);continue;}
   const existingId=delivery?existingByTicket.get(ticket):undefined;
   if(existingId&&row.id!==existingId&&!locals.has(row.id)&&!byId.has(row.id)){
    row.id=existingId;assignments.push({index:row.index,id:row.id});
   }
   if(existingId&&row.id!==existingId)throw new ConflictException(`Sheet row ${row.index+1} has an identifier linked to a different ticket. Review ticket ${ticket} before retrying.`);
   if(!row.id){
    const candidates=[...locals].filter(([,l])=>!!row.values.ticket_number?.trim()&&l.values.ticket_number?.trim()===row.values.ticket_number.trim()&&gridDate(l.values[dateKey],false)===gridDate(row.values[dateKey],false));
    if(candidates.length>1)throw new BadRequestException('Multiple existing records match ticket '+row.values.ticket_number+'. Review identity before import.');
    row.id=candidates[0]?.[0]||randomUUID();assignments.push({index:row.index,id:row.id});
   }
   uuid(row.id);if(seen.has(row.id))throw new BadRequestException('Duplicate Google record identifier: '+row.id);seen.add(row.id);
  }
  if(assignments.length){
   await sheet.identify(assignments);
   const verified=await reader.read(c.spreadsheet_id,c.tab_name,fields,snapshots.length===0);
   for(const a of assignments){const expected=rows.find(r=>r.id===a.id),actual=verified.rows.find(r=>r.id===a.id&&r.index===a.index);if(actual)normalize(actual.values);if(!expected||!actual||!sameValues(expected.values,actual.values))throw new ConflictException('Identity review: sheet changed while assigning record identifiers. No operational data was imported.');}
  }
  const columns:SyncColumn[]=[...sheet.columns,...(c.columns as SyncColumn[]).filter(old=>!sheet.columns.some(x=>x.id===old.id)).map(old=>({...old,active:false}))];
  // Column metadata changes never remove historical operational values.
  if(JSON.stringify(columns)!==JSON.stringify(c.columns))await db.query('UPDATE sheet_configurations SET columns=$2 WHERE id=$1',[c.id,JSON.stringify(columns)]);
  let changed=0;
  for(const row of rows){
   if(skipped.has(row.index)||!seen.has(row.id))continue;
   const snapshot=byId.get(row.id),local=locals.get(row.id);
   if(!snapshot&&local&&(local.values.ticket_number?.trim()!==row.values.ticket_number?.trim()||!delivery&&gridDate(local.values[dateKey],false)!==gridDate(row.values[dateKey],false)))throw new ConflictException('Initial record identifier does not match its existing ticket and Date. Review identifiers before importing.');
   if(snapshot&&sameValues(snapshot.remote_values,row.values))continue;
   const base=snapshot?.remote_values||row.values,merged=snapshot&&local?mergeCells(base,local.values,row.values).merged:{...local?.values,...row.values};
   // Record a recoverable proposal before applying a conflicting Google value.
   if(local&&!sameValues(local.values,merged))await this.propose(c.id,row.id,base,local.values);
   await db.transaction(async tx=>{
    const table=delivery?'assurance_tickets':'service_assurance_rows';
    if(!delivery)await tx.query('SELECT id FROM projects WHERE id=$1 FOR UPDATE',[c.project_id]);
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[row.id]);
    const [current]=await tx.query(`SELECT id,project_id,version FROM ${table} WHERE id=$1 FOR UPDATE`,[row.id]);
    if(current&&(current.project_id!==c.project_id||!local))throw new ConflictException('Record identifier belongs to a different project or month; review the sheet identifier');
    if((current?.version??null)!==(local?.record.version??null))throw new ConflictException('A controller edited this row during synchronization. Retry preserves both changes.');
    const body={id:row.id,project_id:c.project_id,base_version:current?.version??null,mutation_id:randomUUID(),values:merged};
    if(!local||!sameValues(local.values,merged)){
     if(delivery)await new ServiceDelivery(tx).saveOrder(body,actor,{sheetImport:true});else await new ServiceAssurance(tx).save(body,actor,{sheetImport:true});
     changed++;
    }
    await tx.query(`UPDATE sheet_sync_proposals SET status='superseded' WHERE configuration_id=$1 AND record_id=$2 AND status<>'superseded' AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(proposed_values) p WHERE p.value IS DISTINCT FROM base_values->>p.key AND p.value IS DISTINCT FROM $3::jsonb->>p.key)`,[c.id,row.id,JSON.stringify(row.values)]);
    await tx.query(`INSERT INTO sheet_sync_records(configuration_id,record_id,remote_values,last_local_values) VALUES($1,$2,$3,$4) ON CONFLICT(configuration_id,record_id) DO UPDATE SET remote_values=EXCLUDED.remote_values,last_local_values=EXCLUDED.last_local_values,remote_deleted=false,updated_at=now()`,[c.id,row.id,JSON.stringify(row.values),JSON.stringify(merged)]);
   });
  }
  for(const old of snapshots)if(!seen.has(old.record_id))await db.query('UPDATE sheet_sync_records SET remote_deleted=true,updated_at=now() WHERE configuration_id=$1 AND record_id=$2 AND NOT remote_deleted',[c.id,old.record_id]);
  await this.proposals(c,locals,byId);
  // Store the version observed before reads. Metadata writes cause one extra scan, never missed updates.
  await db.query('UPDATE sheet_configurations SET remote_revision=$2 WHERE id=$1',[c.id,String(revision.version)]);
  return {status:'synchronized',records:changed,duplicates_skipped:duplicates,existing_outside_month_skipped:outsideMonthSkipped,missing_preserved:snapshots.filter(s=>!seen.has(s.record_id)).length};
 }
 private async propose(configuration:string,record:string,base:Values,values:Values){
  await db.query(`INSERT INTO sheet_sync_proposals(configuration_id,record_id,base_values,proposed_values,fingerprint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(configuration_id,record_id,fingerprint) DO NOTHING`,[configuration,record,JSON.stringify(base),JSON.stringify(values),fingerprint({base,values})]);
 }
 private async proposals(c:any,locals:Map<string,{record:any;values:Values}>,snapshots:Map<any,any>){
  for(const [id,local] of locals){const snapshot=snapshots.get(id);if(!snapshot||!sameValues(local.values,snapshot.last_local_values))await this.propose(c.id,id,snapshot?.remote_values||{},local.values);}
 }
}
