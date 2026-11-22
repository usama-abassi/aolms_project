import React, { useId } from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  type?: string;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  type = 'text',
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="min-w-0 space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-label-md text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={cn(
          'w-full px-3 h-11 border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder-neutral-500',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
          'disabled:cursor-default disabled:bg-neutral-100',
          'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus-visible:ring-primary-400 dark:disabled:bg-neutral-800',
          error && 'border-danger-500 focus-visible:ring-danger-500',
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger-600 dark:text-danger-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
};
