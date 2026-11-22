'use client';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

function getFocusable(container:HTMLElement){
  return Array.from(container.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, summary, [tabindex]'))
    .filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onCloseRef.current();
      }
      // Trap focus
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = getFocusable(modalRef.current);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusTimer = setTimeout(() => {
      if (modalRef.current) (getFocusable(modalRef.current)[0] ?? modalRef.current).focus();
    }, 0);

    // Prevent body scroll
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousActiveElement.current?.focus();
    };
  }, [isOpen, closeOnEscape]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto animate-fade-in" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-neutral-900/50 dark:bg-neutral-950/70 animate-fade-in"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal content */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div
          ref={modalRef}
          tabIndex={-1}
          className={cn(
            'pointer-events-auto flex max-h-[calc(100vh-2rem)] w-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50 rounded-xl shadow-2xl',
            sizeClasses[size],
            className
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 id={titleId} className="text-h5 text-neutral-900 dark:text-neutral-50">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 px-4 py-4 sm:px-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
