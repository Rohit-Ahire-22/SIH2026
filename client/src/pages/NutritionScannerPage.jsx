import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, Sparkles, X, AlertCircle, CheckCircle, ArrowRight,
  ExternalLink, ShoppingBag, RefreshCw, Tag
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { API_URL } from '../config';

const NUTRIENT_ORDER = [
  'Serving Size', 'Servings Per Pack', 'Energy', 'Protein',
  'Total Fat', 'Saturated Fat', 'Trans Fat',
  'Carbohydrates', 'Total Sugars', 'Added Sugars', 'Dietary Fibre', 'Sodium',
];

const REC_KEYS = [
  { key: 'energy', label: 'Energy', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'totalFat', label: 'Total fat', unit: 'g' },
  { key: 'saturatedFat', label: 'Sat. fat', unit: 'g' },
  { key: 'sugars', label: 'Sugars', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
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

function RecommendationCard({ rec, scanned }) {
  const shown = REC_KEYS.filter(r => rec.values && rec.values[r.key] !== undefined && rec.values[r.key] !== null);
  return (
    <div className="border rounded-xl overflow-hidden shadow-sm bg-white flex flex-col">
      <div className="flex items-start gap-3 p-4 border-b bg-gray-50">
        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
          rec.rank === 1 ? 'bg-emerald-600' : rec.rank === 2 ? 'bg-blue-600' : 'bg-indigo-600'
        }`}>#{rec.rank}</div>
        {rec.imageUrl ? (
          <img src={rec.imageUrl} alt={rec.name} className="w-16 h-16 object-contain rounded bg-white border shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded bg-gray-100 border flex items-center justify-center text-gray-300 shrink-0">
            <ShoppingBag size={22} />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-bold text-gray-900 leading-tight">{rec.name}</div>
          {rec.brand && <div className="text-xs text-gray-500 mt-0.5">{rec.brand}</div>}
          {rec.quantity && <div className="text-xs text-gray-400 mt-0.5">{rec.quantity}</div>}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {shown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shown.map(r => (
              <span key={r.key} className="text-xs bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                {r.label}: <span className="font-semibold">{rec.values[r.key]}</span> <span className="text-gray-400">{r.unit}</span>
              </span>
            ))}
          </div>
        )}

        {rec.reasons && rec.reasons.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-1">Why it's a better choice</div>
            <ul className="space-y-1">
              {rec.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.advantages && rec.advantages.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-1">Why we recommended it</div>
            <ul className="space-y-1">
              {rec.advantages.map((a, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <ArrowRight size={13} className="text-blue-500 shrink-0 mt-0.5" /> {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.limitations && rec.limitations.length > 0 && (
          <div className="mt-auto pt-2 border-t border-gray-100">
            <div className="text-[11px] text-gray-400 italic">
              {rec.limitations.slice(0, 2).join(' ')}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          {rec.source && (
            <span className="text-[11px] text-gray-400">
              Source: {rec.source}
              {typeof rec.dataCompleteness === 'number' && (
                <> · {Math.round(rec.dataCompleteness * 100)}% of comparison factors covered</>
              )}
            </span>
          )}
          {rec.productUrl && (
            <a
              href={rec.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View product <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
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

  // Recommendation state
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => { fetchScans(); }, []);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('scan');
    if (sid) loadScanFromId(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScanFromId = async (sid) => {
    try {
      const res = await fetch(`${API_URL}/nutrition/scans/${sid}`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) return;
      setLatestScan(json.data);
      const recRes = await fetch(`${API_URL}/nutrition/scans/${sid}/recommendations`, { credentials: 'include' });
      const recJson = await recRes.json();
      if (recJson.success && recJson.data) setRecommendation(recJson.data);
    } catch (_) {}
  };

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
    setRecommendation(null);
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

  const handleRecommend = async () => {
    if (!latestScan) return;
    setRecommending(true);
    setRecommendError(null);
    setRecommendation(null);
    try {
      const res = await fetch(`${API_URL}/nutrition/scans/${latestScan._id}/recommend`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Recommendations failed');
      setRecommendation(json.data);
    } catch (err) {
      setRecommendError(err.message);
    } finally {
      setRecommending(false);
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
            <p className="text-sm text-gray-500 mt-0.5">Scan nutrition labels and discover better product options. Not medical advice.</p>
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
            <div className="bg-white border rounded-xl shadow-sm p-5 flex flex-col">
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

              <button
                onClick={handleRecommend}
                disabled={recommending}
                className="mt-4 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                {recommending ? <><RefreshCw size={16} className="animate-spin" /> Finding better options…</> : <><Sparkles size={16} /> Find Better Options</>}
              </button>

              {recommendError && (
                <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                  <AlertCircle size={14} /> {recommendError}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border rounded-xl shadow-sm p-5 flex flex-col items-center justify-center text-gray-400 min-h-48">
              <Sparkles size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Scan result will appear here</p>
              <p className="text-xs mt-1">After scanning, we'll suggest better alternatives from Open Food Facts.</p>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recommendation && (
          <section className="space-y-4">
            {recommendation.lowCategoryConfidence && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  We couldn't confidently identify the product category, so recommendations are limited.
                  Adding the product name when you scan improves category matching.
                </span>
              </div>
            )}

            {recommendation.status === 'recommendations' && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">Better options we found</h2>
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Tag size={11} /> {recommendation.category?.label || recommendation.category?.key || 'General'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendation.recommendations.map(rec => (
                    <RecommendationCard key={rec.rank} rec={rec} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 italic">{recommendation.disclaimer}</p>
              </>
            )}

            {recommendation.status === 'scanned_competitive' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-green-800">Your scanned product is competitive</h2>
                <p className="text-sm text-green-700 mt-1">
                  We compared it with similar products and did not find any with a clearly better
                  {recommendation.category?.label ? ` nutritional profile in "${recommendation.category.label}".` : ' nutritional profile.'}
                </p>
                <p className="text-xs text-green-600 italic mt-2">{recommendation.disclaimer}</p>
              </div>
            )}

            {recommendation.status === 'no_comparable_products' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <AlertCircle size={36} className="text-amber-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-amber-800">No comparable products found</h2>
                <p className="text-sm text-amber-700 mt-1 max-w-2xl mx-auto">
                  We could not find enough comparable products in this category with sufficient nutrition data.
                  This can happen when the category couldn't be detected with confidence or the external product
                  database is temporarily unavailable. Nothing is invented — please try again later.
                </p>
                <button
                  onClick={handleRecommend}
                  disabled={recommending}
                  className="mx-auto mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <RefreshCw size={14} className={recommending ? 'animate-spin' : ''} /> Try Again
                </button>
                <p className="text-xs text-amber-600 italic mt-3">{recommendation.disclaimer}</p>
              </div>
            )}

            {recommendation.status && !['recommendations', 'scanned_competitive', 'no_comparable_products'].includes(recommendation.status) && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-600">Recommendations are not available for this scan.</p>
              </div>
            )}
          </section>
        )}

        {/* Previous scans */}
        {scans.length > 0 && (
          <div className="bg-white border rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-3">Previous Scans</h2>
            <div className="space-y-2">
              {scans.map(s => (
                <div key={s._id} className="flex items-center justify-between text-sm border rounded-lg px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{s.label || 'Unlabelled Scan'}</span>
                    <span className="text-gray-400 text-xs">{new Date(s.scannedAt).toLocaleDateString('en-IN')}</span>
                    {s.recommendationStatus === 'recommendations' && (
                      <Link
                        to={`/nutrition?scan=${s._id}`}
                        className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                      >
                        <Sparkles size={12} /> {s.recommendations?.length || 0} recommendations <ArrowRight size={11} />
                      </Link>
                    )}
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