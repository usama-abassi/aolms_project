import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {MaterialInventory} from '@/lib/services/material-inventory';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const inventory=new MaterialInventory(db);
export const GET=endpoint(['admin','controller'],({params,query})=>inventory.list(params.projectId,query.get('month')||''));
export const POST=endpoint(['admin','controller'],async({params,request,actor})=>inventory.create(params.projectId,await body(request),actor.userId),201);
