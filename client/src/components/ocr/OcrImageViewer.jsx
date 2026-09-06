import { useState, useRef, useEffect } from 'react';

function OcrImageViewer({ 
  imageUrl, 
  detections = [], 
  roiCandidates = [],
  showFullImageDetections = true,
  showRoiDetections = true,
  showRoiCandidates = true,
  selectedDetectionId = null,
  onDetectionSelect
}) {
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef(null);

  const handleImageLoad = (e) => {
    setImgSize({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    });
  };

  const calculateBboxDimensions = (bbox) => {
    // bbox is [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
    const x = Math.min(...bbox.map(p => p[0]));
    const y = Math.min(...bbox.map(p => p[1]));
    const width = Math.max(...bbox.map(p => p[0])) - x;
    const height = Math.max(...bbox.map(p => p[1])) - y;
    return { x, y, width, height };
  };

  const calculateYoloDimensions = (bbox) => {
    // YOLO is [cx, cy, w, h] normalized 0.0 - 1.0
    const [cx, cy, w, h] = bbox;
    const absW = w * imgSize.width;
    const absH = h * imgSize.height;
    const x = (cx * imgSize.width) - (absW / 2);
    const y = (cy * imgSize.height) - (absH / 2);
    return { x, y, width: absW, height: absH };
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden bg-gray-50 border rounded-lg shadow-sm flex items-center justify-center min-h-[400px]">
      {!imageUrl ? (
        <span className="text-gray-400">No image available for OCR.</span>
      ) : (
        <div className="relative inline-block max-w-full">
          <img 
            ref={imgRef}
            src={imageUrl} 
            alt="Product for OCR" 
            className="block max-w-full h-auto max-h-[70vh] object-contain"
            onLoad={handleImageLoad}
          />
          
          {imgSize.width > 0 && (
            <svg 
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* ROI Candidates */}
              {showRoiCandidates && roiCandidates.map((candidate, idx) => {
                const { x, y, width, height } = calculateYoloDimensions(candidate.bbox);
                const isSelected = selectedDetectionId === candidate.candidateId;
                
                return (
                  <g key={`roi-cand-${candidate.candidateId || idx}`}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="rgba(234, 88, 12, 0.15)"
                      stroke={isSelected ? "#ea580c" : "rgba(234, 88, 12, 0.8)"}
                      strokeWidth={isSelected ? 4 : 2}
                      strokeDasharray="4 4"
                      className="pointer-events-auto cursor-pointer transition-colors"
                      onClick={() => onDetectionSelect && onDetectionSelect(candidate.candidateId)}
                    />
                    <text
                      x={x}
                      y={Math.max(y - 5, 15)}
                      fill="#ea580c"
                      fontSize="14"
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      Inferred ROI
                    </text>
                  </g>
                );
              })}

              {/* Detections */}
              {detections.map((det, idx) => {
                const isFullImage = det.source === 'full_image';
                const isRoi = det.source === 'roi';
                
                if (isFullImage && !showFullImageDetections) return null;
                if (isRoi && !showRoiDetections) return null;

                const { x, y, width, height } = calculateBboxDimensions(det.bbox);
                const id = det.id || `det-${idx}`;
                const isSelected = selectedDetectionId === id;
                
                const color = isRoi ? "#0284c7" : "#16a34a"; // Sky for ROI, Green for Full Image
                const fillColor = isRoi ? "rgba(2, 132, 199, 0.15)" : "rgba(22, 163, 74, 0.1)";

                return (
                  <g key={id}>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={isSelected ? fillColor : "transparent"}
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="pointer-events-auto cursor-pointer transition-colors hover:fill-current hover:fill-opacity-20"
                      style={isSelected ? { fillOpacity: 0.3 } : {}}
                      onClick={() => onDetectionSelect && onDetectionSelect(id)}
                    />
                    {isSelected && (
                      <text
                        x={x}
                        y={Math.max(y - 5, 12)}
                        fill={color}
                        fontSize="12"
                        fontWeight="bold"
                        className="pointer-events-none drop-shadow-md"
                      >
                        {det.text}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export default OcrImageViewer;
