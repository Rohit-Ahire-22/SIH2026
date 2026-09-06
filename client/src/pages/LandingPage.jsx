import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { PlusCircle, Search, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, List, Activity, FileText, Calendar } from 'lucide-react';
import { API_URL } from '../config';

function LandingPage() {
  const [days, setDays] = useState('30');
  const [analytics, setAnalytics] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [days]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/products/analytics?days=${days}`, { credentials: 'include' }),
        fetch(`${API_URL}/products?limit=5`, { credentials: 'include' })
      ]);
      
      const analyticsJson = await analyticsRes.json();
      const productsJson = await productsRes.json();
      
      if (!analyticsRes.ok) throw new Error(analyticsJson.message || 'Failed to load analytics');
      if (!productsRes.ok) throw new Error(productsJson.message || 'Failed to load recent inspections');
      
      setAnalytics(analyticsJson.data);
      setRecentProducts(productsJson.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PASS': return <CheckCircle className="text-green-500" size={18} />;
      case 'FAIL': return <XCircle className="text-red-500" size={18} />;
      case 'REVIEW': return <AlertCircle className="text-amber-500" size={18} />;
      default: return <Clock className="text-gray-400" size={18} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASS': return 'bg-green-100 text-green-800 border-green-200';
      case 'FAIL': return 'bg-red-100 text-red-800 border-red-200';
      case 'REVIEW': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const stats = analytics?.summary || { total: 0, pass: 0, fail: 0, review: 0 };
  const dist = analytics?.complianceDistribution || { PASS: 0, FAIL: 0, REVIEW: 0 };
  const categories = analytics?.categoryBreakdown || [];
  
  const completedAssessments = stats.pass + stats.fail + stats.review;
  const passRate = completedAssessments > 0 ? Math.round((stats.pass / completedAssessments) * 100) : 0;
  
  // Calculate max for trend chart scaling
  const trendMax = analytics?.trend?.length > 0 ? Math.max(...analytics.trend.map(t => t.total)) : 1;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Inspection Dashboard</h1>
            <p className="text-gray-500 mt-1">Automated assessment overview.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select 
                value={days} 
                onChange={e => setDays(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <Calendar size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            
            <Link 
              to="/history" 
              className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors text-sm"
            >
              <List size={16} /> History
            </Link>
            <Link 
              to="/inspections/new" 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors text-sm"
            >
              <PlusCircle size={16} /> New Inspection
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p>{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Total Inspections</h3>
              <Activity size={18} className="text-blue-500" />
            </div>
            <div className="text-3xl font-black text-gray-900">{loading ? '-' : stats.total}</div>
          </div>
          
          <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-green-500 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Pass</h3>
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <div className="text-3xl font-black text-green-700">{loading ? '-' : stats.pass}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-red-500 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Fail</h3>
              <XCircle size={18} className="text-red-500" />
            </div>
            <div className="text-3xl font-black text-red-700">{loading ? '-' : stats.fail}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-amber-500 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider">Review</h3>
              <AlertCircle size={18} className="text-amber-500" />
            </div>
            <div className="text-3xl font-black text-amber-700">{loading ? '-' : stats.review}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-xl shadow flex flex-col justify-between text-white">
            <div className="text-blue-100 font-medium text-sm uppercase tracking-wider mb-2">Assessment Pass Rate</div>
            <div className="flex items-baseline gap-1">
              <div className="text-4xl font-black">{loading ? '-' : passRate}%</div>
            </div>
            <div className="text-xs text-blue-200 mt-1">{completedAssessments === 0 ? 'No completed inspections' : 'of completed assessments'}</div>
          </div>
        </div>

        {/* Analytics Main Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Left Col: Dist & Trends */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Compliance Distribution */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="font-bold text-gray-800 mb-6">Compliance Distribution</h2>
              
              {completedAssessments === 0 ? (
                <div className="text-center text-gray-400 py-6">No completed inspections yet.</div>
              ) : (
                <div>
                  <div className="h-6 w-full flex rounded-full overflow-hidden mb-4">
                    <div style={{ width: `${(dist.PASS / completedAssessments) * 100}%` }} className="bg-green-500 transition-all"></div>
                    <div style={{ width: `${(dist.FAIL / completedAssessments) * 100}%` }} className="bg-red-500 transition-all"></div>
                    <div style={{ width: `${(dist.REVIEW / completedAssessments) * 100}%` }} className="bg-amber-500 transition-all"></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> <span className="font-medium">PASS</span> <span className="text-gray-500">({dist.PASS || 0})</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> <span className="font-medium">FAIL</span> <span className="text-gray-500">({dist.FAIL || 0})</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> <span className="font-medium">REVIEW</span> <span className="text-gray-500">({dist.REVIEW || 0})</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Trend Chart (CSS Bar Chart) */}
            <div className="bg-white p-6 rounded-xl border shadow-sm flex-1">
              <h2 className="font-bold text-gray-800 mb-6">Inspection Trend (By Day)</h2>
              
              {!analytics?.trend || analytics.trend.length === 0 ? (
                <div className="text-center text-gray-400 py-10">No trend data available for this period.</div>
              ) : (
                <div className="h-48 flex items-end gap-1.5 md:gap-3 w-full border-b pb-2 relative">
                  {analytics.trend.map(day => (
                    <div key={day._id} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                        {day._id}: {day.total} (P:{day.pass} F:{day.fail} R:{day.review})
                      </div>
                      
                      {/* Bar Stack */}
                      <div className="w-full flex flex-col justify-end h-40 bg-gray-50 rounded-t overflow-hidden relative border-b-0">
                        {day.review > 0 && <div className="w-full bg-amber-400" style={{ height: `${(day.review / trendMax) * 100}%` }}></div>}
                        {day.fail > 0 && <div className="w-full bg-red-500" style={{ height: `${(day.fail / trendMax) * 100}%` }}></div>}
                        {day.pass > 0 && <div className="w-full bg-green-500" style={{ height: `${(day.pass / trendMax) * 100}%` }}></div>}
                      </div>
                      {/* X-axis label (only show a few on mobile, all on desktop if fits) */}
                      <div className="text-[10px] text-gray-400 mt-2 truncate w-full text-center overflow-hidden h-4">
                        {day._id.split('-').slice(1).join('/')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Col: Category Breakdown */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">Category Breakdown</h2>
            </div>
            <div className="flex-1 overflow-auto max-h-[400px]">
              {categories.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No categories found.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {categories.map(cat => (
                    <li key={cat._id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-800 capitalize">{cat._id || 'Unknown'}</span>
                        <span className="text-sm font-medium bg-gray-100 px-2 py-0.5 rounded">{cat.total}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        {cat.pass > 0 && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">{cat.pass} Pass</span>}
                        {cat.fail > 0 && <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{cat.fail} Fail</span>}
                        {cat.review > 0 && <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{cat.review} Review</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Recent Inspections Table */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Recent Inspections</h2>
            <button onClick={fetchDashboardData} disabled={loading} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>

          {loading && recentProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
              <p>Loading inspections...</p>
            </div>
          ) : recentProducts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="mx-auto mb-3 opacity-20" size={48} />
              <p className="text-lg font-medium text-gray-700 mb-1">No inspections yet</p>
              <p className="mb-4">Start your first product packaging compliance check.</p>
              <Link to="/inspections/new" className="text-blue-600 font-medium hover:underline">Create an inspection</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold">Product</th>
                    <th className="p-4 font-semibold">Category</th>
                    <th className="p-4 font-semibold">Analysis State</th>
                    <th className="p-4 font-semibold">Compliance Status</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentProducts.map(product => (
                    <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{product.productName || 'Unknown Product'}</div>
                        <div className="text-xs text-gray-500">{product.brandName || '-'}</div>
                      </td>
                      <td className="p-4">
                        <span className="capitalize text-gray-700">{product.category || 'Unknown'}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          product.analysisStatus === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          product.analysisStatus === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {product.analysisStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(product.complianceStatus)}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(product.complianceStatus)}`}>
                            {product.complianceStatus || 'PENDING'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-500">
                        {new Date(product.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <Link 
                          to={`/inspections/${product._id}/result`} 
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-sm"
                        >
                          View Result
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                <Link to="/history" className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                  View All Inspections →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default LandingPage;
