'use client';
import React from 'react';
import { Layout } from '../../../components/layout/Layout';
import {useRouter} from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import { LayoutDashboard, FolderKanban, Database, Presentation, History, Package } from 'lucide-react';

const ControllerLayout: React.FC<{children:React.ReactNode}> = ({children}) => {
  const router = useRouter();

  const handleLogout = async () => {
    if (!supabase) {
      router.push('/login');
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/controller/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, disabled: true },
    { label: 'Projects', path: '/controller/projects', icon: <FolderKanban className="w-5 h-5" /> },
    { label: 'Inventory', path: '/controller/inventory', icon: <Package className="w-5 h-5" /> },
    { label: 'Audit', path: '/controller/audit', icon: <History className="w-5 h-5" /> },
    { label: 'ONT DB', path: '/controller/ont-db', icon: <Database className="w-5 h-5" /> },
    { label: 'CPE DB', path: '/controller/cpe-db', icon: <Database className="w-5 h-5" /> },
    { label: 'Operations Center', path: '/controller/legacy-operations', icon: <Presentation className="w-5 h-5" /> },
  ];

  return (
    <Layout children={children} navItems={navItems} onLogout={handleLogout} />
  );
};

export default ControllerLayout;
