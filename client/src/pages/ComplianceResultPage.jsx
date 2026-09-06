import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, LayoutDashboard, Calendar, Search } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import ExtractedFieldsPanel from '../components/ocr/ExtractedFieldsPanel';
import OcrImageViewer from '../components/ocr/OcrImageViewer';
import { API_URL } from '../config';

function ComplianceResultPage() {
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  
  // Toggles for OCR viewer if we show it
  const [showFullImage, setShowFullImage] = useState(true);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/products/${id}`, {
        credentials: 'include'
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load product result');
      setProductData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <span className="text-gray-600 font-medium">Loading Result...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !productData) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-700 mb-2">Error Loading Result</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <Link to="/" className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border rounded shadow-sm hover:bg-gray-50 font-medium transition-colors">
            <ArrowLeft size={16} className="mr-2" /> Return to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!productData) return null;

  const { complianceStatus, complianceDetails, analysisStatus, category, ocrResults, images } = productData;
  const isPass = complianceStatus === 'PASS';
  const isFail = complianceStatus === 'FAIL';
  const isReview = complianceStatus === 'REVIEW';

  const imageUrl = images && images.length > 0 ? images[images.length - 1].url : null;
  const detections = ocrResults && ocrResults.length > 0 ? ocrResults[ocrResults.length - 1].results.map((r, i) => ({...r, id: r.id || `det-${i}`})) : [];
  
  const extracted = {
    mrp: productData.mrp,
    netQuantity: productData.netQuantity,
    batchLotNumber: productData.batchLotNumber,
    dateOfManufacture: productData.dateOfManufacture,
    dateOfPacking: productData.dateOfPacking,
    expiryOrUseByDate: productData.expiryOrUseByDate,
    countryOfOrigin: productData.countryOfOrigin,
    manufacturerName: productData.manufacturerName,
    consumerCareDetails: productData.consumerCareDetails,
  };

  const getRuleChecks = (ruleResult) => {
    if (!ruleResult || !ruleResult.checks) return [];
    return ruleResult.checks.filter(c => c.status !== 'NOT_APPLICABLE');
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link to="/" className="hover:text-blue-600 flex items-center gap-1 transition-colors"><LayoutDashboard size={14} /> Dashboard</Link>
              <span>/</span>
              <span className="font-mono">{id}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Automated Compliance Assessment</h1>
            <p className="text-gray-500 mt-1">Rule Engine Evaluation against Legal Metrology Rules, 2011</p>
          </div>
          
          <div className="flex flex-col md:items-end gap-3">
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Analysis Status</div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                analysisStatus === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                analysisStatus === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-gray-50 text-gray-700 border-gray-200'
              }`}>
                {analysisStatus || 'UNKNOWN'}
              </span>
            </div>
            {analysisStatus === 'COMPLETED' && (
              <div className="flex items-center gap-2">
                <a 
                  href={`${API_URL}/products/${id}/report/pdf`} 
                  download 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm text-sm transition-colors"
                >
                  Download PDF Report
                </a>
                <a 
                  href={`${API_URL}/products/${id}/report/docx`} 
                  download 
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-700 border border-blue-300 font-medium rounded shadow-sm text-sm transition-colors"
                >
                  Download Editable Report
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Big Status Banner */}
        <div className={`p-6 border rounded-xl shadow-sm flex flex-col md:flex-row items-center gap-6 ${
          isPass ? 'bg-green-50 border-green-200' : 
          isFail ? 'bg-red-50 border-red-200' : 
          'bg-amber-50 border-amber-200'
        }`}>
          <div className="shrink-0">
            {isPass ? <CheckCircle size={72} className="text-green-500" /> : 
             isFail ? <XCircle size={72} className="text-red-500" /> : 
             <AlertCircle size={72} className="text-amber-500" />}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className={`text-3xl font-black mb-2 tracking-tight ${
              isPass ? 'text-green-800' : 
              isFail ? 'text-red-800' : 
              'text-amber-800'
            }`}>
              {isPass ? 'COMPLIANT (PASS)' : 
               isFail ? 'NON-COMPLIANT (FAIL)' : 
               'MANUAL REVIEW REQUIRED'}
            </h2>
            <p className={`text-lg font-medium ${
              isPass ? 'text-green-700' : 
              isFail ? 'text-red-700' : 
              'text-amber-700'
            }`}>
              {isPass ? 'No violations detected in the provided evidence.' : 
               isFail ? 'Deterministic rule violations detected.' : 
               'Evidence is incomplete or unverified. Physical verification is required.'}
            </p>
            {isReview && (
              <p className="text-sm mt-2 text-amber-600 font-medium bg-amber-100 p-2 rounded inline-block">
                REVIEW recommended where evidence is incomplete or physical verification is required.
              </p>
            )}
            {productData.analysisError && (
              <p className="text-sm mt-3 text-red-600 font-mono bg-red-100 p-2 rounded">
                Error during analysis: {productData.analysisError}
              </p>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Col: Extracted Fields & Category */}
          <div className="flex flex-col gap-6">
            <ExtractedFieldsPanel fields={extracted} />
            
            <div className="bg-white p-6 border rounded-xl shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                <Search size={18} className="text-blue-500"/> Detected Context
              </h3>
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Product Category</div>
                  <div className="font-semibold text-gray-800 capitalize">{category || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Legal Domain</div>
                  <div className="font-semibold text-gray-800 capitalize">{complianceDetails?.legalContext?.domain || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Package Type</div>
                  <div className="font-semibold text-gray-800 capitalize">{complianceDetails?.legalContext?.packageType || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Consumer Type</div>
                  <div className="font-semibold text-gray-800 capitalize">{complianceDetails?.legalContext?.consumerType || 'Unknown'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Evidence Viewer */}
          <div className="bg-white p-4 border rounded-xl shadow-sm h-[600px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Verified Evidence (OCR)</h3>
            <div className="flex-1 overflow-hidden rounded border bg-gray-50">
              {imageUrl ? (
                <OcrImageViewer 
                  imageUrl={imageUrl}
                  detections={detections}
                  roiCandidates={[]}
                  showFullImageDetections={showFullImage}
                  showRoiDetections={false}
                  showRoiCandidates={false}
                  selectedDetectionId={selectedDetectionId}
                  onDetectionSelect={setSelectedDetectionId}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No Image Available</div>
              )}
            </div>
          </div>
        </div>

        {/* Rules Breakdown */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 p-4 border-b">
            <h3 className="text-lg font-bold text-gray-800">Deterministic Rule Evaluation</h3>
          </div>
          <div className="p-0">
            {['rule6', 'rule789', 'rule11'].map(ruleKey => {
              const ruleData = complianceDetails?.[ruleKey];
              if (!ruleData) return null;
              
              const checks = getRuleChecks(ruleData);
              if (checks.length === 0) return null;

              return (
                <div key={ruleKey} className="border-b last:border-0 p-6">
                  <h4 className="font-bold text-lg mb-4 text-gray-700 uppercase tracking-wide flex items-center justify-between">
                    Rule {ruleData.ruleNumber} Assessment
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      ruleData.status === 'PASS' ? 'bg-green-100 text-green-700' :
                      ruleData.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                      ruleData.status === 'REVIEW' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{ruleData.status}</span>
                  </h4>
                  <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded border border-gray-100">{ruleData.reason}</p>
                  
                  <div className="space-y-3">
                    {checks.map((check, idx) => (
                      <div key={idx} className="flex gap-4 p-3 rounded-lg border bg-white shadow-sm hover:shadow transition-shadow">
                        <div className="shrink-0 mt-0.5">
                          {check.status === 'PASS' ? <CheckCircle size={20} className="text-green-500" /> :
                           check.status === 'FAIL' ? <XCircle size={20} className="text-red-500" /> :
                           check.status === 'REVIEW' ? <AlertCircle size={20} className="text-amber-500" /> :
                           <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm mb-1">{check.requirement}</div>
                          <div className="text-sm text-gray-600 mb-1">{check.reason}</div>
                          <div className="text-xs font-mono text-gray-400">Clause: {check.clause}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

export default ComplianceResultPage;
