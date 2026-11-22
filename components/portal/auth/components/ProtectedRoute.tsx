'use client';
import {PageSkeleton,SkeletonGate} from '@/components/portal/components/PageSkeleton';
import React from 'react';
import {usePathname} from 'next/navigation';
import {ClientRedirect} from '@/components/ClientRedirect';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import {warmRoute} from '../route-warmup';
import {api} from '@/components/portal/features/assurance/api';
import { supabase } from '@/lib/supabase-browser';

// These reads are authorized by the API independently of the client-side guard.
const initialProjectQueries:Record<string,string>={
 '/controller/projects':'controller-projects',
 '/controller/inventory':'controller-projects',
 '/technician/projects':'technician-projects',
 '/admin/audit':'admin-assurance-projects',
};

export const ProtectedRoute: React.FC<{children:React.ReactNode}> = ({children}) => {
 const pathname=usePathname();
 const client=useQueryClient();
 const access=useQuery({queryKey:['route-access'],staleTime:60_000,refetchInterval:60_000,retry:false,queryFn:async()=>{
  const {data}=await supabase!.auth.getUser();if(!data.user)return null;
  const {data:profile,error}=await supabase!.from('profiles').select('role,is_active').eq('id',data.user.id).single();
  if(error||!profile?.is_active)return null;
  return {role:String(profile.role),userId:data.user.id};
 }});
 React.useEffect(()=>{
  warmRoute(pathname);
  const key=initialProjectQueries[pathname];
  if(!key||!supabase)return;
  void client.prefetchQuery({queryKey:[key],queryFn:({signal})=>api('/projects',{signal}),staleTime:30_000,retry:false});
 },[client,pathname]);
 const userId=access.data?.userId;
 React.useEffect(()=>{
  if(!userId||!supabase)return;
  const channel=supabase.channel('access-profile:'+userId).on('postgres_changes',
   {event:'*',schema:'public',table:'profiles',filter:`id=eq.${userId}`},
   ()=>{void client.resetQueries({queryKey:['route-access']});}).subscribe();
  return ()=>{void supabase?.removeChannel(channel);};
 },[userId,client]);
 if(!access.isPending&&(!access.data||access.error||pathname.split('/')[1]!==access.data.role))return <ClientRedirect href="/login"/>;
 return <SkeletonGate pending={access.isPending} fallback={<PageSkeleton/>}>{children}</SkeletonGate>;
};
