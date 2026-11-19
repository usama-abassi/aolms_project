import {endpoint,body} from '@/lib/api';
import {db} from '@/lib/db';
import {GoogleSheetsClient} from '@/lib/services/google-sheets/google-client';
import {parseConfiguration} from '@/lib/services/google-sheets/configuration';
import {SheetConfigurations} from '@/lib/services/google-sheets/configuration';
const service=new SheetConfigurations(db);
export const GET=endpoint(['admin','controller'],()=>service.list());
export const POST=endpoint(['admin','controller'],async({request,actor})=>{const input=await body(request),c=parseConfiguration(input);await new GoogleSheetsClient().validate(c.spreadsheet_id,c.tab_name);return service.save(input,actor);});
export const DELETE=endpoint(['admin','controller'],async({request})=>{const input=await body(request);return service.remove(input.id,input.version);});
