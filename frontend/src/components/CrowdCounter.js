import React, { useState, useRef, useEffect, useCallback } from 'react';
import './CrowdCounter.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
const COLORS = ['#FF4136','#0074D9','#FF851B','#B10DC9','#FFDC00','#2ECC40','#F012BE','#7FDBFF','#FF6B6B','#01FF70'];

const getColor = (id) => COLORS[(id - 1) % COLORS.length];

const logCrowd = (mode, source, crowd_count, delta, confidence, person_id) =>
  fetch(`${API_BASE_URL}/crowd/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, source, crowd_count, delta, confidence, person_id })
  }).catch(() => {});

const logAlert = (crowd_count, max_capacity, severity, message) =>
  fetch(`${API_BASE_URL}/alerts/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crowd_count, max_capacity, severity, message })
  }).catch(() => {});

// ── shared drawing helper ──────────────────────────────────────────────────
function drawDetections(ctx, detections, sourceW, sourceH, canvasW, canvasH) {
  const sx = canvasW / sourceW;
  const sy = canvasH / sourceH;

  detections.forEach((det) => {
    const [bx1, by1, bx2, by2] = det.bbox;
    const x1 = bx1 * sx, y1 = by1 * sy;
    const w  = (bx2 - bx1) * sx, h = (by2 - by1) * sy;
    const cx = det.centroid ? det.centroid.x * sx : x1 + w / 2;
    const cy = det.centroid ? det.centroid.y * sy : y1 + h / 2;
    const color = getColor(det.id || 1);
    const conf  = (det.confidence * 100).toFixed(1) + '%';

    // bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x1, y1, w, h);

    // accuracy % on top of box
    ctx.font = 'bold 12px Arial';
    const cw = ctx.measureText(conf).width;
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1 - 20, cw + 8, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(conf, x1 + 4, y1 - 5);

    // green centroid dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#00FF00';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ID label beside dot
    const idLabel = `#${det.id}`;
    ctx.font = 'bold 13px Arial';
    const iw = ctx.measureText(idLabel).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(cx + 8, cy - 13, iw + 6, 16);
    ctx.fillStyle = '#00FF00';
    ctx.fillText(idLabel, cx + 11, cy - 1);
  });
}

