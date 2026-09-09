import { AlertTriangle, CheckCircle, ShieldAlert, Clock } from 'lucide-react';

function ComplianceSummary({ categoryData = {} }) {
  const { status, confidence, category, matchedKeywords } = categoryData;
  
  if (!status) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-5 h-full flex flex-col justify-center items-center text-gray-500">
        <ShieldAlert size={32} className="mb-2 text-gray-300" />
        <p>No compliance data available</p>
      </div>
    );
  }

  const getStatusDisplay = () => {
    switch(status) {
      case 'COMPLIANT':
      case 'PASS':
        return { color: 'text-green-700 bg-green-50 border-green-200', icon: CheckCircle, label: 'COMPLIANT' };
      case 'NON_COMPLIANT':
      case 'FAIL':
        return { color: 'text-red-700 bg-red-50 border-red-200', icon: AlertTriangle, label: 'NON-COMPLIANT' };
      case 'REVIEW':
        return { color: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle, label: 'REQUIRES REVIEW' };
      default:
        return { color: 'text-gray-700 bg-gray-50 border-gray-200', icon: Clock, label: status || 'PENDING' };
    }
  };

  const display = getStatusDisplay();
  const Icon = display.icon;

  return (
    <div className="bg-white border rounded-lg shadow-sm p-5 h-full flex flex-col">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Compliance Status</h3>
      
      <div className={`p-4 rounded-lg border flex items-center gap-3 mb-4 ${display.color}`}>
        <Icon size={24} />
        <span className="text-lg font-bold tracking-wide">{display.label}</span>
      </div>

      <div className="space-y-3 flex-1">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase">Product Category</div>
          <div className="text-sm font-medium text-gray-900">{category || 'Unknown'}</div>
        </div>

        {confidence !== undefined && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">AI Evidence Score</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${confidence > 0.8 ? 'bg-green-500' : confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${(confidence * 100).toFixed(0)}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-gray-700">{(confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {matchedKeywords && matchedKeywords.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Evidence Signals</div>
            <div className="flex flex-wrap gap-1">
              {matchedKeywords.map((kw, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t text-[11px] text-gray-400 leading-tight">
        * Status is determined by the deterministic legal engine based on extracted evidence. The frontend does not calculate legal compliance.
      </div>
    </div>
  );
}

export default ComplianceSummary;
