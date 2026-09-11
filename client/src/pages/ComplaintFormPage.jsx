import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, FileText, UploadCloud, X } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

const REASONS = [
  'Missing mandatory declaration',
  'Incorrect MRP declaration',
  'Expired product on sale',
  'Incorrect net quantity',
  'Missing manufacturer information',
  'Missing country of origin',
  'Missing batch/lot number',
  'Missing date of manufacture/expiry',
  'Non-compliant labelling',
  'Misleading consumer information',
  'Other compliance concern',
];

function StatusBadge({ status }) {
  const map = {
    COMPLIANT: 'bg-green-100 text-green-700 border-green-200',
    NON_COMPLIANT: 'bg-red-100 text-red-700 border-red-200',
    REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
    PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${map[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

export default function ComplaintFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get('productId');

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productError, setProductError] = useState(null);

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setProductError('No product ID specified. Please navigate from an inspection result.');
      setLoadingProduct(false);
      return;
    }
    fetch(`${API_URL}/products/${productId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success) setProduct(json.data);
        else setProductError(json.message || 'Product not found');
      })
      .catch(() => setProductError('Failed to load product'))
      .finally(() => setLoadingProduct(false));
  }, [productId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachmentFile(file);
    setAttachmentPreview(URL.createObjectURL(file));
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!reason) { setError('Please select a reason.'); return; }
    if (description.trim().length < 20) { setError('Description must be at least 20 characters.'); return; }
    setError(null);
    setShowDisclaimer(true);
  };

  const handleConfirmSubmit = async () => {
    setShowDisclaimer(false);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, reason, description, additionalInfo, priority }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to submit complaint');

      const complaintId = json.data.id;

      // Upload attachment if provided
      if (attachmentFile && complaintId) {
        const fd = new FormData();
        fd.append('attachment', attachmentFile);
        await fetch(`${API_URL}/complaints/${complaintId}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
      }

      setSubmitted(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (productError) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
          <p className="text-red-700 font-medium">{productError}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-white border rounded text-sm hover:bg-gray-50">Go Back</button>
        </div>
      </DashboardLayout>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-16 p-8 bg-white border rounded-xl shadow text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={56} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complaint submitted for review</h1>
          <p className="text-gray-500 mb-6 text-sm">Your complaint has been recorded. An authorised reviewer may contact you for further information.</p>
          <div className="bg-gray-50 border rounded-lg p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Reference Number</span>
              <span className="font-mono font-bold text-blue-700">{submitted.complaintNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Status</span>
              <StatusBadge status={submitted.status} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Priority</span>
              <span className="font-semibold text-gray-800">{submitted.priority}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 italic mb-6">
            Submission does not establish a legal violation. The final determination rests with the authorized authority.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/complaints')} className="px-5 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 text-sm">
              My Complaints
            </button>
            <button onClick={() => navigate('/')} className="px-5 py-2 bg-white text-gray-700 border rounded hover:bg-gray-50 text-sm">
              Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const cs = product?.complianceStatus;
  const isProblematic = cs === 'NON_COMPLIANT' || cs === 'REVIEW';

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
              <ArrowLeft size={14} /> Back to inspection
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Report Potential Non-Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">
            This will create a complaint for internal review. Submission does not constitute an official legal filing.
          </p>
        </div>

        {/* Inspection Summary Card */}
        <div className={`p-4 rounded-xl border mb-6 ${isProblematic ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-bold text-gray-900">{product?.productName || 'Unknown Product'}</div>
              <div className="text-sm text-gray-500">{product?.brandName} · {product?.category}</div>
              {product?.manufacturerName && <div className="text-xs text-gray-400 mt-0.5">{product.manufacturerName}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={product?.complianceStatus} />
              <span className="text-xs text-gray-400">MRP: ₹{product?.mrp}</span>
            </div>
          </div>
          {product?.images?.[0]?.url && (
            <img src={product.images[product.images.length - 1].url} alt="Product" className="mt-3 h-20 rounded border object-cover" />
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitClick} className="bg-white border rounded-xl shadow-sm p-6 space-y-5">

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="reason">
              Reason for Complaint <span className="text-red-500">*</span>
            </label>
            <select
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="priority">Priority</label>
            <div className="flex gap-3">
              {['LOW', 'MEDIUM', 'HIGH'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    priority === p
                      ? p === 'HIGH' ? 'bg-red-100 border-red-400 text-red-700'
                        : p === 'MEDIUM' ? 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'bg-gray-100 border-gray-400 text-gray-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="description">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the potential compliance concern in detail (minimum 20 characters)…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="text-right text-xs text-gray-400 mt-0.5">{description.length}/5000</div>
          </div>

          {/* Additional info */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="additionalInfo">
              Additional Information <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="additionalInfo"
              value={additionalInfo}
              onChange={e => setAdditionalInfo(e.target.value)}
              rows={2}
              placeholder="Any supplementary information…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Supporting Evidence <span className="text-gray-400 font-normal">(optional image, ≤5 MB)</span>
            </label>
            {attachmentPreview ? (
              <div className="relative inline-block">
                <img src={attachmentPreview} alt="Preview" className="h-24 rounded border object-cover" />
                <button
                  type="button"
                  onClick={() => { setAttachmentFile(null); setAttachmentPreview(null); }}
                  className="absolute -top-2 -right-2 bg-white border rounded-full p-0.5 text-gray-500 hover:text-red-600 shadow"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <UploadCloud size={24} className="text-gray-400" />
                <span className="text-sm text-gray-500">Click to upload JPEG, PNG or WebP</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Complaint'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 bg-white text-gray-700 border rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>

        {/* Disclaimer modal */}
        {showDisclaimer && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg"><AlertCircle className="text-amber-600" size={24} /></div>
                <h2 className="text-lg font-bold text-gray-900">Before you submit</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your complaint will be submitted for review by an authorised reviewer.
              </p>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-5 list-disc list-inside">
                <li>Submission does not itself establish a legal violation</li>
                <li>The final determination rests with the authorised authority</li>
                <li>Complaint reference: <span className="font-semibold">CMP-2026-XXXXXX</span> will be generated on submission</li>
              </ul>
              <div className="flex gap-3">
                <button onClick={handleConfirmSubmit} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm">
                  Yes, Submit Complaint
                </button>
                <button onClick={() => setShowDisclaimer(false)} className="flex-1 py-2 bg-white border rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
