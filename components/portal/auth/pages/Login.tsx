'use client';
import React, { useState, useEffect } from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase-browser';
import { useTheme } from '../../app/theme/theme-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Eye, EyeOff, Moon, ShieldCheck, Sun } from 'lucide-react';

type UserRole = 'admin' | 'controller' | 'technician' | null;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNoRoleModal, setShowNoRoleModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!supabase) {
      setError('Authentication service not available');
    }
  }, []);

  const fetchUserRole = async (userId: string): Promise<UserRole> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data?.role as UserRole;
    } catch (err) {
      console.error('Error fetching user role:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!supabase) {
      setError('Authentication service not available');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const userRole = await fetchUserRole(user.id);

      if (!userRole || (userRole !== 'admin' && userRole !== 'controller' && userRole !== 'technician')) {
        setShowNoRoleModal(true);
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      const routes: Record<string, string> = {
        admin: '/admin/dashboard',
        controller: '/controller/projects',
        technician: '/technician/todo',
      };
      router.push(routes[userRole!]);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_#1d4ed8_0,_transparent_38%),radial-gradient(circle_at_bottom_right,_#0f766e_0,_transparent_32%)]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center lg:grid lg:grid-cols-[1.15fr_.85fr] lg:gap-16">
        <section className="mb-10 hidden text-white lg:block">
          <Image src="/assets/white-pearls-group-white.png" alt="White Pearls Group" width={2072} height={1150} className="mb-8 h-auto w-48" priority />
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary-200">Operations workspace</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight">Keep every order, team, and delivery moving.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">A secure workspace for the people who manage service assurance from first assignment to final confirmation.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-300"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Role-based access for every operational team</div>
        </section>
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/15 bg-white/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl dark:bg-neutral-900/95 sm:p-8">
        {/* Theme toggle */}
        <div className="flex justify-between items-center mb-6">
          <span className="font-semibold text-neutral-900 dark:text-white">AOLMS</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5 text-neutral-700" /> : <Sun className="h-5 w-5 text-yellow-500" />}
          </button>
        </div>

        {/* Logo and title */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">Welcome back</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Sign in to AOLMS</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Use your organization account to continue to the operations workspace.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Input
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            error={error && !error.includes('role') ? error : undefined}
          />

          <div className="relative"><Input id="password" label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required error={error && !error.includes('role') ? error : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>

          {error && error.includes('role') && (
            <div className="rounded-lg bg-warning-50 dark:bg-warning-950/30 p-4 border border-warning-200 dark:border-warning-800">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-warning-800 dark:text-warning-200">Role Not Found</h3>
                  <p className="text-sm text-warning-700 dark:text-warning-300 mt-0.5">Login successful, but your account has no valid role assigned.</p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            © {new Date().getFullYear()} AOLMS · All rights reserved ·{' '}
            <a href="mailto:support@aolms.com" className="text-primary-600 dark:text-primary-400 hover:underline">Support</a>
          </p>
        </div>
      </div>
      </div>

      {showNoRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-warning-100 dark:bg-warning-950/30 rounded-full mb-4">
              <svg className="w-6 h-6 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 text-center mb-2">Role Not Found</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-6">
              Login successful! Your account does not have a valid role assigned (Admin, Controller, or Technician).
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => setShowNoRoleModal(false)} variant="primary" className="w-full">
                Understood
              </Button>
              <a href="mailto:admin@aolms.com" className="block">
                <Button variant="outline" className="w-full">
                  Contact Administrator
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
