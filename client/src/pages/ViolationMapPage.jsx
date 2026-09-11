import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Filter, BarChart2, AlertCircle, CheckCircle, XCircle, Clock, MapPinned } from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

// Dynamic import of Leaflet components to avoid SSR issues
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR = {
  COMPLIANT:     '#16a34a',
  NON_COMPLIANT: '#dc2626',
  REVIEW:        '#d97706',
  PENDING:       '#6b7280',
};

const STATUS_LABEL = {
  COMPLIANT:     'Compliant',
  NON_COMPLIANT: 'Potential Non-Compliant',
  REVIEW:        'Requires Review',
  PENDING:       'Pending',
};

const CATEGORIES = ['food', 'beverage', 'cosmetic', 'personal_care', 'household', 'electronics', 'pharmaceutical', 'agricultural', 'other'];

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function ViolationMapPage() {
  const [markers, setMarkers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [highAttention, setHighAttention] = useState(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { fetchMarkers(); }, [statusFilter, categoryFilter, manufacturerFilter, fromDate, toDate]);
  useEffect(() => { fetchHighAttention(); }, [statusFilter, categoryFilter, manufacturerFilter, fromDate, toDate]);

  const fetchMarkers = async () => {
    setLoadingMap(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set('status', statusFilter);
      if (categoryFilter) q.set('category', categoryFilter);
      if (manufacturerFilter.trim()) q.set('manufacturer', manufacturerFilter.trim());
      if (fromDate) q.set('from', fromDate);
      if (toDate) q.set('to', toDate);

      const res = await fetch(`${API_URL}/violations/map?${q}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setMarkers(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMap(false);
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_URL}/violations/summary`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setSummary(json.data);
    } catch (_) {}
    finally { setLoadingSummary(false); }
  };

  const fetchHighAttention = async () => {
    setLoadingAreas(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set('status', statusFilter);
      if (categoryFilter) q.set('category', categoryFilter);
      if (manufacturerFilter.trim()) q.set('manufacturer', manufacturerFilter.trim());
      if (fromDate) q.set('from', fromDate);
      if (toDate) q.set('to', toDate);

      const res = await fetch(`${API_URL}/violations/high-attention?${q}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setHighAttention(json.data);
    } catch (_) {}
    finally { setLoadingAreas(false); }
  };

  const clearFilters = () => {
    setStatusFilter(''); setCategoryFilter(''); setManufacturerFilter('');
    setFromDate(''); setToDate('');
  };

  // Default center — India
  const defaultCenter = [20.5937, 78.9629];
  const mapCenter = markers.length > 0
    ? [markers[0].latitude, markers[0].longitude]
    : defaultCenter;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="text-blue-600" size={24} /> Inspection Intelligence Map
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Inspection attention areas — not indicative of confirmed legal violations
            </p>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard icon={BarChart2} label="Total Inspections" value={summary.summary.total} color="bg-blue-50 text-blue-600" />
            <SummaryCard icon={CheckCircle} label="Compliant" value={summary.summary.compliant} color="bg-green-50 text-green-600" />
            <SummaryCard icon={XCircle} label="Non-Compliant" value={summary.summary.nonCompliant} color="bg-red-50 text-red-600" />
            <SummaryCard icon={AlertCircle} label="Review Required" value={summary.summary.review} color="bg-amber-50 text-amber-600" />
            <SummaryCard icon={Clock} label="Pending" value={summary.summary.pending} color="bg-gray-50 text-gray-600" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white border rounded-xl p-4 shadow-sm">
          <Filter size={16} className="text-gray-400 self-center" />

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="NON_COMPLIANT">Non-Compliant</option>
            <option value="REVIEW">Review</option>
            <option value="PENDING">Pending</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>)}
          </select>

          <input
            type="text"
            value={manufacturerFilter}
            onChange={e => setManufacturerFilter(e.target.value)}
            placeholder="Manufacturer / brand…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />

          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="text-gray-500">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button
            onClick={clearFilters}
            className="ml-auto text-xs text-gray-500 hover:text-red-600 underline"
          >Clear filters</button>
        </div>

        {/* Map */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {loadingMap ? 'Loading…' : `${markers.length} inspection${markers.length !== 1 ? 's' : ''} with location data`}
            </span>
            <div className="flex items-center gap-4 text-xs">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: STATUS_COLOR[k] }} />
                  {v}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 text-center text-red-600 text-sm">{error}</div>
          )}

          {markers.length === 0 && !loadingMap ? (
            <div className="flex flex-col items-center justify-center h-80 text-gray-400">
              <MapPin size={40} className="mb-3 opacity-40" />
              <p className="font-semibold">No location data yet</p>
              <p className="text-sm mt-1">Capture location on inspection result pages to see inspections here.</p>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={markers.length > 0 ? 10 : 5}
              style={{ height: '500px', width: '100%' }}
              key={`${mapCenter[0]}-${mapCenter[1]}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markers.map((m) => (
                <CircleMarker
                  key={m.productId}
                  center={[m.latitude, m.longitude]}
                  radius={10}
                  pathOptions={{
                    fillColor: STATUS_COLOR[m.complianceStatus] || '#6b7280',
                    color: '#fff',
                    weight: 2,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-1 min-w-[180px]">
                      <div className="font-bold text-gray-900">{m.productName}</div>
                      <div className="text-gray-500 capitalize">{m.category?.replace('_', ' ')}</div>
                      {m.manufacturer && <div className="text-gray-500">Manufacturer: {m.manufacturer}</div>}
                      {m.brandName && !m.manufacturer && <div className="text-gray-500">{m.brandName}</div>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: STATUS_COLOR[m.complianceStatus] }}
                        />
                        <span className="font-semibold" style={{ color: STATUS_COLOR[m.complianceStatus] }}>
                          {STATUS_LABEL[m.complianceStatus] || m.complianceStatus}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(m.inspectionDate).toLocaleDateString('en-IN')}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)}
                      </div>
                      <p className="text-[11px] text-gray-400 italic">
                        Based on stored inspection data — not a confirmed legal violation.
                      </p>
                      <Link
                        to={`/inspections/${m.productId}/result`}
                        className="block mt-2 text-xs text-blue-600 hover:underline font-medium"
                      >
                        View Inspection →
                      </Link>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Category breakdown */}
        {summary?.categoryBreakdown?.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4">Category Breakdown</h2>
            <div className="space-y-2">
              {summary.categoryBreakdown.slice(0, 8).map(cat => (
                <div key={cat._id} className="flex items-center gap-3 text-sm">
                  <div className="w-28 text-gray-600 capitalize shrink-0">{(cat._id || 'unknown').replace('_', ' ')}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(100, (cat.total / summary.summary.total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 shrink-0 w-20 text-right">
                    {cat.total} total · <span className="text-red-600">{cat.nonCompliant} NC</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High-attention areas */}
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
            <MapPinned size={18} className="text-amber-500" /> High-Attention Areas
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Areas where several inspections cluster and at least one is NON-COMPLIANT or REVIEW.
            Not confirmed legal violation zones.
          </p>

          {loadingAreas ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !highAttention || !highAttention.hasHighAttentionData ? (
            <div className="flex flex-col items-center py-6 text-gray-400 text-center">
              <MapPin size={28} className="opacity-40 mb-2" />
              <p className="text-sm font-medium text-gray-600">No high-attention areas yet</p>
              <p className="text-xs mt-1 max-w-xl">
                With more location-tagged inspections we can identify areas that warrant closer attention.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {highAttention.areas.map((area, i) => (
                <div key={i} className="border rounded-xl p-4 border-amber-200 bg-amber-50/50">
                  <div className="text-xs text-gray-500 font-mono">
                    {area.center.latitude.toFixed(3)}, {area.center.longitude.toFixed(3)}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-black text-amber-700">{area.attentionScore}</span>
                    <span className="text-xs text-gray-600">attention point{area.attentionScore !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">{area.count} inspections</span>
                    {area.nonCompliant > 0 && <span className="bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">{area.nonCompliant} NC</span>}
                    {area.review > 0 && <span className="bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{area.review} Review</span>}
                    {area.compliant > 0 && <span className="bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5">{area.compliant} Compliant</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
