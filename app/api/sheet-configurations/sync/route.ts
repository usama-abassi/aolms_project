import {endpoint,body} from '@/lib/api';
import {SheetSyncService} from '@/lib/services/google-sheets/sync-service';
export const maxDuration=300;
export const POST=endpoint(['admin','controller'],async({request,actor})=>new SheetSyncService().run((await body(request)).id,actor));
