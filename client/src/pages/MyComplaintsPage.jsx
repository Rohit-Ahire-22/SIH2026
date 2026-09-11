import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, ChevronRight, AlertCircle, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

const STATUS_CONFIG = {
  SUBMITTED:     { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700 border-blue-200',   Icon: Clock },
  UNDER_REVIEW:  { label: 'Under Review', cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: AlertCircle },
  RESOLVED:      { label: 'Resolved',     cls: 'bg-green-100 text-green-700 border-green-200', Icon: CheckCircle },
  REJECTED:      { label: 'Rejected',     cls: 'bg-red-100 text-red-700 border-red-200',       Icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Clock };
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH:   'bg-red-50 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    LOW:    'bg-gray-50 text-gray-600 border-gray-200',
  };
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold border ${map[priority] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{priority}</span>;
}

export default function MyComplaintsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => { fetchComplaints(); }, [searchParams]);

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('page', page);
      q.set('limit', '15');
      if (statusFilter) q.set('status', statusFilter);

      const res = await fetch(`${API_URL}/complaints?${q}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load complaints');
      setComplaints(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key, value) => {
    const np = new URLSearchParams(searchParams);
    if (value) np.set(key, value); else np.delete(key);
    np.set('page', '1');
    setSearchParams(np);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Complaints</h1>
            <p className="text-sm text-gray-500 mt-0.5">Potential non-compliance reports submitted for review</p>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-5">
          <Filter size={14} className="text-gray-400" />
          {['', 'SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter('status', s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
            <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-1">No complaints yet</p>
            <p className="text-sm">You can report potential non-compliance from any completed inspection result.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {complaints.map(c => (
                <Link
                  key={c._id}
                  to={`/complaints/${c._id}`}
                  className="flex items-center justify-between bg-white border rounded-xl px-5 py-4 shadow-sm hover:shadow hover:border-blue-300 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-600">{c.complaintNumber}</span>
                      <StatusBadge status={c.status} />
                      <PriorityBadge priority={c.priority} />
                    </div>
                    <div className="font-semibold text-gray-900 text-sm truncate">
                      {c.inspectionSnapshot?.productName || 'Unknown Product'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c.reason} · {new Date(c.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 shrink-0 ml-3 transition-colors" />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  disabled={!pagination.hasPrevious}
                  onClick={() => setFilter('page', page - 1)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >← Previous</button>
                <span className="px-3 py-1.5 text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setFilter('page', page + 1)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
