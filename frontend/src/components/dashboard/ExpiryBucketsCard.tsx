import { IconAlertTriangle, IconClock, IconCertificate } from '../icons/Icons';
import type { ExpiryBuckets } from '../../types/dashboard';

interface ExpiryBucketsCardProps {
  buckets: ExpiryBuckets;
}

export function ExpiryBucketsCard({ buckets }: ExpiryBucketsCardProps) {
  const totalInBuckets =
    buckets.within_30_days + buckets['31_to_60_days'] + buckets['61_to_90_days'];

  return (
    <div className="card expiry-card expiry-buckets-card">
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Sertifikat yang Akan Berakhir</h2>
          <p className="card-subheading">Distribusi sertifikat ACTIVE berdasarkan sisa masa berlaku</p>
        </div>
      </div>

      <div className="buckets-container">
        {/* Bucket 1: <= 30 hari (Critical/Red) */}
        <div className="bucket-item bucket-critical">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-red">
              <IconAlertTriangle size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">≤ 30 hari</span>
            <span className="bucket-desc">Masa berlaku sangat mendesak</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets.within_30_days}</span>
            <span className="bucket-count-unit">sertifikat</span>
          </div>
        </div>

        {/* Bucket 2: 31–60 hari (Warning/Amber) */}
        <div className="bucket-item bucket-warning">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-amber">
              <IconClock size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">31–60 hari</span>
            <span className="bucket-desc">Perlu persiapan penerbitan ulang</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets['31_to_60_days']}</span>
            <span className="bucket-count-unit">sertifikat</span>
          </div>
        </div>

        {/* Bucket 3: 61–90 hari (Info/Blue) */}
        <div className="bucket-item bucket-info">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-blue">
              <IconCertificate size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">61–90 hari</span>
            <span className="bucket-desc">Masa berlaku masih terkendali</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets['61_to_90_days']}</span>
            <span className="bucket-count-unit">sertifikat</span>
          </div>
        </div>
      </div>

      <div className="buckets-footer">
        <span className="buckets-summary-text">
          Total sertifikat dalam rentang 90 hari: <strong>{totalInBuckets} sertifikat</strong>
        </span>
      </div>
    </div>
  );
}
