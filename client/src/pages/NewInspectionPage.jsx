import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Upload, X, ArrowRight, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config';

function NewInspectionPage() {
  const navigate = useNavigate();
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [mrp, setMrp] = useState('0');
  const [netQuantityValue, setNetQuantityValue] = useState('0');
  const [netQuantityUnit, setNetQuantityUnit] = useState('g');
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setError('Please select an image of the product packaging.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create Product
      const productRes = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName || 'Unknown Product',
          brandName: brandName || undefined,
          mrp: Number(mrp) || 0,
          netQuantity: {
            value: Number(netQuantityValue) || 0,
            unit: netQuantityUnit || 'g'
          }
        }),
        credentials: 'include'
      });
      
      const productData = await productRes.json();
      if (!productRes.ok) throw new Error(productData.message || 'Failed to create product record.');
      
      const productId = productData.data._id;

      // 2. Upload Image
      const formData = new FormData();
      formData.append('image', imageFile);

      const imageRes = await fetch(`${API_URL}/products/${productId}/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const imageData = await imageRes.json();
      if (!imageRes.ok) throw new Error(imageData.message || 'Failed to upload image.');

      // 3. Navigate to Analysis workflow
      navigate(`/inspections/${productId}/analyze`);

    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">New Inspection</h1>
              <p className="text-gray-500">Upload a product label to evaluate its legal metrology compliance.</p>
            </div>
            <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">← Dashboard</Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Image Upload */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border rounded-lg p-6 flex flex-col h-full shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ImageIcon size={20} className="text-blue-600" />
                Product Label Image
              </h2>
              
              {!imagePreview ? (
                <div className="flex-1 min-h-[300px] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Upload size={48} className="text-blue-500 mb-4" />
                  <p className="text-gray-700 font-medium mb-1">Upload a clear photo</p>
                  <p className="text-sm text-gray-500 text-center mb-6">Ensure all text and declarations on the label are visible.</p>
                  
                  <label className="bg-white border shadow-sm px-6 py-2.5 rounded text-blue-600 font-medium cursor-pointer hover:bg-blue-50 transition-colors">
                    Browse Files
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp" 
                      onChange={handleImageChange} 
                      className="hidden" 
                    />
                  </label>
                </div>
              ) : (
                <div className="relative flex-1 min-h-[300px] border rounded-lg overflow-hidden bg-black flex items-center justify-center group">
                  <img src={imagePreview} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
                  <button 
                    type="button"
                    onClick={removeImage}
                    className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Metadata (Optional) */}
          <div className="flex flex-col gap-6">
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-3">Optional Metadata</h2>
              <p className="text-sm text-gray-500 mb-5">
                Providing this information helps the legal engine verify OCR accuracy, but it is not strictly required.
              </p>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-gray-700 font-medium mb-1.5">Product Name</label>
                  <input 
                    type="text" 
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Tomato Ketchup"
                    className="w-full border rounded p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-1.5">Brand Name</label>
                  <input 
                    type="text" 
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Heinz"
                    className="w-full border rounded p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1.5">Known MRP (₹)</label>
                    <input 
                      type="number" 
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      className="w-full border rounded p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-1.5">Net Quantity</label>
                    <div className="flex">
                      <input 
                        type="number" 
                        value={netQuantityValue}
                        onChange={(e) => setNetQuantityValue(e.target.value)}
                        className="w-2/3 border rounded-l p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                      />
                      <select 
                        value={netQuantityUnit}
                        onChange={(e) => setNetQuantityUnit(e.target.value)}
                        className="w-1/3 border-y border-r rounded-r p-2.5 bg-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="U">U (Units)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={submitting || !imageFile}
              className={`w-full py-3.5 rounded-lg shadow-sm font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                submitting || !imageFile 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:transform active:scale-[0.99]'
              }`}
            >
              {submitting ? 'Uploading...' : 'Analyze Product'}
              {!submitting && <ArrowRight size={20} />}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default NewInspectionPage;
