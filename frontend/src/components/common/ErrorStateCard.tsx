import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export interface ErrorStateCardAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

export interface ErrorStateCardProps {
  code?: string | number;
  title: string;
  description: string;
  icon: ReactNode;
  primaryAction?: ErrorStateCardAction;
  secondaryAction?: ErrorStateCardAction;
  badgeVariant?: 'red' | 'amber' | 'muted' | 'brand';
  role?: 'alert' | 'status';
  className?: string;
  isStandalone?: boolean;
}

export function ErrorStateCard({
  code,
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  badgeVariant = 'brand',
  role = 'alert',
  className = '',
  isStandalone = false,
}: ErrorStateCardProps) {
  const content = (
    <div
      className={`users-empty-state-card error-state-card ${className}`}
      role={role}
      aria-live="polite"
    >
      {/* Icon with variant background circle */}
      <div className={`empty-state-icon error-state-icon error-icon-${badgeVariant}`} aria-hidden="true">
        {icon}
      </div>

      {/* Error Code Tag */}
      {code && (
        <span className={`error-state-code error-badge-${badgeVariant}`}>
          Kode Error: {code}
        </span>
      )}

      {/* Title & Description */}
      <h1 className="empty-state-title error-state-title">{title}</h1>
      <p className="empty-state-description error-state-description">{description}</p>

      {/* Action Buttons */}
      {(primaryAction || secondaryAction) && (
        <div className="empty-state-actions error-state-actions">
          {primaryAction && (
            <Button
              type="button"
              variant={primaryAction.variant || 'primary'}
              onClick={primaryAction.onClick}
              loading={primaryAction.loading}
              className="error-action-btn"
            >
              {primaryAction.icon && <span className="btn-icon-start">{primaryAction.icon}</span>}
              {primaryAction.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              type="button"
              variant={secondaryAction.variant || 'secondary'}
              onClick={secondaryAction.onClick}
              loading={secondaryAction.loading}
              className="error-action-btn"
            >
              {secondaryAction.icon && <span className="btn-icon-start">{secondaryAction.icon}</span>}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (isStandalone) {
    return (
      <div className="error-standalone-container">
        <div className="error-standalone-header">
          <div className="brand-logo" aria-hidden="true">
            <span>DS</span>
          </div>
          <span className="error-standalone-brand-text">Digital Signature Platform</span>
        </div>
        <div className="error-standalone-card-wrapper card">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="error-page-container">
      {content}
    </div>
  );
}
