import 'server-only';
import {randomUUID} from 'node:crypto';
import {Database} from '@/lib/db';
import {uuid} from '@/lib/api';
import {BadRequestException,ConflictException} from '@/lib/http';
import {isPieceUnit} from '@/lib/inventory-units';

// Include today's balance and any later reductions; future receipts are not available today.
const balanceSql=`SELECT min(balance) AS available FROM (
 SELECT day,sum(delta) OVER (ORDER BY day) AS balance FROM (
  SELECT entry_date AS day,sum(CASE WHEN kind IN ('used','faulty') THEN -quantity ELSE quantity END) AS delta
  FROM inventory_entries WHERE material_id=$1 GROUP BY entry_date
  UNION ALL SELECT $2::date,0
 ) changes
) balances WHERE day >= $2::date`;

export class InventoryRequests{
 constructor(private db:Database){}
 async history(actorId:string){
  return this.db.query(`SELECT e.id,e.created_at,e.reference,e.quantity::float8 AS quantity,
   p.name AS project,m.item_code,m.name,m.unit
   FROM inventory_entries e JOIN inventory_materials m ON m.id=e.material_id
   JOIN projects p ON p.id=m.project_id
   WHERE e.actor_id=$1 AND e.kind='used' AND e.reference LIKE 'inventory-request:%'
   ORDER BY e.created_at DESC,e.id LIMIT 100`,[actorId]);
 }
 async available(projectId:string){
  uuid(projectId);
  const [project]=await this.db.query('SELECT id FROM projects WHERE id=$1 AND is_active',[projectId]);
  if(!project)throw new BadRequestException('Project is unavailable');
  return this.db.query(`SELECT m.id,m.name,m.item_code,m.unit,GREATEST(0,b.available)::float8 AS available
   FROM inventory_materials m CROSS JOIN LATERAL (
    ${balanceSql.replace('material_id=$1','material_id=m.id').replaceAll('$2::date',"(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bahrain')::date")}
   ) b WHERE m.project_id=$1 AND b.available>0 ORDER BY m.name,m.id`,[projectId]);
 }
 async deduct(body:any,actorId:string){
  if(!body||!Array.isArray(body.items)||!body.items.length||body.items.length>100)throw new BadRequestException('Choose between 1 and 100 items');
  const projectId=uuid(body.project_id).toLowerCase(),requestId=uuid(body.request_id).toLowerCase();
  const items=body.items.map((item:any)=>{
   const id=uuid(item?.material_id).toLowerCase(),quantity=item?.quantity;
   // Validate precision first; whole-piece validation uses the locked material below.
   if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<=0||quantity>=1e12||!/^\d+(\.\d{1,4})?$/.test(String(quantity)))throw new BadRequestException('Quantity must be positive with up to four decimal places');
   return {id,quantity};
  }).sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id));
  if(new Set(items.map((i:{id:string})=>i.id)).size!==items.length)throw new BadRequestException('Choose each inventory item only once');
  return this.db.transaction(async tx=>{
   const reference=`inventory-request:${requestId}`;
   await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[reference]);
   const previous=await tx.query(`SELECT e.material_id,e.quantity,e.actor_id,m.project_id FROM inventory_entries e
    JOIN inventory_materials m ON m.id=e.material_id WHERE e.reference=$1 AND e.kind='used' ORDER BY e.material_id`,[reference]);
   if(previous.length){
    if(previous.length!==items.length||previous.some((p:any,i:number)=>p.actor_id!==actorId||p.project_id!==projectId||p.material_id!==items[i].id||Number(p.quantity)!==items[i].quantity))throw new ConflictException('This request ID has already been used for different items');
    return {request_id:requestId};
   }
   const [project]=await tx.query('SELECT id FROM projects WHERE id=$1 AND is_active FOR SHARE',[projectId]);
   if(!project)throw new BadRequestException('Project is unavailable');
   // Same material lock as controller receipts/faulty entries. Stable order avoids batch deadlocks.
   const materials=await tx.query('SELECT id,name,unit FROM inventory_materials WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[projectId,items.map((i:{id:string})=>i.id)]);
   if(materials.length!==items.length)throw new BadRequestException('An inventory item does not belong to the selected project');
   const [{date}]=await tx.query("SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bahrain','YYYY-MM-DD') AS date");
   for(const item of items){
    if(isPieceUnit(materials.find((m:any)=>m.id===item.id).unit)&&!Number.isInteger(item.quantity))throw new BadRequestException('Quantity(Piece/s) must be a whole number');
    const [stock]=await tx.query(`SELECT available::text,available >= $3::numeric AS sufficient FROM (${balanceSql}) stock`,[item.id,date,item.quantity]);
    if(!stock.sufficient)throw new BadRequestException(`Insufficient stock for ${materials.find((m:any)=>m.id===item.id).name}. Available: ${stock.available}`);
   }
   for(const item of items)await tx.query(`INSERT INTO inventory_entries(material_id,kind,quantity,entry_date,reference,actor_id,mutation_id)
    VALUES($1,'used',$2,$3,$4,$5,$6)`,[item.id,item.quantity,date,reference,actorId,randomUUID()]);
   return {request_id:requestId};
  });
 }
}
