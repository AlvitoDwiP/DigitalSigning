import { useEffect, useState } from 'react';

interface HealthData {
  status: string;
  service: string;
  version: string;
  environment: string;
  database: {
    status: string;
    database_url_masked?: string;
    error?: string;
  };
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke Backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="container">
      <header className="header-brand">
        <div className="brand-badge">DS</div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Digital Signature Platform</h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            System Foundation & Health Check Status
          </p>
        </div>
      </header>

      <main className="card">
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
          Backend & Database Connection Status
        </h2>

        {loading && <p style={{ color: 'var(--muted)' }}>Memeriksa koneksi backend...</p>}

        {error && (
          <div style={{ padding: '16px', backgroundColor: '#FCE3DF', color: '#A91E17', borderRadius: '12px' }}>
            <p><strong>Status Error:</strong> {error}</p>
            <button onClick={fetchHealth} className="btn" style={{ marginTop: '12px' }}>
              Coba Lagi
            </button>
          </div>
        )}

        {health && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--panel)', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Service Status</span>
                <span className={`status-badge ${health.status === 'ok' ? 'status-ok' : 'status-degraded'}`}>
                  {health.status.toUpperCase()}
                </span>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--panel)', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Database Status</span>
                <span className={`status-badge ${health.database.status === 'connected' ? 'status-ok' : 'status-degraded'}`}>
                  {health.database.status.toUpperCase()}
                </span>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--panel)', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Environment</span>
                <span style={{ fontWeight: 700 }}>{health.environment}</span>
              </div>
            </div>

            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <p><strong>Backend Service:</strong> {health.service} (v{health.version})</p>
              {health.database.database_url_masked && (
                <p><strong>Target Database:</strong> {health.database.database_url_masked}</p>
              )}
            </div>

            <button onClick={fetchHealth} className="btn" style={{ marginTop: '20px' }}>
              Refresh Status
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
