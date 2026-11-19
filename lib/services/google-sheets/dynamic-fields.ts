import 'server-only';
import {type Database} from '@/lib/db';
import {recordMonth,type SyncColumn} from './sync-model';
export async function dynamicKeys(db:Database,project:string,date:string){
 const month=recordMonth(typeof date==='string'?date:'');if(!month)return [];
 const rows=await db.query('SELECT columns FROM sheet_configurations WHERE project_id=$1 AND month=$2 AND deleted_at IS NULL',[project,month+'-01']);
 return ((rows[0]?.columns||[]) as SyncColumn[]).filter(c=>c.active&&/^sheet_[a-f0-9]{32}$/.test(c.key)).map(c=>c.key);
}
