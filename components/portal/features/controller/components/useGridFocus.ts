'use client';
import {useLayoutEffect,useState,type RefObject} from 'react';

// Focus after React has committed new rows/pages, before the next keyboard event.
export function useGridFocus(table:RefObject<HTMLTableElement|null>){
 const [target,setTarget]=useState<{row:number;col:number}|null>(null);
 useLayoutEffect(()=>{if(target)table.current?.querySelector<HTMLElement>(`[data-cell="${target.row}:${target.col}"]`)?.focus();},[target,table]);
 return (row:number,col:number)=>setTarget({row,col});
}
