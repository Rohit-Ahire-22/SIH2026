# Pretrained Model Selection (v2)

This report details the evaluation of YOLO/Object Detection architectures specifically for fine-tuning on the SIH Legal Metrology dataset, factoring in hardware constraints (6GB VRAM) and commercial licensing risks.

## Evaluated Models

### 1. YOLOv8 Nano (`yolov8n.pt`)
- **Source**: Ultralytics
- **License**: AGPL-3.0 (Commercial use requires open-sourcing the surrounding codebase or purchasing an Enterprise license).
- **Weights License**: AGPL-3.0
- **Size**: Very small (3.2M parameters)
- **GPU Memory**: Extremely low (~1-2GB VRAM during training with small batch size)
- **Suitability**: Excellent for mobile deployment and fast inference on edge devices. Fits perfectly on the local RTX 3050.
- **License Risk**: High. AGPL-3.0 is viral and typically prohibited in government/proprietary corporate codebases unless heavily isolated via microservices (which our current FastAPI architecture supports, but remains a legal grey area).

### 2. YOLO11 Nano (`yolo11n.pt`)
- **Source**: Ultralytics
- **License**: AGPL-3.0
- **Weights License**: AGPL-3.0
- **Size**: 2.6M parameters (Fewer params, higher mAP than v8)
- **GPU Memory**: Very low (~1-2GB VRAM)
- **Suitability**: Excellent technical capability.
- **License Risk**: High (Same as YOLOv8).

### 3. YOLOv7 Tiny
- **Source**: WongKinYiu GitHub
- **License**: GPL-3.0
- **License Risk**: High (Viral GPL).

### 4. YOLOX Nano
- **Source**: Megvii
- **License**: Apache 2.0
- **Weights License**: Apache 2.0
- **Size**: ~1M parameters
- **GPU Memory**: Extremely low
- **Suitability**: Highly permissive commercial license. Harder to train ecosystem compared to Ultralytics.
- **License Risk**: Zero.

### 5. RT-DETR (Real-Time DEtection TRansformer)
- **Source**: Baidu / Ultralytics port
- **License**: Apache 2.0 (Baidu original) / AGPL-3.0 (Ultralytics ecosystem)
- **GPU Memory**: High. Will likely OOM on a 6GB RTX 3050.

## Hardware Feasibility (RTX 3050 6GB)
- **Estimated VRAM for YOLOv8n/11n Training**: 2.5 GB (at batch size 8, img_size 640).
- **Recommended Image Size**: `640x640`. (Do not attempt `1280` or higher, it will cause OOM).
- **Batch Size Range**: 4 to 16.
- **CPU Fallback**: Available, but training would take days instead of hours.

## Recommendation
For technical ease and SIH prototype demonstration, **YOLO11n (Ultralytics)** is recommended. However, to comply with the AGPL-3.0 license, the Python AI Service (`ai-service`) must remain strictly isolated as an independent microservice accessed over the network (which is already our architecture) or the project must prepare to open-source the AI service code. If open-sourcing the AI service is strictly forbidden by project stakeholders, **YOLOX Nano (Apache 2.0)** must be used instead.
