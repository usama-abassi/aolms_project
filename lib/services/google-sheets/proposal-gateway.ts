import 'server-only';
import {ConflictException} from '@/lib/http';
import {SheetReader} from './sheet-reader';
import {controllerFields} from '../service-delivery/model';
import {serviceAssuranceFields} from '@/lib/service-assurance-fields';
import {controllerDate} from './sync-model';
import {gridDate} from '../assurance-tickets/grid-values';
import {db} from '@/lib/db';
import {GoogleSheetsClient} from './google-client';
// The sync service serializes outbound work per spreadsheet.
export async function applyOutboundChanges(c:any,google=new GoogleSheetsClient()){
 const pending=await db.query("SELECT * FROM sheet_sync_proposals WHERE configuration_id=$1 AND status IN ('pending','staged') ORDER BY created_at,id",[c.id]);
 if(!pending.length)return 0;
 await appendNewRecords(c,pending.filter(p=>p.status==='pending'),google);
 const delivery=c.code==='SERVICE_ASSURANCE';
 const queued=await db.query(`SELECT p.*,s.remote_values,
  ${delivery?"t.spreadsheet_fields->'delivery'":"t.raw_values"} AS current_values
  FROM sheet_sync_proposals p JOIN sheet_sync_records s USING(configuration_id,record_id)
  JOIN ${delivery?'assurance_tickets':'service_assurance_rows'} t ON t.id=p.record_id AND t.project_id=$2
  WHERE p.configuration_id=$1 AND p.status IN ('pending','staged') AND NOT s.remote_deleted
  ORDER BY p.created_at,p.id`,[c.id,c.project_id]);
 if(!queued.length)return 0;
 const sheet=await new SheetReader(google).read(c.spreadsheet_id,c.tab_name,delivery?controllerFields:serviceAssuranceFields,false);
 const teamKey=delivery?'technician_id':'team',dateKey=delivery?'work_date':'date';
 const technicians=await db.query("SELECT id,full_name FROM profiles WHERE role='technician' AND is_active");
 const normalize=(key:string,value:string)=>{
  if(key===dateKey||delivery&&key==='appointment')return controllerDate(value,c.month_key)||value;
  if(key===teamKey&&value.trim()){
   const matches=technicians.filter(t=>t.full_name.trim().toLowerCase()===value.trim().toLowerCase());
   return technicians.find(t=>t.id===value.trim().toLowerCase())?.id??(matches.length===1?matches[0].id:value);
  }
  return value;
 };
 const requests=new Map<string,any>(),completed=[];
 for(const p of queued){
  const matching=sheet.rows.filter(r=>r.id===p.record_id);
  // When a duplicate ticket has several copies of the same ID, the last row is authoritative.
  const row=matching.at(-1);
  if(!row)continue;
  const ticket=row.values.ticket_number?.trim();
  if(ticket&&sheet.rows.some(r=>r.index>row.index&&r.values.ticket_number?.trim()===ticket))continue;
  let resolved=true;
  for(const [key,proposed] of Object.entries(p.proposed_values)){
   const next=String(proposed??''),base=String(p.base_values[key]??'');
   if(next===base||next!==String(p.current_values?.[key]??''))continue;
   const col=sheet.columns.find(x=>x.key===key);
   if(!col){resolved=false;continue;}
   const remote=normalize(key,row.values[key]??'');
   if(remote===next)continue;
   if(remote!==base||String(p.remote_values[key]??'')!==base){resolved=false;continue;}
   const value=key===teamKey?technicians.find(t=>t.id===next)?.full_name??next:next;
   requests.set(`${row.index}:${col.index}`,{updateCells:{start:{sheetId:sheet.sheetId,rowIndex:row.index,columnIndex:col.index},rows:[{values:[value?{userEnteredValue:{stringValue:value}}:{}]}],fields:'userEnteredValue'}});
  }
  if(resolved)completed.push(p.id);
 }
 const base=`sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(c.spreadsheet_id)}`;
 const writes=[...requests.values()];
 for(let i=0;i<writes.length;i+=200)await google.request(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:writes.slice(i,i+200)})});
 if(completed.length)await db.query("UPDATE sheet_sync_proposals SET status='superseded' WHERE id=ANY($1::uuid[])",[completed]);
 return writes.length;
}

async function appendNewRecords(c:any,proposals:any[],google:GoogleSheetsClient){
 const mappings=await db.query('SELECT record_id FROM sheet_sync_records WHERE configuration_id=$1',[c.id]);
 const mapped=new Set(mappings.map(m=>m.record_id));
 const newest=new Map<string,any>();for(const p of proposals)if(!mapped.has(p.record_id))newest.set(p.record_id,p);
 if(!newest.size)return;
 const delivery=c.code==='SERVICE_ASSURANCE',date=delivery?'work_date':'date';
 const sheet=await new SheetReader(google).read(c.spreadsheet_id,c.tab_name,delivery?controllerFields:serviceAssuranceFields,false);
 for(const p of newest.values()){
  if(sheet.rows.some(r=>r.id===p.record_id||!r.id&&r.values.ticket_number?.trim()===p.proposed_values.ticket_number?.trim()&&gridDate(r.values[date]||'',false)===gridDate(p.proposed_values[date]||'',false)))throw new ConflictException('A matching Sheet row appeared before append. Retry to bind its identifier safely.');
 }
 const width=Math.max(sheet.idColumn,...sheet.columns.map(col=>col.index))+1;
 const rows=[...newest.values()].map(p=>{const values=Array.from({length:width},()=>({userEnteredValue:{stringValue:''}}));for(const col of sheet.columns)values[col.index]={userEnteredValue:{stringValue:String(p.proposed_values[col.key]??'')}};values[sheet.idColumn]={userEnteredValue:{stringValue:p.record_id}};return {values};});
 const base=`sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(c.spreadsheet_id)}`;
 // appendCells appends after the last populated row. A lost response is reconciled by UUID on retry.
 await google.request(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendCells:{sheetId:sheet.sheetId,rows,fields:'userEnteredValue'}}]})});
 const verified=await new SheetReader(google).read(c.spreadsheet_id,c.tab_name,delivery?controllerFields:serviceAssuranceFields,false);
 for(const p of newest.values()){
  const remote=verified.rows.find(r=>r.id===p.record_id);
  if(!remote||sheet.columns.some(col=>(remote.values[col.key]??'')!==String(p.proposed_values[col.key]??'')))throw new ConflictException('Appended row requires review: the sheet changed during append. Values remain in the outbound proposal log.');
  await db.transaction(async tx=>{
   await tx.query(`INSERT INTO sheet_sync_records(configuration_id,record_id,remote_values,last_local_values) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[c.id,p.record_id,JSON.stringify(remote.values),JSON.stringify(p.proposed_values)]);
   await tx.query("UPDATE sheet_sync_proposals SET status='superseded' WHERE configuration_id=$1 AND record_id=$2",[c.id,p.record_id]);
  });
 }
}
