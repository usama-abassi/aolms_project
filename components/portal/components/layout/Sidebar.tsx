'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {warmRoute} from '../../auth/route-warmup';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  navItems: Array<{ label: string; path: string; icon: React.ReactNode; disabled?: boolean }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse, navItems }) => {
  const pathname = usePathname();
  const router = useRouter();
  const prefetch = (path:string) => { if (pathname !== path) { router.prefetch(path); warmRoute(path); } };
  const [isMobile, setIsMobile] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = isMobile ? !isCollapsed : hovered || focused;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile || isCollapsed) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleCollapse();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isCollapsed, onToggleCollapse]);

  return (
    <div className="relative w-16 shrink-0">
    {isMobile && !isCollapsed && (
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        aria-label="Close sidebar"
        onClick={onToggleCollapse}
      />
    )}
    <aside
      id="main-sidebar"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDownCapture={() => setFocused(false)}
      onFocusCapture={event => setFocused(event.target.matches(':focus-visible'))}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className={cn(
        'fixed top-0 left-0 h-screen z-50 shrink-0 border-r border-neutral-200 dark:border-neutral-700 transition-[width] duration-200 motion-reduce:transition-none overflow-hidden',
        'bg-white dark:bg-neutral-900',
        expanded ? 'w-64 shadow-lg' : 'w-16',
      )}
    >
      <div className="flex flex-col h-full">
        {/* Branding */}
        <div className={cn('flex h-16 items-center border-b border-neutral-200 dark:border-neutral-700', !expanded ? 'justify-center px-2' : 'justify-between px-4')}>
          {expanded && <Link href="/" onClick={() => { if (isMobile) onToggleCollapse(); }} className="flex items-center gap-2" aria-label="AOLMS Home">
            <span className="text-h5 font-semibold text-neutral-900 dark:text-neutral-50">
              AOLMS
            </span>
          </Link>}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors md:hidden"
            aria-label={!expanded ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={expanded}
            aria-controls="main-sidebar"
          >
            {!expanded ? (
              <ChevronRight className="w-6 h-6 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-6 h-6 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Main navigation">
          {navItems.map((item) => (
            item.disabled ? <div key={item.path} aria-disabled="true" title="Not available yet" className="flex cursor-not-allowed items-center gap-3 px-3 py-2.5 text-sm text-neutral-400 opacity-60"><span className="h-5 w-5 shrink-0">{item.icon}</span>{expanded && <span className="whitespace-nowrap">{item.label}</span>}</div> :
            <Link
              key={item.path}
              href={item.path}
              onMouseEnter={() => prefetch(item.path)}
              onFocus={() => prefetch(item.path)}
              onClick={() => { setFocused(false); if (isMobile && !isCollapsed) onToggleCollapse(); }}
              aria-label={item.label}
              title={!expanded ? item.label : undefined}
              className={cn(
                'mb-1 flex min-h-[44px] items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === item.path
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              )}
              aria-current={pathname === item.path ? 'page' : undefined}
            >
              <span className="w-5 h-5 flex-shrink-0" aria-hidden="true">{item.icon}</span>
              {expanded && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}
        </nav>

      </div>
    </aside>
    </div>
  );
};
