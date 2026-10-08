import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = inputId ? `${inputId}-error` : undefined;
    const helperId = inputId ? `${inputId}-helper` : undefined;

    return (
      <div className="input-group">
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
            {props.required && <span className="input-required" aria-hidden="true"> *</span>}
          </label>
        )}
        <div className={`input-wrapper ${icon ? 'has-icon' : ''} ${error ? 'has-error' : ''}`}>
          {icon && <span className="input-leading-icon" aria-hidden="true">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`input-field ${className}`.trim()}
            {...props}
          />
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

Input.displayName = 'Input';
