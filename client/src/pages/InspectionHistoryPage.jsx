import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Search, ChevronLeft, ChevronRight, Filter, AlertCircle, CheckCircle, XCircle, Clock, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config';

function InspectionHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialCategory = searchParams.get('category') || '';
  
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState(initialSearch);

  useEffect(() => {
    fetchHistory();
  }, [searchParams]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const query = new URLSearchParams();
      query.set('page', searchParams.get('page') || '1');
      query.set('limit', '10');
      
      if (searchParams.get('search')) query.set('search', searchParams.get('search'));
      if (searchParams.get('status')) query.set('status', searchParams.get('status'));
      if (searchParams.get('category')) query.set('category', searchParams.get('category'));
      
      const res = await fetch(`${API_URL}/products?${query.toString()}`, {
        credentials: 'include'
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.message || 'Failed to fetch history');
      
      setProducts(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set('search', searchInput.trim());
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1'); // reset page on search
    setSearchParams(newParams);
  };

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage) => {
    if (!pagination || newPage < 1 || newPage > pagination.totalPages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLIANT':
      case 'PASS': return <CheckCircle className="text-green-500" size={16} />;
      case 'NON_COMPLIANT':
      case 'FAIL': return <XCircle className="text-red-500" size={16} />;
      case 'REVIEW': return <AlertCircle className="text-amber-500" size={16} />;
      default: return <Clock className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLIANT':
      case 'PASS': return 'bg-green-100 text-green-800 border-green-200';
      case 'NON_COMPLIANT':
      case 'FAIL': return 'bg-red-100 text-red-800 border-red-200';
      case 'REVIEW': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspection History</h1>
          <p className="text-gray-500">Repository of all scanned and evaluated packaged commodities.</p>
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-xl border shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 flex">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search product, brand, batch..."
              className="pl-10 pr-4 py-2 border rounded-l-lg w-full focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="bg-gray-100 border border-l-0 border-gray-300 px-4 rounded-r-lg font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              Search
            </button>
          </form>

          <div className="flex w-full md:w-auto gap-3">
            <div className="relative">
              <select
                value={searchParams.get('status') || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="COMPLIANT">Compliant (COMPLIANT)</option>
                <option value="NON_COMPLIANT">Non-Compliant (NON_COMPLIANT)</option>
                <option value="REVIEW">Review Required</option>
                <option value="PENDING">Pending</option>
              </select>
              <Filter size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={searchParams.get('category') || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="appearance-none px-4 py-2 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="food">Food</option>
                <option value="beverage">Beverage</option>
                <option value="cosmetic">Cosmetic</option>
                <option value="personal_care">Personal Care</option>
                <option value="household">Household</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p>{error}</p>
          </div>
        )}

        {/* Table View */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b">
                <tr>
                  <th className="p-4 font-semibold w-16">Image</th>
                  <th className="p-4 font-semibold">Product Information</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Compliance Status</th>
                  <th className="p-4 font-semibold">Date Evaluated</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-4"><div className="w-10 h-10 bg-gray-200 rounded"></div></td>
                      <td className="p-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </td>
                      <td className="p-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                      <td className="p-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                      <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="p-4"><div className="h-8 bg-gray-200 rounded w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-16 text-center text-gray-500">
                      <Search className="mx-auto mb-3 opacity-20" size={48} />
                      <p className="text-lg font-medium text-gray-700 mb-1">No inspections found</p>
                      <p>Adjust your search or filter to see results.</p>
                    </td>
                  </tr>
                ) : (
                  products.map(product => {
                    const latestImage = product.images?.[product.images.length - 1];
                    return (
                      <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          {latestImage ? (
                            <img src={latestImage.url} alt="product" className="w-10 h-10 object-cover rounded border bg-white" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 border rounded flex items-center justify-center text-gray-400">
                              <ImageIcon size={18} />
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{product.productName || 'Unknown Product'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {product.brandName && <span className="mr-2">Brand: {product.brandName}</span>}
                            {product.batchLotNumber && <span>Batch: {product.batchLotNumber}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="capitalize text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{product.category || 'Unknown'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(product.complianceStatus)}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(product.complianceStatus)}`}>
                              {product.complianceStatus || 'PENDING'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">
                          {new Date(product.complianceDetails?.evaluatedAt || product.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <Link 
                            to={`/inspections/${product._id}/result`} 
                            className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-blue-600 px-3 py-1.5 rounded shadow-sm font-medium transition-colors"
                          >
                            View Result
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && pagination && pagination.totalPages > 1 && (
            <div className="bg-gray-50 border-t p-4 flex items-center justify-between text-sm text-gray-600">
              <div>
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevious}
                  className="p-1.5 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-3 py-1.5 font-medium border rounded bg-white">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="p-1.5 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default InspectionHistoryPage;
