import {recordMonth} from '@/lib/services/google-sheets/sync-model';

function monthOf(date:unknown){
 if(typeof date!=='string')return null;
 // PostgreSQL dates can reach the browser as serialized ISO timestamps.
 const iso=/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(date);
 return recordMonth(iso?.[1]??date);
}

export function recordMonths(dates:Iterable<unknown>){
 return [...new Set([...dates].map(monthOf).filter((month):month is string=>!!month))].sort().reverse();
}
export function inRecordMonth(date:unknown,month:string){
 return !month||monthOf(date)===month;
}
