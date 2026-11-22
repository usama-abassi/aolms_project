import {endpoint,body} from '@/lib/api';
import {getDeliverySubmissionsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=endpoint(["admin","controller"],async({params})=>getDeliverySubmissionsController().findOneByOrderId(params.id),200);
export const PATCH=endpoint(["admin","controller"],async({request,params})=>getDeliverySubmissionsController().update(params.id,await body(request)),200);
export const DELETE=endpoint(["admin"],async({params})=>getDeliverySubmissionsController().remove(params.id),200);
