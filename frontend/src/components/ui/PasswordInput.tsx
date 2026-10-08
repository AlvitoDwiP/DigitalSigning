import { useState, forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { IconLock, IconEye, IconEyeOff } from '../icons/Icons';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label = 'Password', error, helperText, id, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : 'input-password');
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const toggleVisibility = () => {
      setShowPassword(prev => !prev);
    };

    return (
      <div className="input-group">
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
            {props.required && <span className="input-required" aria-hidden="true"> *</span>}
          </label>
        )}
        <div className={`input-wrapper has-icon has-trailing-btn ${error ? 'has-error' : ''}`}>
          <span className="input-leading-icon" aria-hidden="true">
            <IconLock size={18} />
          </span>
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`input-field ${className}`.trim()}
            autoComplete="current-password"
            {...props}
          />
          <button
            type="button"
            className="input-trailing-btn"
            onClick={toggleVisibility}
            aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
            tabIndex={0}
          >
            {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>
        {error && (
          <p id={errorId} className="input-error-msg" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="input-helper-msg">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
