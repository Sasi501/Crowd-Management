"""
Computer Vision Service for Crowd Detection
Uses YOLOv8 for real-time person detection
"""

from typing import Tuple, List
import logging
import cv2
import numpy as np
import time

logger = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("YOLOv8 not installed. Run: pip install ultralytics")

try:
    import torch
    GPU_AVAILABLE = torch.cuda.is_available()
    GPU_DEVICE = "0" if GPU_AVAILABLE else "cpu"
    if GPU_AVAILABLE:
        logger.info(f"GPU Available: {torch.cuda.get_device_name(0)}")
    else:
        logger.warning("GPU not available, using CPU")
except ImportError:
    GPU_AVAILABLE = False
    GPU_DEVICE = "cpu"


class CrowdDetectionService:
    _model_cache = {}

    def __init__(self, model_path: str = "yolov8n.pt", confidence_threshold: float = 0.35):
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.model = self._get_cached_model(model_path)
        self.last_inference_time = 0

    @classmethod
    def _get_cached_model(cls, model_path: str):
        if model_path in cls._model_cache:
            return cls._model_cache[model_path]
        if not YOLO_AVAILABLE:
            logger.error("ultralytics is not installed. Run: pip install ultralytics")
            cls._model_cache[model_path] = None
            return None
        import os
        if not os.path.exists(model_path):
            logger.warning(f"Model file '{model_path}' not found locally. YOLO will attempt to auto-download it.")
        try:
            model = YOLO(model_path)
            model.to(GPU_DEVICE)
            # warm-up pass so the first real frame isn't slow
            dummy = np.random.randint(0, 255, (416, 416, 3), dtype=np.uint8)
            _ = model(dummy, verbose=False, conf=0.5)
            cls._model_cache[model_path] = model
            logger.info(f"✓ YOLO {model_path} loaded on {GPU_DEVICE.upper()}")
            return model
        except Exception as e:
            logger.error(f"✗ Failed to load YOLO model '{model_path}': {e}")
            logger.warning("Server will continue running but detection will return empty results until the model is available.")
            cls._model_cache[model_path] = None
            return None

    async def detect_crowd(self, frame) -> Tuple[int, float, List]:
        """
        Detect persons in a frame.
        Returns: (person_count, avg_confidence, detections_list)
        """
        try:
            if frame is None or not isinstance(frame, np.ndarray):
                return 0, 0.0, []
            if self.model is None:
                return 0, 0.0, []

            frame_resized = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_LINEAR)
            inference_start = time.time()

            results = self.model(
                frame_resized,
                conf=self.confidence_threshold,
                verbose=False,
                device=GPU_DEVICE,
                iou=0.35,
                max_det=50
            )

            self.last_inference_time = time.time() - inference_start

            detections = []
            person_count = 0
            confidence_scores = []

            for result in results:
                if hasattr(result, 'boxes') and result.boxes is not None:
                    boxes = result.boxes
                    for i in range(len(boxes)):
                        try:
                            cls  = int(boxes.cls[i])
                            conf = float(boxes.conf[i])
                            if cls == 0:
                                person_count += 1
                                confidence_scores.append(conf)
                                if hasattr(boxes, 'xyxy'):
                                    xyxy = boxes.xyxy[i].tolist()
                                    sx = frame.shape[1] / 640
                                    sy = frame.shape[0] / 480
                                    detections.append({
                                        'bbox': [xyxy[0]*sx, xyxy[1]*sy, xyxy[2]*sx, xyxy[3]*sy],
                                        'confidence': conf,
                                        'class': 'person'
                                    })
                        except Exception as e:
                            logger.debug(f"Box error: {e}")
                            continue

            avg_confidence = float(np.mean(confidence_scores)) if confidence_scores else 0.0
            return person_count, avg_confidence, detections[:15]

        except Exception as e:
            logger.error(f"Detection error: {e}")
            return 0, 0.0, []


# Global instance
crowd_detection_service = CrowdDetectionService()
