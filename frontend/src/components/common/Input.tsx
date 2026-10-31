import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label?: string;
  error?: string | null;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      leftIcon,
      rightAction,
      className = '',
      disabled,
      ...inputProps
    },
    ref
  ) => {
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    return (
      <div className="form-group">
        {label && (
          <label htmlFor={id} className="form-label">
            {label}
            {inputProps.required && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
          </label>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {leftIcon && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '12px',
                color: 'var(--text-subtle)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}

          <input
            id={id}
            ref={ref}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`form-input ${error ? 'has-error' : ''} ${className}`.trim()}
            style={{
              paddingLeft: leftIcon ? '38px' : '14px',
              paddingRight: rightAction ? '42px' : '14px',
            }}
            {...inputProps}
          />

          {rightAction && (
            <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center' }}>
              {rightAction}
            </div>
          )}
        </div>

        {error && (
          <div id={errorId} role="alert" className="form-error">
            <AlertCircle size={13} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!error && helperText && (
          <div id={helperId} className="form-helper">
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
