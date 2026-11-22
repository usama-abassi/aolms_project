'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import React from 'react';
import {usePathname} from 'next/navigation';
import {ClientRedirect} from '@/components/ClientRedirect';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-browser';

export const ProtectedRoute: React.FC<{children:React.ReactNode}> = ({children}) => {
 const pathname=usePathname();
 const access=useQuery({queryKey:['route-access',pathname],staleTime:0,queryFn:async()=>{
  const {data}=await supabase!.auth.getUser();if(!data.user)return null;
  const {data:profile,error}=await supabase!.from('profiles').select('role,is_active').eq('id',data.user.id).single();
  if(error||!profile?.is_active)return null;
  return profile.role as string;
 }});
 if(access.isPending)return <LoadingState message="Checking access…"/>;
 if(!access.data || access.error || pathname.split('/')[1]!==access.data)return <ClientRedirect href="/login"/>;
 return <>{children}</>;
};
