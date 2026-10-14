import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceDelivery} from '@/lib/services/service-delivery/service';
import {translateDatabaseError} from '@/lib/services/assurance-tickets/assurance-tickets.service';
const service=new ServiceDelivery(db);
export const GET=endpoint(['admin','controller'],async({query,actor})=>query.get('mode')==='metadata'?service.metadata(actor):query.get('mode')==='audit'?service.audit(query.get('project_id')||'',actor):service.list(query.get('project_id')||'',actor));
export const POST=endpoint(['admin','controller'],async({request,actor})=>service.saveOrder(await body(request),actor).catch(translateDatabaseError));
