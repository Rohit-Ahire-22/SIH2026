import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, BarChart2, X, AlertCircle, CheckCircle, ArrowLeft,
  Scale, ChevronDown, ChevronUp
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

const NUTRIENT_ORDER = [
  'Serving Size', 'Servings Per Pack', 'Energy', 'Protein',
  'Total Fat', 'Saturated Fat', 'Trans Fat',
  'Carbohydrates', 'Total Sugars', 'Added Sugars', 'Dietary Fibre', 'Sodium',
];

function NutrientRow({ nutrient }) {
  const hasValue = nutrient.value !== null && nutrient.value !== undefined;
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="py-2 pl-4 pr-2 text-sm font-medium text-gray-700 w-40">{nutrient.name}</td>
      <td className="py-2 px-2 text-sm text-right">
        {hasValue
          ? <span className="font-semibold text-gray-900">{nutrient.value} <span className="text-gray-400 text-xs font-normal">{nutrient.unit}</span></span>
          : <span className="text-gray-300 text-xs italic">Not detected</span>}
      </td>
      <td className="py-2 pr-4 text-right">
        {hasValue && nutrient.confidence > 0 && (
          <span className="text-xs text-gray-400">{Math.round(nutrient.confidence * 100)}%</span>
        )}
      </td>
    </tr>
  );
}

