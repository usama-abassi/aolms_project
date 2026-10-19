'use client';
import React from 'react';
import { Layout } from '../../../components/layout/Layout';
import {useRouter} from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import { ClipboardCheck, History } from 'lucide-react';

const TechnicianLayout: React.FC<{children:React.ReactNode}> = ({children}) => {
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
    { label: 'Projects', path: '/technician/projects', icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: 'To-Do', path: '/technician/todo', icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: 'Submitted Orders', path: '/technician/submitted', icon: <History className="w-5 h-5" /> },
  ];

  return (
    <Layout children={children} navItems={navItems} onLogout={handleLogout} />
  );
};

export default TechnicianLayout;
