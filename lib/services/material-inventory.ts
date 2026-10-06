import 'server-only';
import {Database} from '@/lib/db';
import {BadRequestException, ConflictException} from '@/lib/http';
import {uuid} from '@/lib/api';
import {isPieceUnit} from '@/lib/inventory-units';

function date(value:unknown):string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) throw new BadRequestException('Use a valid date');
 return value;
}
function text(value:unknown,max:number,required=false){
 if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new BadRequestException('Check the material name, unit and reference');
 return value.trim();
}
export class MaterialInventory {
 constructor(private db:Database){}
 private async project(id:string,db=this.db){
  uuid(id);
  const [project]=await db.query("SELECT id FROM projects WHERE id=$1 AND code='SERVICE_ASSURANCE'",[id]);
  // The saved display-name migration maps SERVICE_ASSURANCE to Service Delivery.
  if(!project)throw new BadRequestException('Inventory is available for Service Delivery only');
 }
 async list(projectId:string,month:string){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new BadRequestException('Use a valid month');
  const start=date(month+'-01');
  await this.project(projectId);
  const rows=await this.db.query(`SELECT m.id,m.item_code,m.name,m.unit,
   COALESCE(sum(CASE WHEN e.entry_date < $2::date THEN CASE WHEN e.kind IN ('used','faulty') THEN -e.quantity ELSE e.quantity END
    WHEN e.kind='opening' THEN e.quantity ELSE 0 END),0)::float8 AS opening,
   COALESCE(sum(e.quantity) FILTER (WHERE e.kind='received' AND e.entry_date >= $2::date),0)::float8 AS received,
   COALESCE(sum(e.quantity) FILTER (WHERE e.kind='used' AND e.entry_date >= $2::date),0)::float8 AS used,
   COALESCE(sum(e.quantity) FILTER (WHERE e.kind='faulty' AND e.entry_date >= $2::date),0)::float8 AS faulty,
   COALESCE(sum(CASE WHEN e.kind IN ('used','faulty') THEN -e.quantity ELSE e.quantity END),0)::float8 AS remaining
   FROM inventory_materials m LEFT JOIN inventory_entries e ON e.material_id=m.id AND e.entry_date < ($2::date + interval '1 month')
   WHERE m.project_id=$1 GROUP BY m.id ORDER BY m.source_key NULLS LAST,m.created_at,m.id`,[projectId,start]);
  const history=await this.db.query(`SELECT e.id,m.item_code,m.name,m.unit,e.kind,e.quantity::float8 AS quantity,to_char(e.entry_date,'YYYY-MM-DD') AS date,e.reference
   FROM inventory_entries e JOIN inventory_materials m ON m.id=e.material_id
   WHERE m.project_id=$1 AND e.entry_date >= $2::date AND e.entry_date < ($2::date + interval '1 month')
   ORDER BY e.entry_date DESC,e.created_at DESC LIMIT 100`,[projectId,start]);
  const requestHistory=await this.db.query(`SELECT e.id,e.created_at,e.quantity::float8 AS quantity,e.reference,
   COALESCE(p.full_name,e.actor_id::text) AS technician,pr.name AS project,m.item_code,m.name,m.unit
   FROM inventory_entries e JOIN inventory_materials m ON m.id=e.material_id
   JOIN projects pr ON pr.id=m.project_id LEFT JOIN profiles p ON p.id=e.actor_id
   WHERE m.project_id=$1 AND e.kind='used' AND e.reference LIKE 'inventory-request:%'
    AND e.entry_date >= $2::date AND e.entry_date < ($2::date + interval '1 month')
   ORDER BY e.created_at DESC,e.id LIMIT 100`,[projectId,start]);
  return {rows,history,requestHistory};
 }
 async create(projectId:string,body:any,actorId:string){
  await this.project(projectId);
  if(!body||typeof body!=='object')throw new BadRequestException('Entry is required');
  if(body.kind==='material'){
   const name=text(body.name,300,true),unit=text(body.unit,40,true),code=text(body.item_code??'',100);
   const [item]=await this.db.query('INSERT INTO inventory_materials(project_id,item_code,name,unit) VALUES($1,$2,$3,$4) RETURNING id',[projectId,code,name,unit]);
   return item;
  }
  const adjustment=body.kind==='adjustment';
  if(adjustment){
   if(!['add','deduct'].includes(body.direction))throw new BadRequestException('Choose add or deduct stock');
   const reason=text(body.reference,480,true);
   body={...body,kind:body.direction==='add'?'received':'used',reference:`Stock correction: ${reason}`};
  }
  if(!adjustment&&!['opening','received','faulty'].includes(body.kind))throw new BadRequestException('Choose opening stock, received or faulty');
  const materialId=uuid(body.material_id),mutationId=uuid(body.mutation_id),entryDate=date(body.date);
  if(typeof body.quantity!=='number'||!Number.isFinite(body.quantity)||body.quantity<=0||body.quantity>=1e12||Math.abs(body.quantity*10000-Math.round(body.quantity*10000))>0.01)throw new BadRequestException('Quantity must be positive with up to four decimal places');
  const reference=text(body.reference??'',500);
  return this.db.transaction(async tx=>{
   const [material]=await tx.query('SELECT id,unit FROM inventory_materials WHERE id=$1 AND project_id=$2 FOR UPDATE',[materialId,projectId]);
   if(!material)throw new BadRequestException('Material does not belong to this project');
   const [previous]=await tx.query('SELECT *,to_char(entry_date,\'YYYY-MM-DD\') AS date FROM inventory_entries WHERE mutation_id=$1',[mutationId]);
   if(previous){
    if(previous.material_id!==materialId||previous.kind!==body.kind||Number(previous.quantity)!==body.quantity||previous.actor_id!==actorId||previous.reference!==reference||previous.date!==entryDate)throw new ConflictException('This request ID has already been used');
    return {id:previous.id};
   }
   if(isPieceUnit(material.unit)&&!Number.isInteger(body.quantity))throw new BadRequestException('Quantity(Piece/s) must be a whole number');
   if(body.kind==='opening'){
    const [exists]=await tx.query('SELECT id FROM inventory_entries WHERE material_id=$1 LIMIT 1',[materialId]);
    if(exists)throw new ConflictException('Opening stock must be the first entry for a material. Record additional stock as received.');
   }else{
    const [opening]=await tx.query("SELECT to_char(entry_date,'YYYY-MM-DD') AS date FROM inventory_entries WHERE material_id=$1 AND kind='opening'",[materialId]);
    if(opening&&entryDate<opening.date)throw new BadRequestException('Entry date cannot precede opening stock');
   }
   if(body.kind==='faulty'||body.kind==='used'){
    const [balance]=await tx.query(`SELECT min(balance)::float8 AS minimum FROM (
     SELECT sum(delta) OVER (ORDER BY day) AS balance,day FROM (
      SELECT entry_date AS day,sum(CASE WHEN kind IN ('used','faulty') THEN -quantity ELSE quantity END) AS delta
      FROM inventory_entries WHERE material_id=$1 GROUP BY entry_date
      UNION ALL SELECT $2::date,0
     ) d
    ) b WHERE day >= $2::date`,[materialId,entryDate]);
    if(Number(balance.minimum)<body.quantity)throw new BadRequestException('Deduction exceeds available stock on this or a later date');
   }
   const [entry]=await tx.query('INSERT INTO inventory_entries(material_id,kind,quantity,entry_date,reference,actor_id,mutation_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[materialId,body.kind,body.quantity,entryDate,reference,actorId,mutationId]);
   return entry;
  });
 }
}