// ── centroid tracker factory ───────────────────────────────────────────────
function makeTracker() {
  let nextId = 1;
  let previous = [];
  return function track(detections = []) {
    const persons = detections.filter(d => String(d.class || '').toLowerCase() === 'person');
    const usedPrev = new Set();
    const updated = persons.map((det) => {
      const cx = (det.bbox[0] + det.bbox[2]) / 2;
      const cy = (det.bbox[1] + det.bbox[3]) / 2;
      let bestMatch = null, bestDist = 80;
      previous.forEach((p) => {
        if (usedPrev.has(p.id)) return;
        const d = Math.hypot(cx - p.centroid.x, cy - p.centroid.y);
        if (d < bestDist) { bestDist = d; bestMatch = p; }
      });
      const id = bestMatch ? (usedPrev.add(bestMatch.id), bestMatch.id) : nextId++;
      return { ...det, id, centroid: { x: cx, y: cy } };
    });
    previous = updated;
    return updated;
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  MODE 1 — Single camera + line crossing
// ══════════════════════════════════════════════════════════════════════════
function LineCrossingMode({ crowd, setCrowd, maxCapacity }) {
  const [isStreaming, setIsStreaming]   = useState(false);
  const [detData, setDetData]           = useState(null);
  const [error, setError]               = useState('');
  const [camSource, setCamSource]       = useState('device');
  const [deviceId, setDeviceId]         = useState('');
  const [urlInput, setUrlInput]         = useState('');
  const [devices, setDevices]           = useState([]);

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  const streamRef  = useRef(null);
  const processingRef = useRef(false);
  const trackerRef    = useRef(makeTracker());
  const crowdRef = useRef(crowd);
  useEffect(() => { crowdRef.current = crowd; }, [crowd]);

  // track which IDs already crossed which line so we don't double-count
  const crossedEntryRef = useRef(new Set());
  const crossedExitRef  = useRef(new Set());
  const alertFiredRef   = useRef(new Set()); // track which severity already alerted

  // load device list
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const cams = devs.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      if (cams.length) setDeviceId(cams[0].deviceId);
    });
  }, []);

  const start = async () => {
    setError('');
    try {
      let stream;
      if (camSource === 'device') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: 640, height: 480 },
          audio: false
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } else {
        videoRef.current.src = urlInput;
        videoRef.current.crossOrigin = 'anonymous';
      }
      setIsStreaming(true);
      videoRef.current.onloadedmetadata = () => {
        const W = videoRef.current.videoWidth  || 640;
        const H = videoRef.current.videoHeight || 480;
        [canvasRef, overlayRef].forEach(r => { r.current.width = W; r.current.height = H; });
        loop();
      };
    } catch (e) { setError(e.message); }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsStreaming(false);
    setDetData(null);
  };

  const loop = useCallback(() => {
    const send = async () => {
      if (!videoRef.current || (!streamRef.current && camSource === 'device')) return;
      if (processingRef.current) { setTimeout(send, 300); return; }
      // eslint-disable-next-line react-hooks/exhaustive-deps

      const canvas = canvasRef.current;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('image', blob, 'frame.jpg');
        try {
          processingRef.current = true;
          const res = await fetch(`${API_BASE_URL}/crowd/detect`, { method: 'POST', body: fd });
          if (res.ok) {
            const data = await res.json();
            data.detections = trackerRef.current(data.detections || []);

            // ── line crossing logic ──
            const H = canvas.height;
            const entryY = H * 0.30;
            const exitY  = H * 0.70;
            const sy = canvas.height / (data.source_height || 480);

            data.detections.forEach((det) => {
              const cy = det.centroid.y * sy;
              if (cy >= entryY && !crossedEntryRef.current.has(det.id)) {
                crossedEntryRef.current.add(det.id);
                crossedExitRef.current.delete(det.id);
                const newCount = crowdRef.current + 1;
                setCrowd(newCount);
                logCrowd('line_crossing', 'line', newCount, 1, det.confidence, det.id);
                // alert check
                const pct = newCount / maxCapacity;
                if (pct >= 1.0 && !alertFiredRef.current.has('critical')) {
                  alertFiredRef.current.add('critical');
                  logAlert(newCount, maxCapacity, 'critical', `CRITICAL: Crowd ${newCount} reached full capacity ${maxCapacity}`);
                } else if (pct >= 0.7 && !alertFiredRef.current.has('warning')) {
                  alertFiredRef.current.add('warning');
                  logAlert(newCount, maxCapacity, 'warning', `WARNING: Crowd ${newCount} is at ${Math.round(pct*100)}% of capacity ${maxCapacity}`);
                }
                if (pct < 0.7) alertFiredRef.current.clear();
              }
              if (cy >= exitY && crossedEntryRef.current.has(det.id) && !crossedExitRef.current.has(det.id)) {
                crossedExitRef.current.add(det.id);
                const newCount = Math.max(0, crowdRef.current - 1);
                setCrowd(newCount);
                logCrowd('line_crossing', 'line', newCount, -1, det.confidence, det.id);
              }
            });

            setDetData({ ...data, canvasW: canvas.width, canvasH: canvas.height });
          }
        } catch (_) {}
        finally { processingRef.current = false; }
      }, 'image/jpeg', 0.6);
      setTimeout(send, 300);
    };
    send();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camSource, maxCapacity, setCrowd]);

  // draw overlay
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detData) return;

    const H = canvas.height;
    const W = canvas.width;

    // entry line (green) at 30%
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(0, H * 0.30); ctx.lineTo(W, H * 0.30); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('▶ ENTRY LINE', 8, H * 0.30 - 6);

    // exit line (red) at 70%
    ctx.strokeStyle = '#FF4136';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(0, H * 0.70); ctx.lineTo(W, H * 0.70); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF4136';
    ctx.fillText('▶ EXIT LINE', 8, H * 0.70 - 6);

    drawDetections(ctx, detData.detections || [], detData.source_width || 640, detData.source_height || 480, W, H);
  }, [detData]);

  return (
    <div className="cc-panel">
      <h3>📹 Mode 1 — Line Crossing (Single Camera)</h3>

      {!isStreaming && (
        <div className="cc-controls">
          <div className="cc-source-toggle">
            <label><input type="radio" value="device" checked={camSource==='device'} onChange={()=>setCamSource('device')}/> Device Camera</label>
            <label><input type="radio" value="url"    checked={camSource==='url'}    onChange={()=>setCamSource('url')}/> URL / RTSP</label>
          </div>
          {camSource === 'device' ? (
            <select value={deviceId} onChange={e=>setDeviceId(e.target.value)} className="cc-select">
              {devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Camera'}</option>)}
            </select>
          ) : (
            <input className="cc-input" placeholder="http:// or rtsp://" value={urlInput} onChange={e=>setUrlInput(e.target.value)}/>
          )}
          <button className="cc-btn-start" onClick={start}>🎥 Start</button>
        </div>
      )}
      {isStreaming && <button className="cc-btn-stop" onClick={stop}>⛔ Stop</button>}
      {error && <div className="cc-error">{error}</div>}

      <div className="cc-video-wrap">
        <video ref={videoRef} autoPlay playsInline className="cc-video" width={640} height={480}/>
        <canvas ref={canvasRef} style={{display:'none'}}/>
        <canvas ref={overlayRef} className="cc-overlay" width={640} height={480}/>
      </div>

      {detData && (
        <div className="cc-stats-row">
          <span>👥 Detected: <b>{detData.person_count}</b></span>
          <span>🎯 Confidence: <b>{Math.round((detData.confidence_score||0)*100)}%</b></span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  MODE 2 — Dual camera IN / OUT
// ══════════════════════════════════════════════════════════════════════════
function DualCameraMode({ setCrowd, maxCapacity }) {
  return (
    <div className="cc-dual">
      <SingleFeed label="IN  ➕" role="in"  setCrowd={setCrowd} maxCapacity={maxCapacity} />
      <SingleFeed label="OUT ➖" role="out" setCrowd={setCrowd} maxCapacity={maxCapacity} />
    </div>
  );
}

function SingleFeed({ label, role, setCrowd, maxCapacity }) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [detData, setDetData]         = useState(null);
  const [error, setError]             = useState('');
  const [camSource, setCamSource]     = useState('device');
  const [deviceId, setDeviceId]       = useState('');
  const [urlInput, setUrlInput]       = useState('');
  const [devices, setDevices]         = useState([]);

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  const streamRef  = useRef(null);
  const processingRef  = useRef(false);
  const trackerRef     = useRef(makeTracker());
  const crowdRef = useRef(0);
  const countedIdsRef  = useRef(new Set());
  const alertFiredRef  = useRef(new Set());

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      const cams = devs.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      // default: IN picks first cam, OUT picks second if available
      const idx = role === 'out' && cams.length > 1 ? 1 : 0;
      if (cams[idx]) setDeviceId(cams[idx].deviceId);
    });
  }, [role]);

  const start = async () => {
    setError('');
    try {
      if (camSource === 'device') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: 640, height: 480 },
          audio: false
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      } else {
        videoRef.current.src = urlInput;
        videoRef.current.crossOrigin = 'anonymous';
      }
      setIsStreaming(true);
      videoRef.current.onloadedmetadata = () => {
        const W = videoRef.current.videoWidth  || 640;
        const H = videoRef.current.videoHeight || 480;
        [canvasRef, overlayRef].forEach(r => { r.current.width = W; r.current.height = H; });
        sendLoop();
      };
    } catch (e) { setError(e.message); }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsStreaming(false);
    setDetData(null);
  };

  const sendLoop = () => {
    const send = async () => {
      if (!videoRef.current) return;
      if (processingRef.current) { setTimeout(send, 300); return; }

      const canvas = canvasRef.current;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        const fd = new FormData();
        fd.append('image', blob, 'frame.jpg');
        try {
          processingRef.current = true;
          const res = await fetch(`${API_BASE_URL}/crowd/detect`, { method: 'POST', body: fd });
          if (res.ok) {
            const data = await res.json();
            data.detections = trackerRef.current(data.detections || []);

            // count only NEW IDs seen in this feed
            data.detections.forEach((det) => {
              if (!countedIdsRef.current.has(det.id)) {
                countedIdsRef.current.add(det.id);
                const delta = role === 'in' ? 1 : -1;
                const newCount = role === 'in'
                  ? crowdRef.current + 1
                  : Math.max(0, crowdRef.current - 1);
                crowdRef.current = newCount;
                setCrowd(newCount);
                logCrowd('dual_camera', role, newCount, delta, det.confidence, det.id);
                // alert check (only on IN side)
                if (role === 'in') {
                  const pct = newCount / maxCapacity;
                  if (pct >= 1.0 && !alertFiredRef.current.has('critical')) {
                    alertFiredRef.current.add('critical');
                    logAlert(newCount, maxCapacity, 'critical', `CRITICAL: Crowd ${newCount} reached full capacity ${maxCapacity}`);
                  } else if (pct >= 0.7 && !alertFiredRef.current.has('warning')) {
                    alertFiredRef.current.add('warning');
                    logAlert(newCount, maxCapacity, 'warning', `WARNING: Crowd ${newCount} is at ${Math.round(pct*100)}% of capacity ${maxCapacity}`);
                  }
                  if (pct < 0.7) alertFiredRef.current.clear();
                }
              }
            });

            setDetData({ ...data, canvasW: canvas.width, canvasH: canvas.height });
          }
        } catch (_) {}
        finally { processingRef.current = false; }
      }, 'image/jpeg', 0.6);
      setTimeout(send, 300);
    };
    send();
  };

  // draw overlay
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !detData) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDetections(ctx, detData.detections || [], detData.source_width || 640, detData.source_height || 480, canvas.width, canvas.height);
  }, [detData]);

  const borderColor = role === 'in' ? '#2ECC40' : '#FF4136';

  return (
    <div className="cc-single-feed" style={{ borderColor }}>
      <h4 style={{ color: borderColor }}>{label} Camera</h4>

      {!isStreaming && (
        <div className="cc-controls">
          <div className="cc-source-toggle">
            <label><input type="radio" value="device" checked={camSource==='device'} onChange={()=>setCamSource('device')}/> Device</label>
            <label><input type="radio" value="url"    checked={camSource==='url'}    onChange={()=>setCamSource('url')}/> URL</label>
          </div>
          {camSource === 'device' ? (
            <select value={deviceId} onChange={e=>setDeviceId(e.target.value)} className="cc-select">
              {devices.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||'Camera'}</option>)}
            </select>
          ) : (
            <input className="cc-input" placeholder="http:// or rtsp://" value={urlInput} onChange={e=>setUrlInput(e.target.value)}/>
          )}
          <button className="cc-btn-start" onClick={start}>🎥 Start</button>
        </div>
      )}
      {isStreaming && <button className="cc-btn-stop" onClick={stop}>⛔ Stop</button>}
      {error && <div className="cc-error">{error}</div>}

      <div className="cc-video-wrap">
        <video ref={videoRef} autoPlay playsInline className="cc-video" width={640} height={480}/>
        <canvas ref={canvasRef} style={{display:'none'}}/>
        <canvas ref={overlayRef} className="cc-overlay" width={640} height={480}/>
      </div>

      {detData && (
        <div className="cc-stats-row">
          <span>👥 <b>{detData.person_count}</b></span>
          <span>🎯 <b>{Math.round((detData.confidence_score||0)*100)}%</b></span>
          <span>IDs counted: <b>{countedIdsRef.current.size}</b></span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  ROOT — mode switcher
// ══════════════════════════════════════════════════════════════════════════
export default function CrowdCounter({ crowd, setCrowd, maxCapacity }) {
  const [mode, setMode] = useState('line');

  return (
    <div className="cc-root">
      <div className="cc-mode-bar">
        <span className="cc-mode-label">Counting Mode:</span>
        <button className={`cc-mode-btn ${mode==='line' ? 'active':''}`} onClick={()=>setMode('line')}>
          📏 Line Crossing
        </button>
        <button className={`cc-mode-btn ${mode==='dual' ? 'active':''}`} onClick={()=>setMode('dual')}>
          📷📷 Dual Camera
        </button>
      </div>

      {mode === 'line' ? (
        <LineCrossingMode crowd={crowd} setCrowd={setCrowd} maxCapacity={maxCapacity} />
      ) : (
        <DualCameraMode crowd={crowd} setCrowd={setCrowd} maxCapacity={maxCapacity} />
      )}
    </div>
  );
}
