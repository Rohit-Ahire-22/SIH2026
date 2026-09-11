import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, CheckCircle, XCircle, Clock, FileText,
  Image as ImageIcon, ChevronRight, ShieldAlert
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

const STATUS_CONFIG = {
  SUBMITTED:     { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700',   Icon: Clock },
  UNDER_REVIEW:  { label: 'Under Review', cls: 'bg-amber-100 text-amber-700', Icon: AlertCircle },
  RESOLVED:      { label: 'Resolved',     cls: 'bg-green-100 text-green-700', Icon: CheckCircle },
  REJECTED:      { label: 'Rejected',     cls: 'bg-red-100 text-red-700',     Icon: XCircle },
};

const COMPLIANCE_COLOR = {
  COMPLIANT:     'text-green-700 bg-green-50 border-green-200',
  NON_COMPLIANT: 'text-red-700 bg-red-50 border-red-200',
  REVIEW:        'text-amber-700 bg-amber-50 border-amber-200',
  PENDING:       'text-gray-600 bg-gray-50 border-gray-200',
};

function StatusBadge({ status, large = false }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-600', Icon: Clock };
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${cfg.cls} ${large ? 'text-sm' : 'text-xs'}`}>
      <Icon size={large ? 14 : 11} /> {cfg.label}
    </span>
  );
}

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/complaints/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success) setComplaint(json.data);
        else setError(json.message || 'Not found');
      })
      .catch(() => setError('Failed to load complaint'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto mt-16 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
        <p className="text-red-700 font-medium">{error}</p>
        <Link to="/complaints" className="mt-4 inline-block px-4 py-2 bg-white border rounded text-sm hover:bg-gray-50">
          Back to My Complaints
        </Link>
      </div>
    </DashboardLayout>
  );

  const snap = complaint.inspectionSnapshot || {};
  const statusCfg = STATUS_CONFIG[complaint.status];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto pb-12 space-y-5">
        {/* Back + header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <Link to="/complaints" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
              <ArrowLeft size={14} /> My Complaints
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{complaint.complaintNumber}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Submitted {new Date(complaint.submittedAt).toLocaleString('en-IN')}
              </p>
            </div>
            <StatusBadge status={complaint.status} large />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <span>Complaint submitted for review. Submission does not establish a legal violation. The final determination rests with the authorised authority.</span>
        </div>

        {/* Complaint details */}
        <div className="bg-white border rounded-xl shadow-sm divide-y">
          <div className="p-5">
            <h2 className="font-bold text-gray-800 mb-3">Complaint Details</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-500">Reason</span>
              <span className="font-medium text-gray-800">{complaint.reason}</span>
              <span className="text-gray-500">Priority</span>
              <span className={`font-bold text-xs ${complaint.priority === 'HIGH' ? 'text-red-600' : complaint.priority === 'MEDIUM' ? 'text-amber-600' : 'text-gray-600'}`}>
                {complaint.priority}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-500 mb-1">Description</div>
              <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border">{complaint.description}</p>
            </div>
            {complaint.additionalInfo && (
              <div className="mt-3">
                <div className="text-sm text-gray-500 mb-1">Additional Information</div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border">{complaint.additionalInfo}</p>
              </div>
            )}
          </div>

          {/* Inspection Snapshot */}
          <div className="p-5">
            <h2 className="font-bold text-gray-800 mb-3">Inspection at Time of Complaint</h2>
            <div className="flex items-start gap-4">
              {snap.imageUrl && (
                <img src={snap.imageUrl} alt="Product" className="h-20 w-20 rounded-lg border object-cover shrink-0" />
              )}
              <div className="flex-1 grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-500">Product</span>
                <span className="font-medium text-gray-800">{snap.productName || 'N/A'}</span>
                <span className="text-gray-500">Category</span>
                <span className="capitalize text-gray-800">{snap.category || 'N/A'}</span>
                <span className="text-gray-500">MRP</span>
                <span className="text-gray-800">{snap.mrp ? `₹${snap.mrp}` : 'N/A'}</span>
                <span className="text-gray-500">Compliance</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${COMPLIANCE_COLOR[snap.complianceStatus] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                  {snap.complianceStatus || 'N/A'}
                </span>
                {snap.batchLotNumber && (<><span className="text-gray-500">Batch</span><span className="font-mono text-gray-800 text-xs">{snap.batchLotNumber}</span></>)}
              </div>
            </div>
            <div className="mt-3 text-right">
              <Link
                to={`/inspections/${complaint.productId}/result`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                View Full Inspection <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {/* Attachments */}
          {complaint.attachments?.length > 0 && (
            <div className="p-5">
              <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ImageIcon size={16} /> Attachments ({complaint.attachments.length})
              </h2>
              <div className="flex flex-wrap gap-3">
                {complaint.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                    <img src={a.url} alt={a.originalName} className="h-20 w-20 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Authority remarks */}
          {complaint.authorityRemarks && (
            <div className="p-5">
              <h2 className="font-bold text-gray-800 mb-2">Reviewer Remarks</h2>
              <p className="text-sm text-gray-700 bg-blue-50 border border-blue-200 p-3 rounded-lg">{complaint.authorityRemarks}</p>
            </div>
          )}

          {/* Status timeline */}
          {complaint.statusHistory?.length > 0 && (
            <div className="p-5">
              <h2 className="font-bold text-gray-800 mb-3">Status Timeline</h2>
              <div className="space-y-3">
                {complaint.statusHistory.map((h, i) => {
                  const cfg = STATUS_CONFIG[h.status] || { label: h.status, cls: 'bg-gray-50 text-gray-600', Icon: Clock };
                  const { Icon } = cfg;
                  return (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className={`p-1.5 rounded-full ${cfg.cls} shrink-0`}>
                        <Icon size={12} />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">{cfg.label}</span>
                        <span className="text-gray-400 ml-2 text-xs">{new Date(h.changedAt).toLocaleString('en-IN')}</span>
                        {h.note && <p className="text-gray-500 text-xs mt-0.5">{h.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
