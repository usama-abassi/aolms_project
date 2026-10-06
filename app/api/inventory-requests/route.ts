import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {InventoryRequests} from '@/lib/services/inventory-requests';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const service=new InventoryRequests(db);
export const GET=endpoint(['technician'],({query,actor})=>query.get('history')==='true'?service.history(actor.userId):service.available(query.get('project_id')||''));
export const POST=endpoint(['technician'],async({request,actor})=>service.deduct(await body(request),actor.userId));
