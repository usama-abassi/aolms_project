import 'server-only';
import {BadRequestException,ConflictException,NotFoundException} from '@/lib/http';
import {uuid} from '@/lib/api';
import {type Database} from '@/lib/db';
import {type Actor} from '@/lib/auth';
export function parseConfiguration(input:any){
 if(!input||typeof input!=='object')throw new BadRequestException('Configuration is required');
 const project_id=uuid(input.project_id);
 if(typeof input.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)||input.month.startsWith('0000'))throw new BadRequestException('Select a valid month');
 let url:URL;try{url=new URL(input.sheet_url);}catch{throw new BadRequestException('Enter a Google Sheets URL');}
 const match=url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
 if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.port||url.username||url.password||!match)throw new BadRequestException('Enter an https://docs.google.com/spreadsheets/d/... URL');
 if(typeof input.tab_name!=='string'||!input.tab_name.trim()||input.tab_name.length>100)throw new BadRequestException('Exact tab name is required (up to 100 characters)');
 return {project_id,month:input.month+'-01',spreadsheet_id:match[1],sheet_url:`https://docs.google.com/spreadsheets/d/${match[1]}/edit`,tab_name:input.tab_name};
}
export class SheetConfigurations{
 constructor(private db:Database){}
 async list(){return this.db.query(`SELECT c.*,p.name project_name,to_char(c.month,'YYYY-MM') month_key,(SELECT count(*)::int FROM sheet_sync_proposals sp WHERE sp.configuration_id=c.id AND sp.status IN ('pending','staged')) pending_changes FROM sheet_configurations c JOIN projects p ON p.id=c.project_id WHERE c.deleted_at IS NULL ORDER BY c.month DESC,p.name`);}
 async save(input:any,actor:Actor){
 const c=parseConfiguration(input);const id=input.id?uuid(input.id):null;
 if(id&&(!Number.isInteger(input.version)||input.version<1))throw new BadRequestException('Configuration version is required');
 try{return await this.db.transaction(async tx=>{
  if(id){
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['configuration:'+id]);
   const [old]=await tx.query('SELECT * FROM sheet_configurations WHERE id=$1',[id]);
   if(old&&(old.project_id!==c.project_id||String(old.spreadsheet_id)!==c.spreadsheet_id||old.tab_name!==c.tab_name||String(old.month instanceof Date?old.month.toISOString().slice(0,10):old.month).slice(0,10)!==c.month)){
    const [mapped]=await tx.query('SELECT 1 FROM sheet_sync_records WHERE configuration_id=$1 LIMIT 1',[id]);
    if(mapped)throw new ConflictException('This configuration has synchronized records. Remove the configuration and create a replacement to change its project, month, spreadsheet or tab; operational records are retained.');
   }
  }
  const [project]=await tx.query('SELECT id FROM projects WHERE id=$1',[c.project_id]);if(!project)throw new BadRequestException('Project not found');
  const values=[c.project_id,c.month,c.spreadsheet_id,c.sheet_url,c.tab_name];
  const [row]=id?await tx.query(`UPDATE sheet_configurations SET project_id=$1,month=$2,spreadsheet_id=$3,sheet_url=$4,tab_name=$5,version=version+1,updated_at=now(),sync_status='not_started',latest_error=NULL,last_success_at=NULL,last_attempt_at=NULL WHERE id=$6 AND version=$7 AND deleted_at IS NULL RETURNING *`,[...values,id,input.version]):await tx.query(`INSERT INTO sheet_configurations(project_id,month,spreadsheet_id,sheet_url,tab_name,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[...values,actor.userId]);
  if(!row)throw new ConflictException('Configuration changed. Reload before editing.');return row;
 });}catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException('This project already has a configuration for this month');throw error;}
 }
 async remove(id:string,version:unknown){if(!Number.isInteger(version))throw new BadRequestException('Configuration version is required');return this.db.transaction(async tx=>{uuid(id);await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['configuration:'+id]);const rows=await tx.query("UPDATE sheet_configurations SET deleted_at=now(),sync_status='disabled',version=version+1 WHERE id=$1 AND version=$2 AND deleted_at IS NULL RETURNING id",[id,version]);if(!rows.length)throw new NotFoundException('Configuration changed or was already removed');return {deleted:true};});}
}
