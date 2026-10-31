import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      style,
      children,
      ...rest
    },
    ref
  ) => {
    const variantClass =
      variant === 'primary'
        ? 'btn-primary'
        : variant === 'secondary'
        ? 'btn-secondary'
        : variant === 'outline'
        ? 'btn-outline'
        : variant === 'danger'
        ? 'btn-danger'
        : variant === 'danger-outline'
        ? 'btn-danger-outline'
        : 'btn-ghost';

    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`btn ${variantClass} ${sizeClass} ${isLoading ? 'is-loading' : ''} ${className}`.trim()}
        style={{
          ...(fullWidth ? { width: '100%' } : {}),
          ...style,
        }}
        {...rest}
      >
        {isLoading ? (
          <Loader2 size={size === 'sm' ? 14 : 16} className="spin-animation" aria-hidden="true" />
        ) : (
          leftIcon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span aria-hidden="true" style={{ display: 'inline-flex' }}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
