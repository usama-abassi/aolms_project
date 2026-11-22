import React, { useId } from 'react';
import { cn } from '../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  hint,
  options,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="min-w-0 space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-label-md text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full px-3 h-11 border border-neutral-300 rounded-lg bg-white text-neutral-900',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
          'disabled:cursor-default disabled:bg-neutral-100',
          'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-50 dark:focus-visible:ring-primary-400 dark:disabled:bg-neutral-800',
          error && 'border-danger-500 focus-visible:ring-danger-500',
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-danger-600 dark:text-danger-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${selectId}-hint`} className="text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
};
