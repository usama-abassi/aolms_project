import React, { useId } from 'react';
import { cn } from '../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className="min-w-0 space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-label-md text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={cn(
          'w-full px-3 py-3 border border-neutral-300 rounded-md bg-white text-neutral-900 placeholder-neutral-400 resize-y min-h-[100px]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-transparent',
          'disabled:cursor-default disabled:bg-neutral-100',
          'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus-visible:ring-primary-400 dark:disabled:bg-neutral-800',
          error && 'border-danger-500 focus-visible:ring-danger-500',
          className
        )}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${textareaId}-error`} className="text-sm text-danger-600 dark:text-danger-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${textareaId}-hint`} className="text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
};
