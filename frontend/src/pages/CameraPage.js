import React from 'react';
import CrowdCounter from '../components/CrowdCounter';
import { MdVideocam, MdInfo } from 'react-icons/md';

export default function CameraPage({ currentOccupancy, setCrowd, maxCapacity, setEntries, setExits }) {
  return (
    <div className="page-content">

      <div className="page-header-row">
        <div>
          <h2 className="page-title"><MdVideocam size={20} style={{marginRight:8}} />Live Camera Feed</h2>
          <p className="page-subtitle">Real-time person detection and crowd counting via AI</p>
        </div>
        <div className="camera-status-pill">
          <span className="live-dot" />
          Live
        </div>
      </div>

      <div className="camera-info-bar">
        <MdInfo size={14} style={{flexShrink:0, color:'var(--info)'}} />
        <span>Select a counting mode below. <strong>Line Crossing</strong> uses a single camera with virtual entry/exit lines. <strong>Dual Camera</strong> uses separate IN and OUT cameras.</span>
      </div>

      <CrowdCounter
        crowd={currentOccupancy}
        setCrowd={setCrowd}
        maxCapacity={maxCapacity}
        setEntries={setEntries}
        setExits={setExits}
      />

    </div>
  );
}
