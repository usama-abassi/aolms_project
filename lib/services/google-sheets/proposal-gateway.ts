import 'server-only';
import {ConflictException} from '@/lib/http';
import {SheetReader} from './sheet-reader';
import {controllerFields} from '../service-delivery/model';
import {serviceAssuranceFields} from '@/lib/service-assurance-fields';
import {gridDate} from '../assurance-tickets/grid-values';
import {db} from '@/lib/db';
import {GoogleSheetsClient} from './google-client';
// Existing records use an append-only review tab. New UUID records may append; controller cells are never overwritten.
export async function stageProposals(configuration:any,google=new GoogleSheetsClient()){
 let pending=await db.query("SELECT * FROM sheet_sync_proposals WHERE configuration_id=$1 AND status='pending' ORDER BY created_at,id",[configuration.id]);
 if(!pending.length)return 0;
 await appendNewRecords(configuration,pending,google);
 pending=await db.query("SELECT * FROM sheet_sync_proposals WHERE configuration_id=$1 AND status='pending' ORDER BY created_at,id",[configuration.id]);
 if(!pending.length)return 0;
 const base=`sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(configuration.spreadsheet_id)}`,title='__AOLMS_Proposals';
 if(configuration.tab_name===title)throw new Error('The proposal review tab cannot be configured as a controller data tab');
 const document=await google.request(base+'?fields=sheets.properties');
 if(!document.sheets.some((s:any)=>s.properties.title===title))await google.request(base+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title}}}]})});
 const range=encodeURIComponent("'"+title+"'!A:J");
 const existing=await google.request(base+'/values/'+range);
 const ids=new Set((existing.values||[]).map((r:any[])=>r[0]));
 const rows=pending.flatMap(p=>Object.keys(p.proposed_values).filter(key=>(p.proposed_values[key]??'')!==(p.base_values[key]??'')).map(key=>[p.id+':'+key,p.id,configuration.id,p.record_id,configuration.tab_name,String(configuration.month_key),key,String(p.base_values[key]??''),String(p.proposed_values[key]??''),'Pending review — copy approved values to the controller tab'])).filter(row=>!ids.has(row[0]));
 if(rows.length){
  const values=[...rows];
  if(!existing.values?.length)values.unshift(['Entry ID','Proposal ID','Configuration ID','Record ID','Controller tab','Month','Field','Base Sheet value','AOLMS proposed value','Review']);
  for(let offset=0;offset<values.length;offset+=200)await google.request(base+'/values/'+range+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:values.slice(offset,offset+200)})});
 }
 await db.query("UPDATE sheet_sync_proposals SET status='staged' WHERE id=ANY($1::uuid[])",[pending.map(p=>p.id)]);
 return rows.length;
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
