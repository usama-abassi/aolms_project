import {gridDate} from '../assurance-tickets/grid-values';
export type Values=Record<string,string>;
export type SyncColumn={id:string;key:string;label:string;index:number;active:boolean};
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function controllerDate(value:string,configuredMonth:string){
 const full=gridDate(value,false);
 if(full)return full;
 const short=/^(\d{1,2})-([a-z]{3})$/i.exec(value.trim());
 if(!short||!/^\d{4}-(0[1-9]|1[0-2])$/.test(configuredMonth))return null;
 const month=months.findIndex(name=>name.toLowerCase()===short[2].toLowerCase())+1;
 return month?gridDate(`${configuredMonth.slice(0,4)}-${month}-${short[1]}`,false):null;
}
export function displayControllerDate(value:string){
 const date=gridDate(value,false);
 return date?`${Number(date.slice(8))}-${months[Number(date.slice(5,7))-1]}`:value;
}
export function recordMonth(value:string){if(typeof value!=='string')return null;const normalized=gridDate(value,false);if(!normalized)return null;return normalized.slice(0,7);}
// Only changed remote cells take precedence; local-only changes remain available as proposals.
export function mergeCells(base:Values,local:Values,remote:Values){
 const merged={...local},proposed:Values={},conflicts:string[]=[];
 for(const key of Object.keys(remote)){
  const before=base[key]??'',ours=local[key]??'',theirs=remote[key]??'';
  if(theirs!==before){merged[key]=theirs;if(ours!==before&&ours!==theirs)conflicts.push(key);}
  else if(ours!==theirs)proposed[key]=ours;
 }
 return {merged,proposed,conflicts};
}
export function sameValues(a:Values,b:Values){const keys=new Set([...Object.keys(a),...Object.keys(b)]);return [...keys].every(k=>(a[k]??'')===(b[k]??''));}
