import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {DeliveryGridService} from '@/lib/services/assurance-tickets/delivery-grid.service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const service=new DeliveryGridService(db);
export const GET=endpoint(['admin','controller'],({query,actor})=>service.list(query.get('project_id')||'',actor));
export const POST=endpoint(['admin','controller'],async({request,actor})=>service.save(await body(request),actor));
