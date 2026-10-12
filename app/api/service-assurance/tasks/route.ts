import {endpoint} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceAssurance} from '@/lib/services/service-assurance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=endpoint(['technician'],({actor})=>new ServiceAssurance(db).tasks(actor));
