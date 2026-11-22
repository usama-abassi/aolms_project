'use client';
import {LoadingState} from '@/components/portal/components/LoadingState';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-browser';
import { Card } from '../../../components/Card';
import { Users, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminDashboardStats'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: admins },
        { count: controllers },
        { count: technicians },
        { count: totalOrders },
        { count: deliveredOrders },
        { count: pendingOrders },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'controller'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('action', 'Delivered'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('action', 'Pending'),
      ]);

      return { totalUsers, activeUsers, admins, controllers, technicians, totalOrders, deliveredOrders, pendingOrders };
    },
  });

  const { data: recentActivity, isLoading: isActivityLoading } = useQuery({
    queryKey: ['recentAuditLogs'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 font-semibold text-neutral-900 dark:text-neutral-50">Admin Dashboard</h1>
        <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">Overview of system activity and metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-950 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Total Users</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.totalUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-50 dark:bg-success-950 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Active Users</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.activeUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Users className="w-5 h-5 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Controllers</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.controllers}</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Users className="w-5 h-5 text-neutral-600 dark:text-neutral-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Technicians</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.technicians}</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-50 dark:bg-warning-950 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Pending</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.pendingOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-50 dark:bg-success-950 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-600 dark:text-success-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-body-xs text-neutral-500 dark:text-neutral-400">Delivered</p>
              <p className="text-h4 font-semibold text-neutral-900 dark:text-neutral-50">{isLoading ? '...' : stats?.deliveredOrders}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-h5 font-semibold text-neutral-900 dark:text-neutral-50 mb-4">Recent Activity</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-4 py-3 text-left text-table-header text-neutral-500 dark:text-neutral-400">User</th>
                  <th className="px-4 py-3 text-left text-table-header text-neutral-500 dark:text-neutral-400">Action</th>
                  <th className="px-4 py-3 text-left text-table-header text-neutral-500 dark:text-neutral-400">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {isActivityLoading ? (
                  <tr><td colSpan={3}><LoadingState message="Loading recent activity…"/></td></tr>
                ) : recentActivity?.length ? (
                  recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-4 py-3 text-body-sm text-neutral-900 dark:text-neutral-50">{activity.user_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-body-sm text-neutral-600 dark:text-neutral-400">{activity.action}</td>
                      <td className="px-4 py-3 text-body-sm text-neutral-500 dark:text-neutral-400">
                        {new Date(activity.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">No recent activity</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;