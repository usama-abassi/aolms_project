import {endpoint} from '@/lib/api';
import {googleAccount} from '@/lib/services/google-sheets/google-account';
export const GET=endpoint(['admin','controller'],({actor})=>googleAccount.status(actor));
export const DELETE=endpoint(['admin','controller'],({actor})=>googleAccount.remove(actor));
