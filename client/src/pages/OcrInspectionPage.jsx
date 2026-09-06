import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, RefreshCw, AlertCircle, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import OcrImageViewer from '../components/ocr/OcrImageViewer';
import OcrDetectionList from '../components/ocr/OcrDetectionList';
import ExtractedFieldsPanel from '../components/ocr/ExtractedFieldsPanel';
import ComplianceSummary from '../components/ocr/ComplianceSummary';
import { runHybridOcr, getProduct } from '../services/productOcrService';

function OcrInspectionPage() {
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [runningOcr, setRunningOcr] = useState(false);
  const [error, setError] = useState(null);
  
  const [productData, setProductData] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  
  // Toggles
  const [showFullImage, setShowFullImage] = useState(true);
  const [showRoi, setShowRoi] = useState(true);
  const [showRoiCandidates, setShowRoiCandidates] = useState(true);

  // Initialize data
  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProduct(id);
      setProductData(data.data);
      if (data.data.ocr && data.data.ocr.results) {
        setOcrData({
          results: data.data.ocr.results,
          extracted: data.data.extracted,
          category: data.data.category,
          roiEvidence: data.data.roiEvidence || [],
          roiCandidates: data.data.roiCandidates || 0,
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load product data.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunHybridOcr = async () => {
    try {
      setRunningOcr(true);
      setError(null);
      const data = await runHybridOcr(id);
      
      // Update OCR view with new data
      setOcrData({
        results: data.data.ocr.results,
        extracted: data.data.extracted,
        category: data.data.category,
        roiEvidence: data.roiEvidence || [],
        roiCandidates: data.roiCandidates || 0,
        stats: {
          full: data.fullImageDetections,
          fused: data.fusedDetections,
          runtime: data.runtimeMs
        }
      });
      
    } catch (err) {
      setError(`Hybrid OCR failed: ${err.message}`);
    } finally {
      setRunningOcr(false);
    }
  };

  const processDetectionsForUI = () => {
    if (!ocrData || !ocrData.results) return [];
    return ocrData.results.map((r, i) => ({
      ...r,
      id: r.id || `det-${i}`
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <RefreshCw className="animate-spin text-blue-500 mr-2" size={24} />
          <span className="text-gray-600 font-medium">Loading OCR Inspection...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !productData) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-700 mb-2">Error Loading Product</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <Link to="/" className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border rounded shadow-sm hover:bg-gray-50 font-medium transition-colors">
            <ArrowLeft size={16} className="mr-2" /> Return to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const detections = processDetectionsForUI();
  const imageUrl = productData?.image?.url;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link to="/" className="hover:text-blue-600 flex items-center gap-1 transition-colors"><LayoutDashboard size={14} /> Dashboard</Link>
              <span>/</span>
              <span className="font-mono">{id}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Hybrid OCR Inspection</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunHybridOcr}
              disabled={runningOcr || !imageUrl}
              className={`flex items-center gap-2 px-5 py-2.5 rounded shadow-sm font-semibold text-sm transition-colors ${
                runningOcr || !imageUrl 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {runningOcr ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
              {runningOcr ? 'Running OCR...' : 'Run Hybrid OCR'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Top Section: Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Image Area */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Toggles */}
            <div className="bg-white p-3 rounded-lg shadow-sm border flex flex-wrap gap-4 items-center justify-between text-sm">
              <span className="font-bold text-gray-700 uppercase tracking-wide text-xs">Overlays:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={showFullImage} onChange={(e) => setShowFullImage(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                  <span className="font-medium text-gray-700">Full Image OCR</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={showRoi} onChange={(e) => setShowRoi(e.target.checked)} className="rounded text-sky-600 focus:ring-sky-500" />
                  <span className="font-medium text-gray-700">ROI OCR</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={showRoiCandidates} onChange={(e) => setShowRoiCandidates(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                  <span className="font-medium text-gray-700">Weak Candidates</span>
                </label>
              </div>
            </div>

            <OcrImageViewer 
              imageUrl={imageUrl}
              detections={detections}
              roiCandidates={ocrData?.roiEvidence || []}
              showFullImageDetections={showFullImage}
              showRoiDetections={showRoi}
              showRoiCandidates={showRoiCandidates}
              selectedDetectionId={selectedDetectionId}
              onDetectionSelect={setSelectedDetectionId}
            />
            
            {/* Stats Bar */}
            {ocrData?.stats && (
              <div className="bg-gray-50 border rounded-lg p-3 flex flex-wrap gap-6 text-sm">
                <div><span className="text-gray-500 font-medium">Runtime:</span> <span className="font-mono font-bold">{ocrData.stats.runtime}ms</span></div>
                <div><span className="text-gray-500 font-medium">ROI Candidates:</span> <span className="font-mono font-bold">{ocrData.roiCandidates}</span></div>
                <div><span className="text-gray-500 font-medium">Fused Detections:</span> <span className="font-mono font-bold">{ocrData.stats.fused}</span></div>
              </div>
            )}
          </div>

          {/* Detections Sidebar */}
          <div className="lg:h-[800px]">
            <OcrDetectionList 
              detections={detections}
              roiCandidates={ocrData?.roiEvidence || []}
              selectedDetectionId={selectedDetectionId}
              onDetectionSelect={setSelectedDetectionId}
            />
          </div>
        </div>

        {/* Bottom Section: Fields & Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2">
            <ExtractedFieldsPanel fields={ocrData?.extracted || {}} />
          </div>
          <div>
            <ComplianceSummary categoryData={ocrData?.category || {}} />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

export default OcrInspectionPage;
