import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  helperText?: string;
  rightAction?: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  error,
  helperText,
  rightAction,
  className = '',
  disabled,
  ...inputProps
}) => {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className="auth-field-group">
      <div className="auth-label">
        <label htmlFor={id}>{label}</label>
        {helperText && !error && (
          <span id={helperId} className="auth-label-helper">
            {helperText}
          </span>
        )}
      </div>

      <div className="auth-input-wrapper">
        <input
          id={id}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`auth-input ${error ? 'has-error' : ''} ${
            rightAction ? 'auth-input-has-action' : ''
          } ${className}`}
          {...inputProps}
        />
        {rightAction}
      </div>

      {error && (
        <div id={errorId} role="alert" className="auth-field-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
