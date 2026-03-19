"""
Computer Vision Service for Crowd Detection
Uses YOLOv8 for real-time person detection with GPU optimization
"""

import asyncio
from typing import Optional, Tuple, List
import logging
import cv2
import numpy as np
import time

logger = logging.getLogger(__name__)

# Try to import YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("YOLOv8 not installed. Install with: pip install ultralytics")

# Check GPU availability
try:
    import torch
    GPU_AVAILABLE = torch.cuda.is_available()
    GPU_DEVICE = "0" if GPU_AVAILABLE else "cpu"
    if GPU_AVAILABLE:
        logger.info(f"GPU Available: {torch.cuda.get_device_name(0)}")
    else:
        logger.warning("GPU not available, using CPU (will be slower)")
except ImportError:
    GPU_AVAILABLE = False
    GPU_DEVICE = "cpu"
    logger.warning("PyTorch not available, cannot use GPU acceleration")


class CrowdDetectionService:
    """Service for detecting crowds using YOLOv8 with GPU acceleration"""
    
    # Class-level model cache to avoid reloading
    _model_cache = {}

    def __init__(self, model_path: str = "yolov8n.pt", confidence_threshold: float = 0.35):
        """
        Initialize crowd detection service
        Uses yolov8n (nano - lightest model for speed)
        confidence_threshold: 0.35 for CPU speed (lower = faster NMS)
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.model = self._get_cached_model(model_path)
        self.last_inference_time = 0

    @classmethod
    def _get_cached_model(cls, model_path: str):
        """Get model from cache or load it with GPU support"""
        if model_path not in cls._model_cache:
            try:
                if YOLO_AVAILABLE:
                    # Load model with GPU if available
                    model = YOLO(model_path)
                    model.to(GPU_DEVICE)  # Move to GPU
                    
                    # Warm up the model with a dummy inference
                    dummy = np.random.randint(0, 255, (416, 416, 3), dtype=np.uint8)
                    _ = model(dummy, verbose=False, conf=0.5)
                    
                    cls._model_cache[model_path] = model
                    logger.info(f"✓ YOLO {model_path} loaded on {GPU_DEVICE.upper()}")
                    return model
            except Exception as e:
                logger.error(f"✗ Failed to load YOLO model: {e}")
                return None
        return cls._model_cache.get(model_path)

    def _load_model(self):
        """Load YOLO model - deprecated, use _get_cached_model instead"""
        if not YOLO_AVAILABLE:
            logger.warning("YOLOv8 not available. Install ultralytics: pip install ultralytics")
            return
        
        self.model = self._get_cached_model(self.model_path)

    async def detect_crowd(self, frame) -> Tuple[int, float, List]:
        """
        Detect crowd in a video frame using YOLOv8 with GPU/CPU optimization
        For CPU: Uses smaller model and frame resizing for speed
        Returns: (person_count, confidence_score, detections_list)
        """
        try:
            if frame is None or not isinstance(frame, np.ndarray):
                logger.error("Invalid frame provided")
                return 0, 0.0, []

            if self.model is None:
                logger.warning("YOLO model not initialized")
                return 0, 0.0, []

            # Resize keeping aspect ratio (use 640x480 as working resolution so output coordinates match video size)
            frame_resized = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_LINEAR)

            # Measure inference time
            inference_start = time.time()
            
            # Run YOLO inference with optimizations for speed
            results = self.model(
                frame_resized, 
                conf=self.confidence_threshold,  # Lower threshold = faster
                verbose=False,
                device=GPU_DEVICE,
                iou=0.35,  # Very aggressive NMS for speed
                max_det=50  # Limit max detections
            )
            
            inference_time = time.time() - inference_start
            self.last_inference_time = inference_time
            
            # Extract person detections
            detections = []
            person_count = 0
            confidence_scores = []

            for result in results:
                if hasattr(result, 'boxes') and result.boxes is not None:
                    boxes = result.boxes
                    
                    for i in range(len(boxes)):
                        try:
                            cls = int(boxes.cls[i])
                            conf = float(boxes.conf[i])
                            
                            # Only count persons (class 0)
                            if cls == 0:
                                person_count += 1
                                confidence_scores.append(conf)
                                
                                if hasattr(boxes, 'xyxy'):
                                    xyxy = boxes.xyxy[i].tolist()

                                    # Coordinate mapping from 640x480 model input to original frame
                                    scale_x = frame.shape[1] / 640
                                    scale_y = frame.shape[0] / 480
                                    bbox = [
                                      xyxy[0] * scale_x,
                                      xyxy[1] * scale_y,
                                      xyxy[2] * scale_x,
                                      xyxy[3] * scale_y
                                    ]


                                    detections.append({
                                        'bbox': bbox,
                                        'confidence': conf,
                                        'class': 'person'
                                    })
                        except Exception as e:
                            logger.debug(f"Error processing box: {e}")
                            continue

            # Calculate average confidence
            avg_confidence = float(np.mean(confidence_scores)) if confidence_scores else 0.0

            logger.debug(f"👥 {person_count} | 🎯 {avg_confidence:.1%} | ⏱️ {inference_time:.2f}s")
            
            return person_count, avg_confidence, detections[:15]

        except Exception as e:
            logger.error(f"Detection error: {e}")
            return 0, 0.0, []

    async def process_video_stream(self, camera_url: str, camera_id: str) -> dict:
        """
        Process video stream from camera
        """
        try:
            if self.model is None:
                return {
                    'camera_id': camera_id,
                    'error': 'YOLO model not available',
                    'frames_processed': 0,
                    'total_persons_detected': 0,
                    'average_confidence': 0.0,
                    'processing_time': 0.0,
                    'detections': []
                }

            # Open video stream
            cap = cv2.VideoCapture(camera_url)
            
            if not cap.isOpened():
                raise Exception(f"Cannot open camera stream: {camera_url}")

            total_persons = 0
            frames_processed = 0
            confidence_scores = []
            sample_detections = []

            # Process frames (limit to 100 for demo)
            while frames_processed < 100 and cap.isOpened():
                ret, frame = cap.read()
                
                if not ret:
                    break

                # Resize frame for faster processing
                frame = cv2.resize(frame, (640, 480))
                
                # Run detection
                person_count, avg_conf, detections = await self.detect_crowd(frame)
                
                total_persons += person_count
                frames_processed += 1
                
                if avg_conf > 0:
                    confidence_scores.append(avg_conf)
                
                # Keep sample detections
                if len(sample_detections) < 10:
                    sample_detections.extend(detections[:5])

            cap.release()

            avg_confidence = float(np.mean(confidence_scores)) if confidence_scores else 0.0

            results = {
                'camera_id': camera_id,
                'frames_processed': frames_processed,
                'total_persons_detected': total_persons,
                'average_confidence': avg_confidence,
                'avg_persons_per_frame': total_persons / frames_processed if frames_processed > 0 else 0,
                'detections': sample_detections[:10]
            }

            logger.info(f"Stream processing complete: {results}")
            return results

        except Exception as e:
            logger.error(f"Error processing video stream {camera_id}: {e}")
            return {
                'camera_id': camera_id,
                'error': str(e),
                'frames_processed': 0,
                'total_persons_detected': 0,
                'average_confidence': 0.0,
                'processing_time': 0.0,
                'detections': []
            }

    def save_detection_image(self, frame, detections: List, output_path: str) -> str:
        """
        Save frame with detection bounding boxes
        """
        try:
            frame_copy = frame.copy()
            
            # Draw bounding boxes
            for detection in detections:
                bbox = detection['bbox']
                conf = detection['confidence']
                
                # Convert to integers
                x1, y1, x2, y2 = map(int, bbox)
                
                # Draw rectangle
                cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Draw label
                label = f"Person {conf:.2f}"
                cv2.putText(frame_copy, label, (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
            # Save image
            cv2.imwrite(output_path, frame_copy)
            logger.info(f"Detection image saved to {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error saving detection image: {e}")
            return ""

    async def get_camera_health(self, camera_url: str) -> dict:
        """
        Check camera health and connectivity
        """
        try:
            cap = cv2.VideoCapture(camera_url)
            
            if not cap.isOpened():
                return {
                    'is_connected': False,
                    'error': f'Cannot connect to {camera_url}',
                    'timestamp': ""
                }

            # Read one frame to check
            ret, frame = cap.read()
            is_connected = ret and frame is not None
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            cap.release()

            return {
                'is_connected': is_connected,
                'fps': fps if fps > 0 else 30,
                'resolution': {'width': width, 'height': height},
                'codec': 'H.264',
                'timestamp': ""
            }

        except Exception as e:
            logger.error(f"Error checking camera health: {e}")
            return {
                'is_connected': False,
                'error': str(e),
                'timestamp': ""
            }


# Global instance
crowd_detection_service = CrowdDetectionService()