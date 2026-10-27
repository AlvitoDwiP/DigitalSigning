import { changeAccountPfxPassword } from '../../services/account';
import { AccountSecretCard } from './AccountSecretCard';

interface AccountPassphraseCardProps {
  onSuccess: (msg: string) => void;
}

const PASSPHRASE_POLICY_HINTS = [
  'Minimal 8 karakter',
  'Digunakan untuk mengamankan sertifikat digital Anda',
  'Hanya passphrase yang berganti, sertifikat & masa berlaku tetap sama',
];

export function AccountPassphraseCard({ onSuccess }: AccountPassphraseCardProps) {
  const isPassphraseValid = (val: string) => val.length >= 8;

  const validateForm = (oldVal: string, newVal: string, confirmVal: string) => {
    if (!oldVal) return 'Passphrase lama wajib diisi.';
    if (!newVal) return 'Passphrase baru wajib diisi.';
    if (newVal.length < 8) return 'Passphrase baru minimal 8 karakter.';
    if (newVal === oldVal) {
      return 'Passphrase baru tidak boleh sama dengan passphrase lama.';
    }
    if (newVal !== confirmVal) {
      return 'Passphrase tidak cocok.';
    }
    return null;
  };

  return (
    <AccountSecretCard
      titleId="account-passphrase-title"
      title="Ubah Passphrase"
      description="Ganti passphrase untuk membuka berkas sertifikat digital Anda."
      policyTitle="Ketentuan Passphrase:"
      policyHints={PASSPHRASE_POLICY_HINTS}
      oldInput={{
        id: 'account-old-pfx-passphrase',
        name: 'old_passphrase',
        label: 'Passphrase Lama',
        placeholder: 'Ketik passphrase saat ini',
      }}
      newInput={{
        id: 'account-new-pfx-passphrase',
        name: 'new_passphrase',
        label: 'Passphrase Baru',
        placeholder: 'Min. 8 karakter',
      }}
      confirmInput={{
        id: 'account-confirm-pfx-passphrase',
        name: 'confirm_passphrase',
        label: 'Konfirmasi Passphrase Baru',
        placeholder: 'Ketik ulang passphrase baru',
      }}
      newHelperText="Passphrase memenuhi syarat (min. 8 karakter)"
      confirmHelperText="Konfirmasi passphrase cocok"
      submitButtonText="Perbarui Passphrase"
      successMessage="Passphrase berhasil diubah."
      defaultErrorMessage="Gagal mengubah passphrase."
      isNewValid={isPassphraseValid}
      validateForm={validateForm}
      onSubmit={(old_password, new_password, confirm_password) =>
        changeAccountPfxPassword({ old_password, new_password, confirm_password })
      }
      onSuccess={onSuccess}
    />
  );
}
