import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceAssurance} from '@/lib/services/service-assurance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Every submitted Assurance row already retains its raw text; no separate server draft is needed.
export const GET=endpoint(['controller','admin'],()=>[]);
export const POST=endpoint(['controller','admin'],async({request,actor})=>new ServiceAssurance(db).save(await body(request),actor));