function CompareRow({ row }) {
  const aHas = row.productA.value !== null;
  const bHas = row.productB.value !== null;
  const noteColor = row.note === 'Lower in Product A' ? 'text-green-600' :
                    row.note === 'Lower in Product B' ? 'text-blue-600' :
                    row.note === 'Equal' ? 'text-gray-500' : 'text-gray-300';

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="py-2 px-4 text-sm font-medium text-gray-700">{row.nutrient}</td>
      <td className="py-2 px-4 text-sm text-center">
        {aHas ? <span className="font-semibold">{row.productA.value} <span className="text-xs text-gray-400">{row.productA.unit}</span></span>
               : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="py-2 px-4 text-sm text-center">
        {bHas ? <span className="font-semibold">{row.productB.value} <span className="text-xs text-gray-400">{row.productB.unit}</span></span>
               : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className={`py-2 pr-4 text-xs text-right font-medium ${noteColor}`}>{row.note}</td>
    </tr>
  );
}

export default function NutritionScannerPage() {
  const [scans, setScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(true);

  // Upload state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [latestScan, setLatestScan] = useState(null);

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [scanA, setScanA] = useState('');
  const [scanB, setScanB] = useState('');
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState(null);

  useEffect(() => { fetchScans(); }, []);

  const fetchScans = async () => {
    setLoadingScans(true);
    try {
      const res = await fetch(`${API_URL}/nutrition/scans`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setScans(json.data || []);
    } catch (_) {}
    finally { setLoadingScans(false); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setUploadError(null);
  };

  const handleScan = async () => {
    if (!file) { setUploadError('Please select an image first.'); return; }
    setUploading(true);
    setUploadError(null);
    setLatestScan(null);
    try {
      const fd = new FormData();
      fd.append('nutrition_image', file);
      if (label.trim()) fd.append('label', label.trim());

      const res = await fetch(`${API_URL}/nutrition/scan`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Scan failed');
      setLatestScan(json.data);
      setFile(null); setPreview(null); setLabel('');
      fetchScans();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCompare = async () => {
    if (!scanA || !scanB) { setCompareError('Select two scans to compare.'); return; }
    if (scanA === scanB) { setCompareError('Please select two different scans.'); return; }
    setComparing(true); setCompareError(null); setComparison(null);
    try {
      const res = await fetch(`${API_URL}/nutrition/compare?a=${scanA}&b=${scanB}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setComparison(json.data);
    } catch (err) {
      setCompareError(err.message);
    } finally {
      setComparing(false);
    }
  };

  const sortedNutrients = (nutrients) => {
    if (!nutrients) return [];
    const order = NUTRIENT_ORDER;
    return [...nutrients].sort((a, b) => {
      const ai = order.indexOf(a.name); const bi = order.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nutrition Scanner</h1>
            <p className="text-sm text-gray-500 mt-0.5">Scan nutrition labels and compare products. Not medical advice.</p>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-800">Scan Nutrition Label</h2>

            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full max-h-48 object-contain rounded-lg border bg-gray-50" />
                <button onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border text-gray-400 hover:text-red-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload size={32} className="text-gray-300" />
                <span className="text-sm text-gray-500 font-medium">Upload nutrition label photo</span>
                <span className="text-xs text-gray-400">JPEG, PNG or WebP · ≤5 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>
            )}

            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Product name / label (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                <AlertCircle size={14} /> {uploadError}
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={uploading || !file}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {uploading ? 'Scanning…' : 'Scan Label'}
            </button>
          </div>

          {/* Latest Scan Result */}
          {latestScan ? (
            <div className="bg-white border rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-500" />
                <h2 className="font-bold text-gray-800">{latestScan.label || 'Scan Result'}</h2>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                  latestScan.extractionStatus === 'EXTRACTED' ? 'bg-green-100 text-green-700' :
                  latestScan.extractionStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{latestScan.extractionStatus}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="py-2 pl-4 text-left">Nutrient</th>
                      <th className="py-2 text-right">Value</th>
                      <th className="py-2 pr-4 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedNutrients(latestScan.nutrients).map(n => <NutrientRow key={n.name} nutrient={n} />)}
                  </tbody>
                </table>
              </div>
              {latestScan.extractionStatus !== 'EXTRACTED' && (
                <p className="text-xs text-amber-600 mt-2 italic">
                  Some nutrients could not be detected. Values marked "Not detected" are absent in the extracted text — not assumed to be zero.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white border rounded-xl shadow-sm p-5 flex flex-col items-center justify-center text-gray-400 min-h-48">
              <BarChart2 size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Scan result will appear here</p>
            </div>
          )}
        </div>

        {/* Compare Section */}
        <div className="bg-white border rounded-xl shadow-sm">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className="w-full flex items-center justify-between px-5 py-4 font-bold text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2"><Scale size={18} className="text-blue-500" /> Nutrition Comparison</span>
            {compareMode ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {compareMode && (
            <div className="px-5 pb-5 border-t space-y-4 pt-4">
              <p className="text-xs text-gray-500 italic">
                Nutrition-based data comparison only. Does not constitute medical or dietary advice.
              </p>

              {loadingScans ? (
                <div className="text-sm text-gray-400">Loading scans…</div>
              ) : scans.length < 2 ? (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  You need at least 2 scans to compare. Scan more products above.
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 font-semibold mb-1 block">Product A</label>
                      <select value={scanA} onChange={e => setScanA(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select scan…</option>
                        {scans.map(s => <option key={s._id} value={s._id}>{s.label || 'Scan'} · {new Date(s.scannedAt).toLocaleDateString()}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 font-semibold mb-1 block">Product B</label>
                      <select value={scanB} onChange={e => setScanB(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select scan…</option>
                        {scans.map(s => <option key={s._id} value={s._id}>{s.label || 'Scan'} · {new Date(s.scannedAt).toLocaleDateString()}</option>)}
                      </select>
                    </div>
                  </div>

                  {compareError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2"><AlertCircle size={14} />{compareError}</div>}

                  <button onClick={handleCompare} disabled={comparing}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
                    {comparing ? 'Comparing…' : 'Compare'}
                  </button>

                  {comparison && (
                    <div className="overflow-x-auto rounded-lg border mt-3">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs text-gray-500 font-semibold uppercase">Nutrient</th>
                            <th className="py-2 px-4 text-center text-xs text-blue-600 font-semibold uppercase">{comparison.productA.label}</th>
                            <th className="py-2 px-4 text-center text-xs text-emerald-600 font-semibold uppercase">{comparison.productB.label}</th>
                            <th className="py-2 pr-4 text-right text-xs text-gray-500 font-semibold uppercase">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.comparison.map(row => <CompareRow key={row.nutrient} row={row} />)}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-400 italic p-3 border-t">{comparison.disclaimer}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Previous scans */}
        {scans.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-3">Previous Scans</h2>
            <div className="space-y-2">
              {scans.map(s => (
                <div key={s._id} className="flex items-center justify-between text-sm border rounded-lg px-4 py-2.5 hover:bg-gray-50">
                  <div>
                    <span className="font-medium text-gray-800">{s.label || 'Unlabelled Scan'}</span>
                    <span className="text-gray-400 text-xs ml-2">{new Date(s.scannedAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    s.extractionStatus === 'EXTRACTED' ? 'bg-green-100 text-green-700' :
                    s.extractionStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{s.extractionStatus}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
