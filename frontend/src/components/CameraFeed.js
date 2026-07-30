import React, { useState, useRef, useEffect } from 'react';
import './CameraFeed.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
const UPDATE_SPEED = 300;

function CameraFeed() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectionData, setDetectionData] = useState(null);
  const [error, setError] = useState('');

  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);
  const overlayRef      = useRef(null);
  const streamRef       = useRef(null);
  const processingRef   = useRef(false);
  const trackerRef      = useRef({ nextId: 1, previous: [] });

  const COLORS = ['#FF4136','#2ECC40','#0074D9','#FF851B','#B10DC9','#FFDC00','#01FF70','#F012BE','#7FDBFF','#FF6B6B'];
  const getColor = (id) => COLORS[(id - 1) % COLORS.length];

  const assignTrackingIds = (detections = []) => {
    const persons = detections.filter(d => String(d.class || '').toLowerCase() === 'person');
    const prev = trackerRef.current.previous;
    const usedPrev = new Set();

    const updated = persons.map((det) => {
      const cx = (det.bbox[0] + det.bbox[2]) / 2;
      const cy = (det.bbox[1] + det.bbox[3]) / 2;
      let bestMatch = null, bestDist = 80;

      prev.forEach((p) => {
        if (usedPrev.has(p.id)) return;
        const dist = Math.hypot(cx - p.centroid.x, cy - p.centroid.y);
        if (dist < bestDist) { bestDist = dist; bestMatch = p; }
      });

      const id = bestMatch ? (usedPrev.add(bestMatch.id), bestMatch.id) : trackerRef.current.nextId++;
      return { ...det, id, centroid: { x: cx, y: cy } };
    });

    trackerRef.current.previous = updated;
    return updated;
  };

  const startWebcam = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsStreaming(true);

      videoRef.current.onloadedmetadata = () => {
        const W = videoRef.current.videoWidth  || 640;
        const H = videoRef.current.videoHeight || 480;
        canvasRef.current.width  = W; canvasRef.current.height  = H;
        overlayRef.current.width = W; overlayRef.current.height = H;
        overlayRef.current.style.width  = W + 'px';
        overlayRef.current.style.height = H + 'px';
        sendLoop();
      };
    } catch (err) {
      setError(`Camera error: ${err.message}`);
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsStreaming(false);
    setDetectionData(null);
  };

  const sendLoop = () => {
    const send = async () => {
      if (!streamRef.current) return;
      if (processingRef.current) { setTimeout(send, UPDATE_SPEED); return; }

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
            data.detections = assignTrackingIds(data.detections || []);
            setDetectionData(data);
          }
        } catch (_) {}
        finally { processingRef.current = false; }
      }, 'image/jpeg', 0.6);

      setTimeout(send, UPDATE_SPEED);
    };
    send();
  };

  // draw bounding boxes whenever detectionData changes
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detectionData || !Array.isArray(detectionData.detections)) return;

    const sx = canvas.width  / (detectionData.source_width  || 640);
    const sy = canvas.height / (detectionData.source_height || 480);

    detectionData.detections.forEach((det) => {
      if (!det.bbox || det.bbox.length < 4) return;
      const x1 = det.bbox[0] * sx, y1 = det.bbox[1] * sy;
      const w  = (det.bbox[2] - det.bbox[0]) * sx;
      const h  = (det.bbox[3] - det.bbox[1]) * sy;
      const cx = det.centroid ? det.centroid.x * sx : x1 + w / 2;
      const cy = det.centroid ? det.centroid.y * sy : y1 + h / 2;
      const color = getColor(det.id || 1);
      const conf  = (det.confidence * 100).toFixed(1) + '%';

      // bounding box
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.strokeRect(x1, y1, w, h);

      // accuracy % label on top
      ctx.font = 'bold 12px Arial';
      const cw = ctx.measureText(conf).width;
      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - 20, cw + 8, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(conf, x1 + 4, y1 - 5);

      // green centroid dot
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#00FF00'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();

      // ID label beside dot
      const idLabel = `#${det.id}`;
      ctx.font = 'bold 13px Arial';
      const iw = ctx.measureText(idLabel).width;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(cx + 8, cy - 13, iw + 6, 16);
      ctx.fillStyle = '#00FF00';
      ctx.fillText(idLabel, cx + 11, cy - 1);
    });
  }, [detectionData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="camera-feed-container">
      <h2>📹 Live Camera Feed</h2>
      {error && <div className="error-message">{error}</div>}

      {!isStreaming ? (
        <button onClick={startWebcam} className="start-webcam-btn">Start Camera</button>
      ) : (
        <button onClick={stopWebcam} className="stop-webcam-btn">Stop Camera</button>
      )}

      <div className="video-section">
        <video ref={videoRef} className="video-feed" autoPlay playsInline width="640" height="480" />
        <canvas ref={canvasRef} style={{ display: 'none' }} />        <canvas ref={overlayRef} className="overlay-canvas" width="640" height="480" />
      </div>

      {detectionData && (
        <div className="detection-results">
          <p>Persons detected: <strong>{detectionData.person_count}</strong></p>
          <p>Confidence: <strong>{Math.round((detectionData.confidence_score || 0) * 100)}%</strong></p>
        </div>
      )}
    </div>
  );
}

export default CameraFeed;
