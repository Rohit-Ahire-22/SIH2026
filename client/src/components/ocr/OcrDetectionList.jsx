import { CheckCircle2, ScanLine } from 'lucide-react';

function OcrDetectionList({
  detections = [],
  roiCandidates = [],
  selectedDetectionId = null,
  onDetectionSelect
}) {
  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700">
        Detection Inspector
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {/* ROI Candidates Section */}
        {roiCandidates.length > 0 && (
          <div className="mb-4">
            <h3 className="px-2 text-xs font-bold text-gray-500 uppercase mb-2 mt-2">Weak ROI Candidates</h3>
            <div className="space-y-1">
              {roiCandidates.map((candidate, idx) => {
                const id = candidate.candidateId || `cand-${idx}`;
                const isSelected = selectedDetectionId === id;
                return (
                  <div 
                    key={id}
                    onClick={() => onDetectionSelect(id)}
                    className={`p-3 rounded-md cursor-pointer border transition-colors ${
                      isSelected ? 'bg-orange-50 border-orange-200' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                        <ScanLine size={14} className="text-orange-500" />
                        Inferred ROI
                      </span>
                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {(candidate.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                      Type: <span className="font-mono bg-orange-100 text-orange-700 px-1 rounded">{candidate.type || candidate.className || 'declaration_panel'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fused Detections Section */}
        <h3 className="px-2 text-xs font-bold text-gray-500 uppercase mb-2 mt-4">OCR Detections</h3>
        {detections.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">No text detected.</div>
        ) : (
          <div className="space-y-1">
            {detections.map((det, idx) => {
              const id = det.id || `det-${idx}`;
              const isSelected = selectedDetectionId === id;
              const isRoi = det.source === 'roi';
              
              const baseBg = isRoi ? 'bg-sky-50/50' : 'bg-white';
              const hoverBg = isRoi ? 'hover:bg-sky-50' : 'hover:bg-gray-50';
              const selectedBg = isRoi ? 'bg-sky-100 border-sky-200' : 'bg-green-50 border-green-200';
              const sourceColor = isRoi ? 'text-sky-600 bg-sky-100' : 'text-green-700 bg-green-100';

              return (
                <div 
                  key={id}
                  onClick={() => onDetectionSelect(id)}
                  className={`p-3 rounded-md cursor-pointer border transition-colors ${
                    isSelected ? selectedBg : `${baseBg} border-transparent ${hoverBg} hover:border-gray-200`
                  }`}
                >
                  <div className="font-mono text-sm text-gray-900 break-words mb-2 leading-tight">
                    {det.text}
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${sourceColor}`}>
                      {isRoi ? 'ROI CROP' : 'FULL IMAGE'}
                    </span>
                    <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                      <CheckCircle2 size={12} className={det.confidence > 0.8 ? 'text-green-500' : 'text-amber-500'}/>
                      {(det.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default OcrDetectionList;
