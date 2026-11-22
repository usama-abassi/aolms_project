import {endpoint,body} from '@/lib/api';
import {getOrderAssignmentsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=endpoint(["admin","controller"],async({params})=>getOrderAssignmentsController().findOne(params.id),200);
export const PATCH=endpoint(["admin","controller"],async({request,params})=>getOrderAssignmentsController().update(params.id,await body(request)),200);
export const DELETE=endpoint(["admin"],async({params})=>getOrderAssignmentsController().remove(params.id),200);
