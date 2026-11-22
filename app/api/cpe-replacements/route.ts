import {endpoint} from '@/lib/api';
import {getCpeReplacementsController} from '@/lib/services/registry';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=endpoint(["admin","controller"],async()=>getCpeReplacementsController().findAll(),200);
