'use client';
import dynamic from 'next/dynamic';
import {RouteSkeleton} from '@/components/portal/components/PageSkeleton';
const Configuration=dynamic(()=>import('@/components/portal/features/controller/pages/Configuration'),{loading:RouteSkeleton});
export default function Page(){return <Configuration/>;}
