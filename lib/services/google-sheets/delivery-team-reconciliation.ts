import 'server-only';
import {db} from '@/lib/db';

// Leave assigned orders untouched, and only resolve names shared by exactly one active account.
export const reconcileDeliveryTeamsSql=`
 WITH unique_names AS (
  SELECT lower(trim(full_name)) AS name,(array_agg(id))[1] AS technician_id
  FROM profiles
  WHERE role='technician' AND is_active AND trim(full_name)<>''
  GROUP BY lower(trim(full_name)) HAVING count(*)=1
 ), candidates AS (
  SELECT t.id,n.technician_id,t.spreadsheet_fields->'delivery'->>'technician_id' AS source_team,to_jsonb(t) AS before
  FROM assurance_tickets t JOIN unique_names n ON n.name=lower(trim(t.spreadsheet_fields->'delivery'->>'technician_id'))
  WHERE t.project_id=$1 AND t.work_date >= $2::date AND t.work_date < ($2::date+interval '1 month')
   AND t.technician_id IS NULL
  FOR UPDATE OF t
 ), updated AS (
  UPDATE assurance_tickets t
  SET technician_id=c.technician_id,
   spreadsheet_fields=jsonb_set(t.spreadsheet_fields,'{delivery,technician_id}',to_jsonb(c.technician_id::text)),
   version=t.version+1,updated_at=clock_timestamp()
  FROM candidates c WHERE t.id=c.id
  RETURNING t.id,t.technician_id,c.source_team,c.before,to_jsonb(t) AS after
 ), audited AS (
  INSERT INTO audit_logs(user_id,table_name,record_id,action,old_values,new_values)
  SELECT $3,'assurance_tickets',id,'update',before,after FROM updated
 ), snapshots AS (
  UPDATE sheet_sync_records s
  SET last_local_values=jsonb_set(s.last_local_values,'{technician_id}',to_jsonb(u.technician_id::text)),
   updated_at=clock_timestamp()
  FROM updated u WHERE s.configuration_id=$4 AND s.record_id=u.id
   AND s.last_local_values->>'technician_id'=u.source_team
 )
 SELECT count(*)::int AS assigned FROM updated
`;

export async function reconcileDeliveryTeams(projectId:string,month:string,actorId:string,configurationId:string){
 const [result]=await db.query(reconcileDeliveryTeamsSql,[projectId,month+'-01',actorId,configurationId]);
 return result.assigned as number;
}
