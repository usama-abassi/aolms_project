import {endpoint,body} from '@/lib/api';
import {parseConfiguration} from '@/lib/services/google-sheets/configuration';
import {GoogleSheetsClient} from '@/lib/services/google-sheets/google-client';
export const POST=endpoint(['admin','controller'],async({request})=>{const c=parseConfiguration(await body(request));return new GoogleSheetsClient().validate(c.spreadsheet_id,c.tab_name);});
