import {after} from 'next/server';
import {db} from '@/lib/db';
import {SheetSyncService} from '@/lib/services/google-sheets/sync-service';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({message:'Unauthorized'},{status:401});
 after(syncConfiguredSheets);
 return Response.json({status:'accepted'},{status:202,headers:{'Cache-Control':'no-store'}});
}

async function syncConfiguredSheets(){
 const configurations=await db.query(`SELECT c.id,c.spreadsheet_id,c.created_by,p.role,p.is_active FROM sheet_configurations c JOIN profiles p ON p.id=c.created_by WHERE c.deleted_at IS NULL ORDER BY c.last_attempt_at NULLS FIRST,c.id`);
 const groups=new Map<string,typeof configurations>();
 for(const c of configurations){
  const group=groups.get(c.spreadsheet_id)??[];
  group.push(c);groups.set(c.spreadsheet_id,group);
 }
 const remaining=[...groups.values()].values();
 // Each sync needs one connection for advisory locks and another for queries.
 const workers=Number(process.env.DATABASE_POOL_MAX||4)>=4?2:1;
 await Promise.all(Array.from({length:Math.min(workers,groups.size)},async()=>{
  for(const group of remaining)for(const c of group){try{
   if(!c.is_active||!['admin','controller'].includes(c.role))throw new Error('Configuration owner is no longer an active authorized manager');
   await new SheetSyncService().run(c.id,{userId:c.created_by,role:c.role});
  }catch(e){const message=e instanceof Error?e.message:'Synchronization failed';await db.query("UPDATE sheet_configurations SET sync_status='error',latest_error=$2,last_attempt_at=now() WHERE id=$1 AND sync_status<>'review_required'",[c.id,message]);}}
 }));
}
