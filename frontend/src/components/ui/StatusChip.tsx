
export type StatusType =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REPLACED'
  | 'INACTIVE'
  | 'SUCCESS'
  | 'FAILED'
  | 'RESERVED'
  | 'ADMIN'
  | 'USER'
  | 'SUPER_ADMIN';

export interface StatusChipProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export function StatusChip({ status, label, className = '' }: StatusChipProps) {
  const normalizedStatus = status.toUpperCase();
  const displayLabel = label || normalizedStatus;

  let statusClass = 'chip-neutral';

  switch (normalizedStatus) {
    case 'ACTIVE':
    case 'SUCCESS':
      statusClass = 'chip-active';
      break;
    case 'EXPIRED':
      statusClass = 'chip-expired';
      break;
    case 'FAILED':
      statusClass = 'chip-failed';
      break;
    case 'REPLACED':
    case 'INACTIVE':
    case 'RESERVED':
      statusClass = 'chip-neutral';
      break;
    case 'ADMIN':
    case 'SUPER_ADMIN':
      statusClass = 'chip-admin';
      break;
    default:
      statusClass = 'chip-neutral';
  }

  return (
    <span className={`status-chip ${statusClass} ${className}`.trim()}>
      {displayLabel}
    </span>
  );
}
