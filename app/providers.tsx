'use client';
import {useEffect,useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '@/components/portal/app/theme/theme-context';
import {supabase} from '@/lib/supabase-browser';
export function Providers({children}:{children:React.ReactNode}){
 const [client]=useState(()=>new QueryClient());
 useEffect(()=>{
  let previous:string|null|undefined;
  const subscription=supabase?.auth.onAuthStateChange((event,session)=>{
   const id=session?.user.id??null;if(event==='SIGNED_OUT'||previous!==undefined&&previous!==id)client.clear();else if(event==='USER_UPDATED')void client.resetQueries({queryKey:['route-access']});previous=id;
  });
  return ()=>subscription?.data.subscription.unsubscribe();
 },[client]);
 return <QueryClientProvider client={client}><ThemeProvider>{children}</ThemeProvider></QueryClientProvider>;
}
