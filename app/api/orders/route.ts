import {endpoint,body} from '@/lib/api';
import {getOrdersController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const POST=endpoint(["admin","controller"],async({request})=>getOrdersController().create(await body(request)),201);
export const GET=endpoint(["admin","controller"],async({query})=>getOrdersController().findAll(query.get('project_id') ?? undefined,query.get('technician_id') ?? undefined,query.get('work_date') ?? undefined),200);
