import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MdPeople, MdHome, MdTrendingUp, MdDownload, MdTimer, MdDateRange, MdClose, MdPictureAsPdf, MdAnalytics } from 'react-icons/md';
import { generateReport } from '../utils/reportGenerator';

function today()     { return new Date().toISOString().slice(0, 10); }
function weekAgo()   { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }

export default function HomePage({ currentOccupancy, maxCapacity, entries, exits, chartData, statusColor, statusText, loggedInUser, userRole }) {
  const [showModal, setShowModal] = useState(false);
  const [fromDate, setFromDate]   = useState(weekAgo());
  const [toDate, setToDate]       = useState(today());
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [forecast, setForecast]   = useState({ peak_hour: '...', expected_count: 0 });

  const API_BASE_URL = 'http://localhost:8000/api/v1';

  React.useEffect(() => {
    const fetchForecast = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/crowd/forecast`);
        if (res.ok) setForecast(await res.json());
      } catch (err) { console.error('Forecast error:', err); }
    };
    fetchForecast();
  }, []);

  const handleDownload = async () => {
    if (fromDate > toDate) { setError('Start date must be before end date.'); return; }
    setError('');
    setLoading(true);
    try {
      await generateReport({
        fromDate,
        toDate,
        stats: { currentOccupancy, maxCapacity, entries, exits },
        loggedInUser,
        userRole,
      });
      setShowModal(false);
    } catch (e) {
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">

      {/* KPI row */}
      <div className="kpi-row">
        <div className="stat-box occupancy">
          <span className="stat-label"><MdPeople size={13} style={{marginRight:5}} />Current Occupancy</span>
          <span className="stat-value">{currentOccupancy}</span>
          <span className="stat-sub">{maxCapacity > 0 ? Math.round((currentOccupancy / maxCapacity) * 100) : 0}% of capacity</span>
        </div>
        <div className="stat-box capacity">
          <span className="stat-label"><MdHome size={13} style={{marginRight:5}} />Max Capacity</span>
          <span className="stat-value">{maxCapacity}</span>
          <span className="stat-sub">Configured limit</span>
        </div>
        <div className={`stat-box status-${statusColor}`}>
          <span className="stat-label"><MdTrendingUp size={13} style={{marginRight:5}} />Status</span>
          <span className="stat-value">{statusText}</span>
          <span className="stat-sub">{statusColor === 'normal' ? 'All clear' : statusColor === 'warning' ? 'Approaching limit' : 'At capacity'}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Entries Today</span>
          <span className="stat-value" style={{color:'var(--success)'}}>{entries}</span>
          <span className="stat-sub">People entered</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Exits Today</span>
          <span className="stat-value" style={{color:'var(--danger)'}}>{exits}</span>
          <span className="stat-sub">People exited</span>
        </div>
        <div className="stat-box">
          <span className="stat-label"><MdAnalytics size={13} style={{marginRight:5}} />Peak Forecast</span>
          <span className="stat-value">{forecast.peak_hour}</span>
          <span className="stat-sub">Expected: {forecast.expected_count} people</span>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>People IN vs OUT</h3>
            <span className="chart-badge">Last 24h</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize:11}} />
              <YAxis stroke="var(--text-muted)" tick={{fontSize:11}} />
              <Tooltip contentStyle={{ backgroundColor:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:8, fontSize:12 }} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Line type="monotone" dataKey="in_count"  name="IN"  stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out_count" name="OUT" stroke="var(--danger)"  strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Crowd Count Over Time</h3>
            <span className="chart-badge">Live</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize:11}} />
              <YAxis stroke="var(--text-muted)" tick={{fontSize:11}} />
              <Tooltip contentStyle={{ backgroundColor:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:8, fontSize:12 }} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Line type="monotone" dataKey="crowd_count" name="Crowd" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report bar */}
      <div className="report-bar">
        <div className="report-bar-icon"><MdPictureAsPdf size={28} /></div>
        <div style={{flex:1}}>
          <p className="report-bar-title">Download Activity Report</p>
          <p className="report-bar-sub">Export a full PDF report with crowd logs, alert history and statistics for any date range.</p>
        </div>
        <button className="download-report-btn" onClick={() => setShowModal(true)}>
          <MdDownload size={16} style={{marginRight:6}} />
          Generate Report
        </button>
      </div>

      {/* ── Date picker modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="report-modal">

            <div className="report-modal-header">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="report-modal-icon"><MdPictureAsPdf size={22} /></div>
                <div>
                  <h3>Generate PDF Report</h3>
                  <p>Select the date range for your report</p>
                </div>
              </div>
              <button className="btn-ghost icon-only" onClick={() => { setShowModal(false); setError(''); }}>
                <MdClose size={18} />
              </button>
            </div>

            <div className="report-modal-body">

              <div className="date-range-row">
                <div className="date-field">
                  <label><MdDateRange size={13} style={{marginRight:5}} />From</label>
                  <input type="date" value={fromDate} max={toDate} onChange={e => setFromDate(e.target.value)} className="form-input" />
                </div>
                <div className="date-range-arrow">→</div>
                <div className="date-field">
                  <label><MdDateRange size={13} style={{marginRight:5}} />To</label>
                  <input type="date" value={toDate} min={fromDate} max={today()} onChange={e => setToDate(e.target.value)} className="form-input" />
                </div>
              </div>

              {/* Quick presets */}
              <div className="date-presets">
                <span className="presets-label">Quick select:</span>
                {[
                  { label: 'Today',      fn: () => { setFromDate(today());   setToDate(today()); } },
                  { label: 'Last 7 days',fn: () => { setFromDate(weekAgo()); setToDate(today()); } },
                  { label: 'Last 30 days',fn: () => {
                    const d = new Date(); d.setDate(d.getDate() - 30);
                    setFromDate(d.toISOString().slice(0,10)); setToDate(today());
                  }},
                  { label: 'This month', fn: () => {
                    const d = new Date();
                    setFromDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);
                    setToDate(today());
                  }},
                ].map(p => (
                  <button key={p.label} className="preset-btn" onClick={p.fn}>{p.label}</button>
                ))}
              </div>

              {/* What's included */}
              <div className="report-includes">
                <p className="includes-title">Report includes:</p>
                <ul>
                  <li>Summary statistics (occupancy, entries, exits)</li>
                  <li>Full crowd activity log with timestamps</li>
                  <li>Alert history with severity levels</li>
                  <li>Generated by: <strong>{loggedInUser?.username || userRole}</strong></li>
                </ul>
              </div>

              {error && <p className="report-error">{error}</p>}
            </div>

            <div className="report-modal-footer">
              <button className="btn-ghost" onClick={() => { setShowModal(false); setError(''); }}>Cancel</button>
              <button className="download-report-btn" onClick={handleDownload} disabled={loading}>
                {loading
                  ? <><span className="spinner-sm" />Generating…</>
                  : <><MdDownload size={16} style={{marginRight:6}} />Download PDF</>
                }
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
