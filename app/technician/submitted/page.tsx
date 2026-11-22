'use client';
import dynamic from 'next/dynamic';
import {RouteSkeleton} from '@/components/portal/components/PageSkeleton';
const Screen=dynamic(()=>import('@/components/portal/features/technician/pages/AssuranceTasks'),{loading:RouteSkeleton});
export default function Page(){return <Screen />;}
