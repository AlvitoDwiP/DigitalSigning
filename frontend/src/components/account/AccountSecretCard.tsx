import { useState } from 'react';
import { PasswordInput } from '../ui/PasswordInput';
import { IconLock, IconAlertTriangle } from '../icons/Icons';
import { extractErrorMessage } from './accountUtils';

export interface SecretInputConfig {
  id: string;
  name: string;
  label: string;
  placeholder: string;
}

export interface AccountSecretCardProps {
  titleId: string;
  title: string;
  description: string;
  policyTitle: string;
  policyHints: string[];
  oldInput: SecretInputConfig;
  newInput: SecretInputConfig;
  confirmInput: SecretInputConfig;
  newHelperText?: string;
  confirmHelperText?: string;
  submitButtonText: string;
  successMessage: string;
  defaultErrorMessage: string;
  isNewValid: (val: string) => boolean;
  validateForm: (oldVal: string, newVal: string, confirmVal: string) => string | null;
  onSubmit: (oldVal: string, newVal: string, confirmVal: string) => Promise<{ success: boolean; detail?: any; message?: string }>;
  onAfterSuccess?: () => void;
  onSuccess: (msg: string) => void;
}

export function AccountSecretCard({
  titleId,
  title,
  description,
  policyTitle,
  policyHints,
  oldInput,
  newInput,
  confirmInput,
  newHelperText,
  confirmHelperText,
  submitButtonText,
  successMessage,
  defaultErrorMessage,
  isNewValid,
  validateForm,
  onSubmit,
  onAfterSuccess,
  onSuccess,
}: AccountSecretCardProps) {
  const [oldSecret, setOldSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewSecretValid = isNewValid(newSecret);
  const isConfirmSecretValid = Boolean(
    newSecret && confirmSecret && confirmSecret === newSecret && isNewSecretValid
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm(oldSecret, newSecret, confirmSecret);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await onSubmit(oldSecret, newSecret, confirmSecret);

      if (res.success) {
        setOldSecret('');
        setNewSecret('');
        setConfirmSecret('');
        setError(null);
        onAfterSuccess?.();
        onSuccess(successMessage);
      } else {
        setError(extractErrorMessage(res, defaultErrorMessage));
      }
    } catch (err: any) {
      setError(err.message || defaultErrorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="detail-card account-card" aria-labelledby={titleId}>
      <div className="detail-card-header">
        <div className="card-title-group">
          <IconLock size={20} className="card-title-icon" aria-hidden="true" />
          <h2 id={titleId} className="detail-card-title">
            {title}
          </h2>
        </div>
      </div>

      <div className="detail-card-body">
        <p className="dialog-main-text mb-4">{description}</p>

        <form onSubmit={handleSubmit} className="account-two-col-form">
          <div className="account-form-cols">
            {/* Kolom Kiri: Input Lama & Panduan Ketentuan */}
            <div className="account-form-col">
              <PasswordInput
                id={oldInput.id}
                name={oldInput.name}
                label={oldInput.label}
                placeholder={oldInput.placeholder}
                value={oldSecret}
                onChange={(e) => {
                  setOldSecret(e.target.value);
                  setError(null);
                }}
                disabled={isProcessing}
                autoComplete="current-password"
                required
              />

              <div className="password-policy-hints">
                <span className="policy-hint-title">{policyTitle}</span>
                <ul className="policy-hints-list">
                  {policyHints.map((hint, idx) => (
                    <li key={idx}>{hint}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Kolom Kanan: Input Baru & Konfirmasi */}
            <div className="account-form-col">
              <PasswordInput
                id={newInput.id}
                name={newInput.name}
                label={newInput.label}
                placeholder={newInput.placeholder}
                helperText={isNewSecretValid ? newHelperText : undefined}
                value={newSecret}
                onChange={(e) => {
                  setNewSecret(e.target.value);
                  setError(null);
                }}
                isValid={isNewSecretValid}
                disabled={isProcessing}
                autoComplete="new-password"
                required
              />

              <PasswordInput
                id={confirmInput.id}
                name={confirmInput.name}
                label={confirmInput.label}
                placeholder={confirmInput.placeholder}
                helperText={isConfirmSecretValid ? confirmHelperText : undefined}
                value={confirmSecret}
                onChange={(e) => {
                  setConfirmSecret(e.target.value);
                  setError(null);
                }}
                isValid={isConfirmSecretValid}
                disabled={isProcessing}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="dialog-error-banner form-error-banner" role="alert">
              <IconAlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="account-form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing}
            >
              {isProcessing ? 'Menyimpan...' : submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
