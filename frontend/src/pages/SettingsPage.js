import React, { useState } from 'react';
import { MdSettings, MdSave, MdRefresh } from 'react-icons/md';

/**
 * SettingsPage receives maxCapacity / alertThreshold as props from Dashboard
 * so that changes here immediately affect the whole application.
 */
export default function SettingsPage({
  maxCapacity,
  setMaxCapacity,
  alertThreshold,
  setAlertThreshold,
}) {
  // Local draft state — only committed when the user clicks Save
  const [draftCapacity,  setDraftCapacity]  = useState(maxCapacity);
  const [draftThreshold, setDraftThreshold] = useState(alertThreshold);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSave = () => {
    const cap = Number(draftCapacity);
    const thr = Number(draftThreshold);

    if (!cap || cap < 1) { setSaveMsg('Max capacity must be at least 1.'); return; }
    if (!thr || thr < 1 || thr > 99) { setSaveMsg('Alert threshold must be between 1 and 99.'); return; }

    setMaxCapacity(cap);
    setAlertThreshold(thr);
    setSaveMsg('Settings saved successfully.');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleReset = () => {
    setDraftCapacity(150);
    setDraftThreshold(70);
    setMaxCapacity(150);
    setAlertThreshold(70);
    setSaveMsg('Settings reset to defaults.');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  return (
    <div className="page-content">

      <div className="page-header-row">
        <div>
          <h2 className="page-title"><MdSettings size={20} style={{marginRight:8}} />System Settings</h2>
          <p className="page-subtitle">Configure system parameters and thresholds</p>
        </div>
        <button className="btn-primary" onClick={handleSave}>
          <MdSave size={15} style={{marginRight:6}} />Save Changes
        </button>
      </div>

      {saveMsg && (
        <div className={`info-banner ${saveMsg.includes('success') || saveMsg.includes('reset') ? 'success' : 'error'}`}>
          {saveMsg}
        </div>
      )}

      <div className="settings-grid">

        {/* Capacity Settings */}
        <div className="settings-card">
          <h3 className="card-section-title">Capacity Settings</h3>
          <div className="settings-field">
            <label>Maximum Capacity</label>
            <input
              type="number"
              value={draftCapacity}
              onChange={e => setDraftCapacity(e.target.value)}
              className="form-input"
              min="1"
            />
            <p className="field-help">
              Maximum number of people allowed in the facility.
              Currently active: <strong>{maxCapacity}</strong>
            </p>
          </div>
        </div>

        {/* Alert Settings */}
        <div className="settings-card">
          <h3 className="card-section-title">Alert Settings</h3>
          <div className="settings-field">
            <label>Warning Alert Threshold (%)</label>
            <input
              type="number"
              value={draftThreshold}
              onChange={e => setDraftThreshold(e.target.value)}
              className="form-input"
              min="1"
              max="99"
            />
            <p className="field-help">
              Percentage of capacity that triggers a warning alert.
              Currently active: <strong>{alertThreshold}%</strong>
              {' '}(= {Math.round(maxCapacity * alertThreshold / 100)} people)
            </p>
          </div>
        </div>

        {/* System Actions */}
        <div className="settings-card">
          <h3 className="card-section-title">System Actions</h3>
          <button className="btn-secondary" style={{marginRight:12}} onClick={handleReset}>
            <MdRefresh size={15} style={{marginRight:6}} />Reset to Defaults
          </button>
          <button className="btn-ghost">
            <MdSettings size={15} style={{marginRight:6}} />Advanced Settings
          </button>
        </div>

      </div>
    </div>
  );
}
