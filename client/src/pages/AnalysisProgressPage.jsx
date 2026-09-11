import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

const STAGES = [
  { id: 'start', label: 'Initializing Orchestration Engine' },
  { id: 'ocr', label: 'Executing Hybrid AI OCR Pipeline' },
  { id: 'extract', label: 'Extracting Structural Declarations' },
  { id: 'legal', label: 'Evaluating Deterministic Legal Metrology Engine' },
  { id: 'complete', label: 'Generating Compliance Result' }
];

function AnalysisProgressPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState(null);
  
  // Use a ref to prevent double-firing in React StrictMode
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    
    runAnalysis();
    
    // Simulate frontend stage progress while waiting for the long-polling backend call
    const interval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < STAGES.length - 2) return prev + 1;
        return prev;
      });
    }, 1500);
    
    return () => clearInterval(interval);
  }, [id]);

  const runAnalysis = async () => {
    try {
      const res = await fetch(`${API_URL}/products/${id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.message || 'Analysis Failed');
      }

      setCurrentStage(STAGES.length - 1); // Complete
      
      // Give the user a moment to see it hit 100%
      setTimeout(() => {
        navigate(`/inspections/${id}/result`);
      }, 800);

    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4">
        <div className="self-start mb-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
        </div>
        
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center w-full shadow-sm">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-700 mb-2">Analysis Error</h2>
            <p className="text-red-600 mb-8">{error}</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => navigate('/')} 
                className="px-6 py-2 bg-white text-gray-700 border rounded font-medium hover:bg-gray-50 transition-colors"
              >
                Return to Dashboard
              </button>
              <button 
                onClick={() => { setError(null); setCurrentStage(0); hasStartedRef.current = false; runAnalysis(); }}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Retry Analysis
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl p-8 w-full shadow-sm">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="relative mb-6">
                <Loader2 size={64} className="text-blue-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Product</h2>
              <p className="text-gray-500">Please wait while our dual ML/Legal engine verifies compliance.</p>
            </div>

            <div className="space-y-6 max-w-md mx-auto">
              {STAGES.map((stage, index) => {
                const isComplete = index < currentStage;
                const isCurrent = index === currentStage;
                const isPending = index > currentStage;

                return (
                  <div key={stage.id} className="flex items-center gap-4">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      isComplete ? 'bg-green-100 text-green-600' : 
                      isCurrent ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-2' : 
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {isComplete ? <CheckCircle2 size={18} /> : 
                       isCurrent ? <Loader2 size={16} className="animate-spin" /> : 
                       <span className="w-2 h-2 rounded-full bg-gray-300"></span>}
                    </div>
                    <span className={`font-medium transition-colors duration-300 ${
                      isComplete ? 'text-gray-800' :
                      isCurrent ? 'text-blue-700 font-bold' :
                      'text-gray-400'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AnalysisProgressPage;
