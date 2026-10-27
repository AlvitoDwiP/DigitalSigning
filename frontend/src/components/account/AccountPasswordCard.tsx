import { changeAccountLoginPassword } from '../../services/account';
import { getAuthUser, setAuthUser } from '../../services/api';
import { AccountSecretCard } from './AccountSecretCard';

interface AccountPasswordCardProps {
  onSuccess: (msg: string) => void;
}

const PASSWORD_POLICY_HINTS = [
  'Minimal 8 karakter',
  'Mengandung minimal 1 huruf besar (uppercase)',
  'Mengandung minimal 1 simbol / karakter non-alfanumerik',
];

export function AccountPasswordCard({ onSuccess }: AccountPasswordCardProps) {
  const isPasswordValid = (val: string) =>
    Boolean(val.length >= 8 && /[A-Z]/.test(val) && /[^a-zA-Z0-9]/.test(val));

  const validateForm = (oldVal: string, newVal: string, confirmVal: string) => {
    if (!oldVal) return 'Password lama wajib diisi.';
    if (!newVal) return 'Password baru wajib diisi.';
    if (newVal.length < 8) return 'Password baru minimal 8 karakter.';
    if (!/[A-Z]/.test(newVal)) {
      return 'Password baru harus mengandung setidaknya satu huruf besar (A-Z).';
    }
    if (!/[^a-zA-Z0-9]/.test(newVal)) {
      return 'Password baru harus mengandung setidaknya satu karakter simbol/non-alfanumerik.';
    }
    if (newVal === oldVal) {
      return 'Password baru tidak boleh sama dengan password lama.';
    }
    if (newVal !== confirmVal) {
      return 'Konfirmasi password tidak cocok.';
    }
    return null;
  };

  const handleAfterSuccess = () => {
    try {
      const user = getAuthUser();
      if (user) {
        setAuthUser({ ...user, must_change_password: false });
      }
    } catch {
      // ignore
    }
  };

  return (
    <AccountSecretCard
      titleId="account-password-title"
      title="Ubah Password Login"
      description="Perbarui kata sandi akun Anda untuk autentikasi masuk ke platform."
      policyTitle="Ketentuan Password:"
      policyHints={PASSWORD_POLICY_HINTS}
      oldInput={{
        id: 'account-old-login-password',
        name: 'old_password',
        label: 'Password Lama',
        placeholder: 'Ketik password saat ini',
      }}
      newInput={{
        id: 'account-new-login-password',
        name: 'new_password',
        label: 'Password Baru',
        placeholder: 'Min. 8 karakter, 1 huruf besar, 1 simbol',
      }}
      confirmInput={{
        id: 'account-confirm-login-password',
        name: 'confirm_password',
        label: 'Konfirmasi Password Baru',
        placeholder: 'Ketik ulang password baru',
      }}
      newHelperText="Password baru memenuhi syarat"
      confirmHelperText="Konfirmasi password cocok"
      submitButtonText="Perbarui Password Login"
      successMessage="Password login berhasil diubah."
      defaultErrorMessage="Gagal mengubah password login."
      isNewValid={isPasswordValid}
      validateForm={validateForm}
      onSubmit={(old_password, new_password, confirm_password) =>
        changeAccountLoginPassword({ old_password, new_password, confirm_password })
      }
      onAfterSuccess={handleAfterSuccess}
      onSuccess={onSuccess}
    />
  );
}
