'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useCurrentProfile } from '../../auth/useCurrentProfile';

export interface LayoutProps {
  children?: React.ReactNode;
  navItems: Array<{ label: string; path: string; icon: React.ReactNode; disabled?: boolean }>;
  onLogout: () => Promise<void>;
  currentUser?: {
    name: string;
    avatar?: string;
  } | null;
}

export const Layout: React.FC<LayoutProps> = ({ navItems, onLogout, currentUser, children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const pathname = usePathname();
  const signedInUser = useCurrentProfile();
  const technician = pathname.startsWith('/technician/');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Determine page title based on current route
  const getPageTitle = () => {
    if (pathname.includes('/assurance-form/')) return 'Service Delivery Form';
    if (pathname.includes('/delivery-form/')) return 'Delivery Form';
    const navigationTitle = navItems.find(item => item.path === pathname)?.label;
    if (navigationTitle) return navigationTitle;
    const path = pathname.split('/').pop();
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      configuration: 'Configuration',
      profiles: 'Users',
      projects: 'Projects',
      audit: pathname.startsWith('/admin/') ? 'Service Assurance Audit' : 'Audit',
      inventory: 'Inventory',
      'operations-data': 'Operations Data',
      settings: 'Settings',
      history: 'History',
      'ont-db': 'ONT DB',
      'cpe-db': 'CPE DB',
      todo: 'To-Do',
      submitted: 'Submitted Orders',
      'legacy-operations': 'Operations Center',
      me: 'My Profile',
    };
    return path ? (titles[path] || 'Workspace') : 'Workspace';
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="app-shell flex min-h-screen">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        navItems={navItems}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={toggleSidebar}
          title={getPageTitle()}
          currentUser={signedInUser || currentUser}
          onLogout={onLogout}
        />
        {technician && <nav aria-label="Technician pages" className="technician-tabs grid grid-cols-2 gap-2 px-3 py-2 md:hidden">
          {navItems.map(item => <Link key={item.path} href={item.path} aria-current={pathname === item.path ? 'page' : undefined}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold ${pathname === item.path ? 'bg-primary-600 text-white' : 'text-neutral-700 dark:text-neutral-200'}`}>{item.icon}{item.label}</Link>)}
        </nav>}
        {offline && <p role="status" className="border-b border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-200">You are offline. Keep this page open and reconnect before saving or submitting.</p>}
        <main id="main-content" className={`app-main flex-1 p-3 sm:p-5 lg:p-8 ${technician ? 'technician-workspace' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};
