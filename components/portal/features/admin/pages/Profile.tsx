'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Card } from '../../../components/Card';
import { BadgeCheck, Mail, User, Calendar } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  employee_code: string;
  is_active: boolean;
  created_at: string;
}

const Profile: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        if (!supabase) return;
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return;
        const {data, error} = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) { console.error('Error fetching profile:', error); return; }
        if (mounted) setUser(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchUser();
    return () => { mounted = false; };
  }, []);

  const roleColors: Record<string, string> = {
    admin: 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300',
    controller: 'bg-warning-100 text-warning-700 dark:bg-warning-950 dark:text-warning-300',
    technician: 'bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-300',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-neutral-500 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-danger-600 dark:text-danger-400">User profile not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-50">My Profile</h1>
        <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">View your account details</p>
      </div>

      <Card>
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{user.full_name}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium mt-1 ${roleColors[user.role] || 'bg-neutral-100 text-neutral-700'}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-body-sm text-neutral-600 dark:text-neutral-400">
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>{user.email}</span>
              </div>
              {user.employee_code && (
                <div className="flex items-center gap-2 text-body-sm text-neutral-600 dark:text-neutral-400">
                  <User className="w-4 h-4" aria-hidden="true" />
                  <span>{user.employee_code}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-body-sm text-neutral-600 dark:text-neutral-400">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <BadgeCheck className={`w-5 h-5 ${user.is_active ? 'text-success-600 dark:text-success-400' : 'text-neutral-400'}`} aria-hidden="true" />
              <span className={`text-caption font-medium ${user.is_active ? 'text-success-600 dark:text-success-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {user.is_active ? 'Active Account' : 'Inactive Account'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Account Details" subtitle="Your authentication information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-caption text-neutral-500 dark:text-neutral-400">User ID</p>
            <p className="text-body-sm font-mono text-neutral-700 dark:text-neutral-300 break-all">{user.id}</p>
          </div>
          <div className="space-y-2">
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Email</p>
            <p className="text-body-sm text-neutral-700 dark:text-neutral-300">{user.email}</p>
          </div>
          <div className="space-y-2">
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Role</p>
            <p className="text-body-sm text-neutral-700 dark:text-neutral-300 capitalize">{user.role}</p>
          </div>
          <div className="space-y-2">
            <p className="text-caption text-neutral-500 dark:text-neutral-400">Status</p>
            <p className="text-body-sm text-neutral-700 dark:text-neutral-300">{user.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
