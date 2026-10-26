import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { IconFileText, IconUpload, IconTrash, IconRefresh, IconAlertTriangle } from '../icons/Icons';
import { formatFileSize } from '../../utils/pdfHelper';

interface PdfDropzoneProps {
  pdfFile: File | null;
  pageCount: number;
  isLoadingPages: boolean;
  onSelectFile: (file: File) => void;
  onRemoveFile: () => void;
}

export function PdfDropzone({
  pdfFile,
  pageCount,
  isLoadingPages,
  onSelectFile,
  onRemoveFile,
}: PdfDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  const validateAndProcess = (file: File) => {
    setErrorMessage(null);

    // Validasi format
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      setErrorMessage('Berkas yang dipilih harus berformat PDF (.pdf).');
      return;
    }

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Ukuran file melebihi batas 20 MB.');
      return;
    }

    onSelectFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcess(e.target.files[0]);
    }
  };

  return (
    <div className="tte-step-card">
      <div className="tte-step-header">
        <span className="tte-step-badge">1</span>
        <div>
          <h2 className="tte-step-title">Pilih Dokumen PDF</h2>
          <p className="tte-step-desc">Unggah dokumen yang akan dilakukan tanda tangan elektronik</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="tte-pdf-input"
        aria-label="Pilih berkas PDF"
      />

      {/* Error Banner jika validasi gagal */}
      {errorMessage && (
        <div className="alert-danger" role="alert" style={{ marginBottom: '12px' }}>
          <IconAlertTriangle size={18} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!pdfFile ? (
        <div
          className={`tte-dropzone ${isDragOver ? 'is-drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Area unggah dokumen PDF"
        >
          <div className="tte-dropzone-icon-wrap" aria-hidden="true">
            <IconUpload size={28} />
          </div>
          <div className="tte-dropzone-texts">
            <strong className="tte-dropzone-main">Pilih PDF atau seret berkas ke sini</strong>
            <span className="tte-dropzone-hint">PDF · Maksimal 20 MB</span>
          </div>
        </div>
      ) : (
        <div className="tte-file-card" aria-label="Informasi Dokumen Terpilih">
          <div className="tte-file-icon" aria-hidden="true">
            <IconFileText size={24} />
          </div>
          <div className="tte-file-meta">
            <span className="tte-file-name" title={pdfFile.name}>
              {pdfFile.name}
            </span>
            <div className="tte-file-details">
              <span>{formatFileSize(pdfFile.size)}</span>
              <span className="tte-file-dot" aria-hidden="true">•</span>
              <span>
                {isLoadingPages ? (
                  <span className="tte-file-loading-pages">Menghitung halaman...</span>
                ) : (
                  `${pageCount} Halaman`
                )}
              </span>
            </div>
          </div>
          <div className="tte-file-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm tte-file-action-btn"
              onClick={() => inputRef.current?.click()}
              title="Ganti berkas PDF"
              aria-label="Ganti berkas PDF"
            >
              <IconRefresh size={15} aria-hidden="true" />
              <span>Ganti</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm tte-file-action-btn tte-file-delete-btn"
              onClick={onRemoveFile}
              title="Hapus dokumen terpilih"
              aria-label="Hapus dokumen terpilih"
            >
              <IconTrash size={15} aria-hidden="true" />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
