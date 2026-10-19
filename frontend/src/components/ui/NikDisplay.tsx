import { useState } from 'react';
import { IconEye, IconEyeOff } from '../icons/Icons';
import { maskNik } from '../users/UsersTable';

export interface NikDisplayProps {
  nik: string | null | undefined;
  className?: string;
}

export function NikDisplay({ nik, className = '' }: NikDisplayProps) {
  const [showFull, setShowFull] = useState(false);

  if (!nik || nik.trim() === '-' || nik.trim() === '') {
    return <span className={`masked-nik-text font-mono ${className}`}>-</span>;
  }

  const clean = nik.trim();

  return (
    <span className={`nik-display-group ${className}`.trim()}>
      <span className="masked-nik-text font-mono">
        {showFull ? clean : maskNik(clean)}
      </span>
      <button
        type="button"
        className="btn-nik-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setShowFull((prev) => !prev);
        }}
        title={showFull ? 'Sembunyikan NIK' : 'Perlihatkan NIK lengkap'}
        aria-label={showFull ? 'Sembunyikan NIK' : 'Perlihatkan NIK lengkap'}
      >
        {showFull ? <IconEyeOff size={13} aria-hidden="true" /> : <IconEye size={13} aria-hidden="true" />}
      </button>
    </span>
  );
}
