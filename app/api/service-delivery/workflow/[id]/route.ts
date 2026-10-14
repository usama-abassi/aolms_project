import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceDelivery} from '@/lib/services/service-delivery/service';
const service=new ServiceDelivery(db);
export const GET=endpoint(['admin','controller','technician'],async({params,query,actor})=>query.get('mode')==='history'?service.history(params.id,actor):service.form(params.id,actor));
export const POST=endpoint(['technician'],async({params,request,actor})=>service.saveForm(params.id,await body(request),actor));
export const PATCH=endpoint(['admin','controller'],async({params,request,actor})=>service.correct(params.id,await body(request),actor));
