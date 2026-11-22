'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

export function DeferredSection({fallback,children}:{fallback:ReactNode;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(!ref.current||typeof IntersectionObserver==='undefined'){setReady(true);return;}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){setReady(true);observer.disconnect();}
  },{rootMargin:'240px'});
  observer.observe(ref.current);
  return ()=>observer.disconnect();
 },[]);
 return <div ref={ref}>{ready?children:fallback}</div>;
}
