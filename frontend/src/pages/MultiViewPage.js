import React, { useState } from 'react';
import { MdGridView, MdVideocam, MdWarning } from 'react-icons/md';
import './pages.css';

export default function MultiViewPage({ currentOccupancy, maxCapacity }) {
  const [cameras, setCameras] = useState([
    { id: 1, name: 'Main Entrance',  active: true,  occupancy: 0 },
    { id: 2, name: 'South Hall',     active: false, occupancy: 0 },
    { id: 3, name: 'Food Court',     active: false, occupancy: 0 },
    { id: 4, name: 'Emergency Exit', active: false, occupancy: 0 },
  ]);

  const connectCamera = (id) => {
    setCameras(prev => prev.map(cam =>
      cam.id === id ? { ...cam, active: true } : cam
    ));
  };

  const disconnectCamera = (id) => {
    setCameras(prev => prev.map(cam =>
      cam.id === id ? { ...cam, active: false, occupancy: 0 } : cam
    ));
  };

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div>
          <h2 className="page-title"><MdGridView size={20} style={{marginRight:8}} />Multi-Camera Control Room</h2>
          <p className="page-subtitle">Monitor all zones simultaneously in a single grid layout</p>
        </div>
        <div className="total-occupancy-pill">
          Total Occupancy: <strong>{currentOccupancy}</strong> / {maxCapacity}
        </div>
      </div>

      <div className="camera-grid">
        {cameras.map(cam => (
          <div key={cam.id} className={`camera-grid-item ${cam.active ? 'active' : 'inactive'}`}>
            <div className="cam-header">
              <span className="cam-name"><MdVideocam size={14} /> {cam.name}</span>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                {cam.active ? (
                  <>
                    <span className="cam-status-dot" />
                    <button className="btn-retry" style={{fontSize:11}} onClick={() => disconnectCamera(cam.id)}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button className="btn-retry" onClick={() => connectCamera(cam.id)}>Connect</button>
                )}
              </div>
            </div>

            <div className="cam-body">
              {cam.active ? (
                <div className="cam-placeholder">
                  <div className="scan-line" />
                  <p>Live Stream Active</p>
                  <small>Region: {cam.id === 1 ? 'Entry-A' : cam.id === 2 ? 'Hall-B' : cam.id === 3 ? 'Zone-C' : 'Exit-D'}</small>
                </div>
              ) : (
                <div className="cam-offline">
                  <MdWarning size={32} />
                  <p>Feed Disconnected</p>
                  <small>Camera ID: CAM-00{cam.id}</small>
                </div>
              )}
            </div>

            <div className="cam-footer">
              {/* Occupancy shown from stable state — no Math.random() */}
              <span>Occupancy: {cam.active ? cam.occupancy : 0}</span>
              <span style={{color: cam.active ? 'var(--success)' : 'var(--text-muted)'}}>
                {cam.active ? '● Monitoring' : '○ Offline'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="multi-view-info">
        <MdWarning size={16} />
        <p>Tip: You can drag and drop cameras to reorder them (Premium feature coming soon).</p>
      </div>
    </div>
  );
}
