import {endpoint} from '@/lib/api';
import {getAttachmentsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=endpoint(["admin","controller"],async()=>getAttachmentsController().findAll(),200);
