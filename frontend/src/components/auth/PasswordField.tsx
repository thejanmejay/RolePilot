import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FormField } from './FormField';

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  error?: string | null;
  helperText?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  error,
  helperText,
  disabled,
  ...inputProps
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <FormField
      id={id}
      label={label}
      type={showPassword ? 'text' : 'password'}
      error={error}
      helperText={helperText}
      disabled={disabled}
      rightAction={
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          className="auth-input-action-btn"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
      {...inputProps}
    />
  );
};
