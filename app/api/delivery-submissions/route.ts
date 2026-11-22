import {endpoint,body} from '@/lib/api';
import {getDeliverySubmissionsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const POST=endpoint(["admin","controller"],async({request})=>getDeliverySubmissionsController().create(await body(request)),201);
