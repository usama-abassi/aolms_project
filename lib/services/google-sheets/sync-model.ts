import {gridDate} from '../assurance-tickets/grid-values';
export type Values=Record<string,string>;
export type SyncColumn={id:string;key:string;label:string;index:number;active:boolean};
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
