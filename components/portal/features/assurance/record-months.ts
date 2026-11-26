import {recordMonth} from '@/lib/services/google-sheets/sync-model';

export function recordMonths(dates:Iterable<unknown>){
 return [...new Set([...dates].map(date=>typeof date==='string'?recordMonth(date):null).filter((month):month is string=>!!month))].sort().reverse();
}
export function inRecordMonth(date:unknown,month:string){
 return !month||(typeof date==='string'&&recordMonth(date)===month);
}
