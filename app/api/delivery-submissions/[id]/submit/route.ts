import {endpoint} from '@/lib/api';
import {getDeliverySubmissionsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const POST=endpoint(["admin","controller"],async({params})=>getDeliverySubmissionsController().submit(params.id),201);
