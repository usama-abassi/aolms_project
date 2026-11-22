import {endpoint,body} from '@/lib/api';
import {getOrdersController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=endpoint(["admin","controller"],async({params})=>getOrdersController().findOne(params.id),200);
export const PATCH=endpoint(["admin","controller"],async({request,params})=>getOrdersController().update(params.id,await body(request)),200);
export const DELETE=endpoint(["admin"],async({params})=>getOrdersController().remove(params.id),200);
