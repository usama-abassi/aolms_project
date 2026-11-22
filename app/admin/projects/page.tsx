'use client';
import dynamic from 'next/dynamic';
import {RouteSkeleton} from '@/components/portal/components/PageSkeleton';
const Screen=dynamic(()=>import('@/components/portal/features/admin/pages/Projects'),{loading:RouteSkeleton});
export default function Page(){return <Screen />;}
