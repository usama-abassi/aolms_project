'use client';
import React from 'react';
import { Layout } from '../../../components/layout/Layout';
import {useRouter} from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import { LayoutDashboard, Users, FolderKanban, Database, Presentation } from 'lucide-react';

const AdminLayout: React.FC<{children:React.ReactNode}> = ({children}) => {
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
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Users', path: '/admin/profiles', icon: <Users className="w-5 h-5" /> },
    { label: 'Projects', path: '/admin/projects', icon: <FolderKanban className="w-5 h-5" /> },
    { label: 'Service Assurance Audit', path: '/admin/audit', icon: <FolderKanban className="w-5 h-5" /> },
    { label: 'Operations Data', path: '/admin/operations-data', icon: <Database className="w-5 h-5" /> },
    { label: 'Operations Center', path: '/admin/legacy-operations', icon: <Presentation className="w-5 h-5" /> },
  ];

  return (
    <Layout children={children}
      navItems={navItems}
      onLogout={handleLogout}
    />
  );
};

export default AdminLayout;
