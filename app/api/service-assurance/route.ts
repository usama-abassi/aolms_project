import {endpoint} from '@/lib/api';
import {db} from '@/lib/db';
import {ServiceAssurance} from '@/lib/services/service-assurance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=endpoint(['controller','admin'],({query})=>new ServiceAssurance(db).list(query.get('project_id')||''));
