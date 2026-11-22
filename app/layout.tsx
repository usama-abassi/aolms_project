import {LoadingState} from '@/components/portal/components/LoadingState';
import type {Metadata} from 'next';
import {Suspense} from 'react';
import {Providers} from './providers';
import './globals.css';
export const metadata:Metadata={title:'AOLMS',description:'Operations management',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en" suppressHydrationWarning><body><div id="root"><Providers><Suspense fallback={<LoadingState message="Loading page…"/>}>{children}</Suspense></Providers></div></body></html>;
}
