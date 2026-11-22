'use client';
import { useRef } from 'react';
import { useStaff } from '../hooks/useStaff';

import Header from '../components/layout/Header';
import SearchBar from '../components/ui/SearchBar';
import StatsCard from '../components/ui/StatsCard';
import dynamic from 'next/dynamic';
import {DeferredSection} from '../../components/DeferredSection';
import {ChartSkeleton} from '../../components/Skeleton';
const ExpiryPieChart = dynamic(()=>import('../components/ui/ExpiryPieChart'),{loading:ChartSkeleton});
import StaffFilters from '../components/staff/StaffFilters';
import StaffTable from '../components/staff/StaffTable';

export default function StaffDashboard() {
  const { staffData, stats, loading, error, filters, updateFilter, refresh } = useStaff();
  const staffTableRef = useRef(null);

  const handleCardClick = (statusValue) => {
    // Reset all filters first, then set the status filter
    updateFilter('nationality', '');
    updateFilter('category', '');
    updateFilter('search', '');
    updateFilter('docExpiry', '');
    let exactStatus = statusValue;
    if (statusValue && stats?.statuses) {
      const match = stats.statuses.find(s => s.toLowerCase().includes(statusValue.toLowerCase()));
      if (match) exactStatus = match;
    }
    updateFilter('status', exactStatus);
    // Scroll to the staff table after a short delay to let the filter apply
    setTimeout(() => {
      staffTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleArcClick = (docExpiryValue) => {
    // Toggle the document expiry filter off if clicked again
    if (filters.docExpiry === docExpiryValue) {
      updateFilter('docExpiry', '');
      return;
    }
    updateFilter('nationality', '');
    updateFilter('category', '');
    updateFilter('search', '');
    updateFilter('status', '');
    updateFilter('docExpiry', docExpiryValue);
    setTimeout(() => {
      staffTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="animate-fade-in">
      <Header onRefresh={refresh} />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          <StatsCard
            label="Total Staff"
            value={stats.total}
            color="electric"
            delay={0}
            onClick={() => handleCardClick('')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <StatsCard
            label="Active"
            value={stats.active}
            color="emerald"
            delay={100}
            onClick={() => handleCardClick('active')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
          <StatsCard
            label="On Leave"
            value={stats.onLeave}
            color="amber"
            delay={200}
            onClick={() => handleCardClick('leave')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            }
          />
          <StatsCard
            label="Will Release"
            value={stats.willRelease}
            color="rose"
            delay={300}
            onClick={() => handleCardClick('release')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="17" y1="11" x2="23" y2="11" />
              </svg>
            }
          />
        </div>
      )}

      {/* Document Expiry Pie Chart */}
      {stats?.documentExpiry && (
        <div className="mb-8">
          <DeferredSection fallback={<ChartSkeleton/>}><ExpiryPieChart
            data={stats.documentExpiry} 
            onArcClick={handleArcClick}
            activeFilter={filters.docExpiry}
          /></DeferredSection>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-6">
        <SearchBar
          value={filters.search}
          onChange={(val) => updateFilter('search', val)}
        />
      </div>
      <StaffFilters filters={filters} onFilterChange={updateFilter} stats={stats} />

      {/* Error State */}
      {error && (
        <div className="glass-card p-6 mb-6 border-rose/30">
          <div className="flex items-center gap-3 text-rose-light">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
              <p className="text-xs text-slate-500 mt-2">Make sure the backend is running on port 3001</p>
            </div>
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div ref={staffTableRef}>
        <StaffTable data={staffData.data} loading={loading} />
      </div>

    </div>
  );
}
