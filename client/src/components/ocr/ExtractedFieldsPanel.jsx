import { Package, Calendar, Globe, Building2, Phone } from 'lucide-react';

function FieldRow({ icon: Icon, label, value }) {
  const isMissing = value === null || value === undefined || value === '';
  
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 text-gray-400">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className={`text-sm ${isMissing ? 'text-gray-400 italic' : 'text-gray-900 font-medium'}`}>
          {isMissing ? 'Not detected' : value}
        </div>
      </div>
    </div>
  );
}

function ExtractedFieldsPanel({ fields = {} }) {
  
  const formatQuantity = (qty) => {
    if (!qty) return null;
    return `${qty.value} ${qty.unit}`;
  };

  const formatConsumerCare = (care) => {
    if (!care) return null;
    const parts = [];
    if (care.phone) parts.push(`📞 ${care.phone}`);
    if (care.email) parts.push(`✉️ ${care.email}`);
    return parts.length ? parts.join(' | ') : 'Present, details unparsed';
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-5 h-full">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Extracted Fields</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
        <div>
          <FieldRow icon={Package} label="MRP" value={fields.mrp ? `₹${fields.mrp}` : null} />
          <FieldRow icon={Package} label="Net Quantity" value={formatQuantity(fields.netQuantity)} />
          <FieldRow icon={Package} label="Batch / Lot" value={fields.batchLotNumber} />
        </div>
        <div>
          <FieldRow icon={Calendar} label="Date of Manufacture" value={fields.dateOfManufacture} />
          <FieldRow icon={Calendar} label="Date of Packing" value={fields.dateOfPacking} />
          <FieldRow icon={Calendar} label="Expiry / Use By" value={fields.expiryOrUseByDate} />
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-100">
        <FieldRow icon={Globe} label="Country of Origin" value={fields.countryOfOrigin} />
        <FieldRow icon={Building2} label="Manufacturer" value={fields.manufacturerName} />
        <FieldRow icon={Phone} label="Consumer Care" value={formatConsumerCare(fields.consumerCareDetails)} />
      </div>
    </div>
  );
}

export default ExtractedFieldsPanel;
