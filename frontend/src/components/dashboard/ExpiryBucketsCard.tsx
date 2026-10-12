import { IconAlertTriangle, IconClock, IconCertificate } from '../icons/Icons';
import type { ExpiryBuckets } from '../../types/dashboard';

interface ExpiryBucketsCardProps {
  buckets: ExpiryBuckets;
}

export function ExpiryBucketsCard({ buckets }: ExpiryBucketsCardProps) {
  return (
    <div className="card expiry-card expiry-buckets-card">
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Masa berlaku sertifikat</h2>
          <p className="card-subheading">Jumlah sertifikat aktif menurut sisa waktunya</p>
        </div>
      </div>

      <div className="buckets-container">
        {/* Bucket 1: <= 30 hari */}
        <div className="bucket-item bucket-critical">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-red">
              <IconAlertTriangle size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">Dalam 30 hari</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets.within_30_days}</span>
          </div>
        </div>

        {/* Bucket 2: 31–60 hari */}
        <div className="bucket-item bucket-warning">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-amber">
              <IconClock size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">31 sampai 60 hari</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets['31_to_60_days']}</span>
          </div>
        </div>

        {/* Bucket 3: 61–90 hari */}
        <div className="bucket-item bucket-info">
          <div className="bucket-icon-col" aria-hidden="true">
            <div className="bucket-mini-badge badge-blue">
              <IconCertificate size={18} />
            </div>
          </div>
          <div className="bucket-info-col">
            <span className="bucket-range-title">61 sampai 90 hari</span>
          </div>
          <div className="bucket-count-col">
            <span className="bucket-count-number tabular-nums">{buckets['61_to_90_days']}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
