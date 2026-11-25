'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Menu, User, LogOut } from 'lucide-react';
import {useRouter,usePathname} from 'next/navigation';
import { useTheme } from '../../app/theme/theme-context';
import { Button } from '../Button';

interface HeaderProps {
  onToggleSidebar?: () => void;
  title?: string;
  currentUser?: {
    name: string;
    avatar?: string;
  } | null;
  onLogout: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  title = 'Dashboard',
  currentUser,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin/');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { setIsUserMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setIsUserMenuOpen(false); userMenuRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [isUserMenuOpen]);

  const handleProfile = () => {
    setIsUserMenuOpen(false);
    router.push('/admin/profile/me');
  };

  const handleLogoutClick = async () => {
    setIsUserMenuOpen(false);
    await onLogout();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Left side - Mobile menu and title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50 sm:text-h5">
              {title}
            </h2>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-lg"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <Moon className="w-5 h-5 text-neutral-600 dark:hidden" aria-hidden="true" />
            <Sun className="hidden w-5 h-5 text-yellow-400 dark:block" aria-hidden="true" />
          </Button>

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 px-2"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label={`Account: ${currentUser?.name || 'User'}`}
              aria-expanded={isUserMenuOpen}
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {currentUser?.avatar || 'U'}
                </span>
              </div>
              <span className="hidden max-w-[180px] truncate text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:block">
                {currentUser?.name || 'User'}
              </span>
            </Button>

            {/* Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-48 bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 animate-fade-in">
                {isAdmin && <button
                  onClick={handleProfile}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  Profile
                </button>}
                <button type="button" onClick={()=>router.push('/'+pathname.split('/')[1]+'/change-password')}
                  className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">Change password</button>
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
