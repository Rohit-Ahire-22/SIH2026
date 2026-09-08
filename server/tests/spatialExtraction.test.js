import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js'

test('Spatial Test A: Normal horizontal Net Wt', () => {
  const fields = extractProductFields([
    { text: 'Net Wt. 500 g', bbox: [[0,0],[100,0],[100,10],[0,10]] }
  ]);
  assert.equal(fields.netQuantity.value, 500);
  assert.equal(fields.netQuantity.unit, 'g');
})

test('Spatial Test B: Normal horizontal MRP', () => {
  const fields = extractProductFields([
    { text: 'MRP ₹120/- Incl. of all taxes', bbox: [[0,0],[200,0],[200,10],[0,10]] }
  ]);
  assert.equal(fields.mrp.value, 120);
  assert.equal(fields.mrp.inclusiveOfTaxes, true);
})

test('Spatial Test C: Normal horizontal Manufacturer', () => {
  const fields = extractProductFields([
    { text: 'MFG. BY.', bbox: [[0,0],[50,0],[50,10],[0,10]] },
    { text: 'ABC PRIVATE LIMITED', bbox: [[0,15],[150,15],[150,25],[0,25]] }
  ]);
  assert.equal(fields.manufacturerName.value, 'ABC PRIVATE LIMITED');
})

test('Spatial Test D: Detached NET WT', () => {
  const fields = extractProductFields([
    { text: 'NET WT', bbox: [[0,0],[50,0],[50,10],[0,10]] },
    { text: '500', bbox: [[0,15],[30,15],[30,25],[0,25]] },
    { text: 'g', bbox: [[0,30],[10,30],[10,40],[0,40]] }
  ]);
  assert.equal(fields.netQuantity.value, 500);
  assert.equal(fields.netQuantity.unit, 'g');
})

test('Spatial Test E: Detached MRP', () => {
  const fields = extractProductFields([
    { text: 'MRP', bbox: [[0,0],[30,0],[30,10],[0,10]] },
    { text: '₹120/-', bbox: [[0,15],[50,15],[50,25],[0,25]] }
  ]);
  assert.equal(fields.mrp.value, 120);
})

test('Spatial Test F: Detached MRP with taxes', () => {
  const fields = extractProductFields([
    { text: 'MRP', bbox: [[0,0],[30,0],[30,10],[0,10]] },
    { text: '120/-', bbox: [[0,15],[50,15],[50,25],[0,25]] },
    { text: 'Incl. of all taxes', bbox: [[0,30],[120,30],[120,40],[0,40]] }
  ]);
  assert.equal(fields.mrp.value, 120);
  assert.equal(fields.mrp.inclusiveOfTaxes, true);
})

test('Spatial Test G: Manufacturer stopping logic', () => {
  const fields = extractProductFields([
    { text: 'MFG. BY.', bbox: [[0,0],[50,0],[50,10],[0,10]] },
    { text: 'ABC', bbox: [[0,15],[30,15],[30,25],[0,25]] },
    { text: 'PRIVATE LIMITED', bbox: [[0,30],[150,30],[150,40],[0,40]] },
    { text: 'SURF EXCEL IS A REGISTERED TRADEMARK', bbox: [[0,45],[250,45],[250,55],[0,55]] }
  ]);
  assert.equal(fields.manufacturerName.value, 'ABC PRIVATE LIMITED');
})

test('Spatial Test H: Reject PIN code', () => {
  const fields = extractProductFields([
    { text: 'PO BOX 14760', bbox: [[0,0],[100,0],[100,10],[0,10]] },
    { text: 'MUMBAI 400099', bbox: [[0,15],[100,15],[100,25],[0,25]] }
  ]);
  assert.equal(fields.consumerCareDetails, null);
})

test('Spatial Test I: Reject barcode number', () => {
  const fields = extractProductFields([
    { text: 'NET WT', bbox: [[0,0],[50,0],[50,10],[0,10]] },
    { text: '8901030760594', bbox: [[0,15],[150,15],[150,25],[0,25]] }
  ]);
  // 8901030760594 doesn't have a unit so NET_QTY_VALUE won't match it anyway,
  // but if it did, the REJECT_NUMBERS should catch 12-14 digit numbers.
  assert.equal(fields.netQuantity, null);
})

test('Spatial Test J: Valid Phone Number', () => {
  const fields = extractProductFields([
    { text: 'Consumer Care:', bbox: [[0,0],[100,0],[100,10],[0,10]] },
    { text: '1800-10-22-221', bbox: [[0,15],[120,15],[120,25],[0,25]] }
  ]);
  assert.equal(fields.consumerCareDetails.value.phone, '1800-10-22-221');
})

test('Spatial Test K: MFD/Batch see top', () => {
  const fields = extractProductFields([
    { text: '#MFD. & Batch No.: See Top/Seal', bbox: [[0,0],[250,0],[250,10],[0,10]] }
  ]);
  assert.equal(fields.dateOfManufacture.value, 'REVIEW');
  assert.equal(fields.batchLotNumber.value, 'REVIEW');
})
