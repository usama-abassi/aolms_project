'use client';
import {TableSkeleton} from './Skeleton';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  label: string;
  className?: string;
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface TableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortConfig?: { key: string; direction: 'asc' | 'desc' };
  onRowSelect?: (id: string, selected: boolean) => void;
  onRowClick?: (row: T) => void;
  selectedRows?: Set<string>;
  dirtyRows?: Set<string>;
  onCellChange?: (id: string, field: string, value: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey?: keyof T | ((row: T) => string);
  showSelection?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function Table<T extends Record<string, any> = any>({
  data,
  columns,
  onSort,
  sortConfig,
  onRowSelect,
  onRowClick,
  selectedRows = new Set(),
  dirtyRows = new Set(),
  onCellChange,
  isLoading,
  emptyMessage = 'No data available',
  rowKey = 'id',
  showSelection = false,
  striped = false,
  hoverable = true,
  className = '',
}: TableProps<T>) {
  const [isScrolling, setIsScrolling] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (tableRef.current) {
        setIsScrolling(tableRef.current.scrollLeft > 0);
      }
    };
    const container = tableRef.current;
    if (!container) return;
    setIsScrolling(container.scrollLeft > 0);
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoading, data.length === 0]);

  const getRowId = (row: T): string => {
    if (typeof rowKey === 'function') return rowKey(row);
    return String(row[rowKey as keyof T]);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  if (isLoading) {
    return <div role="status" aria-label="Loading records"><div aria-hidden="true"><TableSkeleton columns={columns.length}/></div></div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={tableRef}
      className={cn(
        'overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-xl',
        isScrolling && 'shadow-inner',
        className
      )}
    >
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
        <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900 z-10">
          <tr>
            {showSelection && (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  onChange={() => {
                    if (onRowSelect) {
                      if (selectedRows.size === data.length) {
                        data.forEach((row) => onRowSelect(getRowId(row), false));
                      } else {
                        data.forEach((row) => onRowSelect(getRowId(row), true));
                      }
                    }
                  }}
                  className="h-4 w-4 text-primary-600 border-neutral-400 rounded focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-table-header text-neutral-500 dark:text-neutral-400',
                  'transition-colors',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.className
                )}
                style={{ width: column.width, minWidth: column.minWidth }}
                aria-sort={column.sortable && sortConfig?.key === column.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {column.sortable && onSort ? (
                  <button type="button" className="inline-flex items-center gap-1 rounded text-inherit hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-primary-300"
                    onClick={() => onSort(column.key, sortConfig?.key === column.key && sortConfig.direction === 'asc' ? 'desc' : 'asc')}>
                    {column.label}{getSortIcon(column.key)}
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
          {data.map((row, rowIndex) => {
            const id = getRowId(row);
            const isSelected = selectedRows.has(id);
            const isDirty = dirtyRows.has(id);
            const isStriped = striped && rowIndex % 2 === 1;

            return (
              <tr
                key={id}
                className={cn(
                  'transition-colors',
                  hoverable && 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                  isSelected && 'bg-primary-50 dark:bg-primary-950/30',
                  isDirty && 'bg-warning-50 dark:bg-warning-950/30',
                  isStriped && 'bg-neutral-50/50 dark:bg-neutral-800/50',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {showSelection && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onRowSelect?.(id, e.target.checked)}
                      className="h-4 w-4 text-primary-600 border-neutral-400 rounded focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={`Select row ${id}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-table-cell text-neutral-700 dark:text-neutral-300',
                      'align-top',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      isDirty && 'text-warning-700 dark:text-warning-300 font-medium'
                    )}
                    style={{ width: column.width, minWidth: column.minWidth }}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : onCellChange ? (
                          <input
                            value={row[column.key] ?? ''}
                            onChange={(e) => onCellChange(id, column.key, e.target.value)}
                            className={cn(
                              'w-full px-2 py-1.5 border rounded-md text-sm text-neutral-900 dark:text-neutral-50',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
                              isDirty ? 'border-warning-500 bg-warning-50 dark:bg-warning-950/30' : 'border-neutral-300 dark:border-neutral-600'
                            )}
                          />
                        ) : (
                          row[column.key] ?? '—'
                        )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}