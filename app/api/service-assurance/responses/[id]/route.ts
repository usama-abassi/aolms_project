import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceAssurance} from '@/lib/services/service-assurance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=endpoint(['technician'],({params,actor})=>new ServiceAssurance(db).form(params.id,actor));
export const POST=endpoint(['technician'],async({params,request,actor})=>new ServiceAssurance(db).submit(params.id,await body(request),actor),201);
