import React from 'react';
import { cn } from '../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className = '',
  ...props
}) => {
  const baseStyles = 'skeleton-shimmer bg-neutral-200 dark:bg-neutral-700 rounded';

  const variantStyles = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
    card: 'rounded-xl',
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseStyles, variantStyles.text, i === lines - 1 && 'w-3/4')}
            style={{ width: i === lines - 1 ? '75%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={{ width, height }}
      {...props}
    />
  );
};

// Pre-built skeleton components for common patterns

export const TableSkeleton: React.FC<{ columns: number; rows?: number }> = ({
  columns = 5,
  rows = 5,
}) => (
  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900">
                <Skeleton variant="text" width="80%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-4">
                  <Skeleton variant="text" width="90%" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="space-y-4 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl">
    <Skeleton variant="text" width="40%" height="24px" />
    <Skeleton variant="text" width="100%" height="16px" />
    <Skeleton variant="text" width="60%" height="16px" />
    <div className="flex gap-2 mt-4">
      <Skeleton variant="rectangular" width="80px" height="36px" />
      <Skeleton variant="rectangular" width="80px" height="36px" />
    </div>
  </div>
);

export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 4 }) => (
  <div className="space-y-6">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton variant="text" width="30%" height="20px" />
        <Skeleton variant="rectangular" width="100%" height="40px" />
      </div>
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <Skeleton variant="circular" width="48px" height="48px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" height="20px" />
          <Skeleton variant="text" width="60%" height="14px" />
        </div>
        <Skeleton variant="rectangular" width="80px" height="32px" />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton variant="text" width="30%" height="30px" />
      <Skeleton variant="rectangular" width="150px" height="40px" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const ChartSkeleton = ({height=280}:{height?:number}) => (
  <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
    <Skeleton width="40%" height={20} />
    <div className="mt-5 flex items-end gap-3" style={{height}}>{[45,66,51,78,60,86,70].map((h,i)=><Skeleton key={i} variant="rectangular" className="flex-1" height={h+'%'}/>)}</div>
  </div>
);
