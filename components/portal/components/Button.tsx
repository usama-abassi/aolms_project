import React from 'react';
import { cn } from '../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium rounded-lg transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:ring-neutral-400 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-500 shadow-sm',
    outline: 'border border-neutral-300 bg-transparent hover:bg-neutral-50 text-neutral-700 focus-visible:ring-neutral-400 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800',
    ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-700 focus-visible:ring-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-800',
    soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 focus-visible:ring-primary-500 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900',
  };

  const sizeStyles = {
    sm: 'text-sm leading-5 px-3 py-1.5 min-h-8 gap-1.5',
    md: 'text-sm leading-5 px-4 py-2.5 min-h-10 gap-2',
    lg: 'text-base leading-6 px-6 py-3 min-h-12 gap-2',
  };

  return (
    <button
      type={type}
      aria-busy={isLoading || undefined}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
      ) : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
};
