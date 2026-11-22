'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {Skeleton,CardSkeleton,ChartSkeleton,FormSkeleton,TableSkeleton} from './Skeleton';

export function SkeletonGate({pending,fallback,children}:{pending:boolean;fallback:ReactNode;children?:ReactNode}){
 const [shown,setShown]=useState(false);
 const visibleAt=useRef(0);
 useEffect(()=>{
  if(pending===shown)return;
  const delay=pending?180:Math.max(0,300-(performance.now()-visibleAt.current));
  const timer=setTimeout(()=>{
   if(pending)visibleAt.current=performance.now();
   setShown(pending);
  },delay);
  return ()=>clearTimeout(timer);
 },[pending,shown]);
 if(pending)return shown?fallback:null;
 // Start permitted page queries and chunk loading while the skeleton completes its dwell.
 return <>{shown&&fallback}<div hidden={shown}>{children}</div></>;
}

export function PageSkeleton(){
 const path=usePathname();
 const isForm=/(?:-form\/|\/profile\/me|\/login$)/.test(path);
 const isDashboard=/(?:dashboard|operations-data|legacy-operations)$/.test(path);
 const isConfiguration=path.endsWith('/configuration');
 const isGrid=path==='/controller/projects';
 return <div role="status" aria-label="Page loading" data-page-skeleton className="space-y-4">
  <Skeleton aria-hidden="true" width="min(14rem, 60%)" height={28}/>
  {isForm?<div aria-hidden="true" className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700 sm:p-6"><FormSkeleton fields={5}/></div>:
   isDashboard?<div aria-hidden="true" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6},(_,i)=><CardSkeleton key={i}/>)}</div><ChartSkeleton height={180}/></div>:
   <div aria-hidden="true" className="space-y-4">
    <div className="flex flex-wrap gap-2"><Skeleton width={116} height={40}/><Skeleton width={144} height={40}/><Skeleton width={88} height={40}/></div>
    {isConfiguration&&<div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"><FormSkeleton fields={2}/></div>}
    <TableSkeleton columns={isGrid?6:4} rows={isGrid?8:5}/>
   </div>}
 </div>;
}

export function RouteSkeleton(){
 return <SkeletonGate pending fallback={<PageSkeleton/>}/>;
}
