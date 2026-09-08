import test from 'node:test'
import assert from 'node:assert'
import { extractProductFields } from '../src/services/ocrFieldExtractionService.js'

function makeNode(text, x, y, width, height, confidence = 0.99) {
  return {
    text,
    confidence,
    bbox: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ]
  };
}

test('Brand/Product Test A: Explicit brand label', () => {
  const nodes = [
    makeNode('BRAND NAME:', 10, 10, 100, 20),
    makeNode('SuperClean', 120, 10, 100, 20)
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'SuperClean');
});

test('Brand/Product Test B: Explicit product label', () => {
  const nodes = [
    makeNode('Product:', 10, 10, 80, 20),
    makeNode('Liquid Soap', 100, 10, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Liquid Soap');
});

test('Brand/Product Test C: Trademark brand', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40) // Very large font size 40
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'MegaWash');
});

test('Brand/Product Test D: Brand + product adjacent', () => {
  const nodes = [
    makeNode('Lumina', 10, 10, 100, 50),
    makeNode('Face Cream', 120, 10, 100, 30) // Nearby product keyword
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'Lumina');
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Face Cream');
});

test('Brand/Product Test E: Brand above product', () => {
  const nodes = [
    makeNode('Shiny', 10, 10, 100, 50),
    makeNode('Detergent', 10, 70, 100, 30)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'Shiny');
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Detergent');
});

test('Brand/Product Test F: Detached brand/product boxes', () => {
  const nodes = [
    makeNode('BRAND:', 10, 10, 80, 20),
    makeNode('Aura', 200, 10, 80, 20), // 110px gap
    makeNode('Shampoo', 200, 40, 80, 20)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'Aura');
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Shampoo');
});

test('Brand/Product Test H: Phone number rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('1800-123-4567', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test I: PIN rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('415720', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test J: Email rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('care@example.com', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test K: MRP rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('MRP 150.00', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test L: Quantity rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('Net Wt 500g', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test M: Date rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('Mfg Date: 12/2025', 10, 70, 100, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test N: Long promotional sentence rejection', () => {
  const nodes = [
    makeNode('MegaWash ™', 10, 10, 150, 40),
    makeNode('This product has been lab tested to remove 100 stains.', 10, 70, 400, 20)
  ];
  const { productName, brandName } = extractProductFields(nodes);
  assert.strictEqual(productName, null);
  // Brand name should not pick up the long sentence either
  assert.strictEqual(brandName.value, 'MegaWash');
});

test('Brand/Product Test O: Multi-token product name', () => {
  const nodes = [
    makeNode('Brand:', 10, 10, 50, 20),
    makeNode('Glow', 70, 10, 50, 20),
    makeNode('Face', 70, 40, 40, 20),
    makeNode('Wash', 120, 40, 40, 20)
  ];
  const { productName } = extractProductFields(nodes);
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Face Wash');
});

test('Brand/Product Test P: Low-confidence candidate rejection', () => {
  const nodes = [
    makeNode('Shiny', 10, 10, 100, 50, 0.4), // 0.4 confidence is very low
    makeNode('Detergent', 10, 70, 100, 30, 0.3)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.strictEqual(brandName, null);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test Q: Ambiguous packaging returns REVIEW/null', () => {
  const nodes = [
    makeNode('Some generic text', 10, 10, 100, 20),
    makeNode('Another piece of info', 10, 40, 100, 20)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.strictEqual(brandName, null);
  assert.strictEqual(productName, null);
});

test('Brand/Product Test R: Rotated/vertical bbox arrangement', () => {
  // Height > Width implies vertical alignment or text that is rotated
  const nodes = [
    makeNode('BRAND:', 10, 10, 20, 80),
    makeNode('Aura', 40, 10, 20, 80),
    makeNode('Shampoo', 70, 10, 20, 80)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'Aura');
  assert.ok(productName);
  assert.strictEqual(productName.value, 'Shampoo');
});

test('Brand/Product Test S: Manufacturer name does not become brand', () => {
  const nodes = [
    makeNode('MFG. BY', 10, 10, 50, 20),
    makeNode('Hindustan Unilever Ltd', 70, 10, 150, 20)
  ];
  const { manufacturerName, brandName, productName } = extractProductFields(nodes);
  assert.ok(manufacturerName);
  assert.ok(manufacturerName.value.includes('Hindustan Unilever'));
  
  // Neither brand nor product should erroneously pick up the manufacturer text
  assert.strictEqual(brandName, null);
  assert.strictEqual(productName, null);
});

// --- NEW CONFIDENCE AND GENERIC WORD TESTS ---

test('Confidence Test 1: Single prominent generic word without context -> REVIEW/null', () => {
  const nodes = [ makeNode('Excel', 10, 10, 100, 50, 0.99) ]; // No trademark or explicit label
  const { brandName } = extractProductFields(nodes);
  if (brandName) {
    assert.strictEqual(brandName.status, 'REVIEW');
    assert.ok(brandName.confidence <= 0.75); // Capped
  }
});

test('Confidence Test 2: Single prominent arbitrary noun -> REVIEW/null', () => {
  const nodes = [ makeNode('Galaxy', 10, 10, 100, 50, 0.98) ];
  const { brandName } = extractProductFields(nodes);
  if (brandName) {
    assert.strictEqual(brandName.status, 'REVIEW');
    assert.ok(brandName.confidence <= 0.6); // Capped due to no semantic evidence
  }
});

test('Confidence Test 3: OCR captures only second half of multi-token brand -> REVIEW/null', () => {
  // If only "excel" is found and it has trademark evidence, it should still be REVIEW and capped
  const nodes = [ 
    makeNode('Excel', 10, 10, 100, 50, 0.99),
    makeNode('Surf Excel is a registered trademark', 10, 100, 200, 20, 0.99)
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.value, 'Excel');
  assert.strictEqual(brandName.status, 'REVIEW'); // Generic word with evidence is still REVIEW
  assert.ok(brandName.confidence <= 0.75);
});

test('Confidence Test 4: Explicit BRAND label -> PASS', () => {
  const nodes = [ 
    makeNode('Brand:', 10, 10, 60, 20, 0.99),
    makeNode('Lumina', 80, 10, 100, 20, 0.99)
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.status, 'PASS');
  assert.ok(brandName.confidence >= 0.9);
});

test('Confidence Test 5: Trademark association -> PASS', () => {
  const nodes = [ makeNode('Lumina™', 10, 10, 100, 50, 0.99) ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.status, 'PASS');
  assert.ok(brandName.confidence >= 0.9);
});

test('Confidence Test 6: Multi-token brand with strong spatial evidence -> PASS', () => {
  const nodes = [ 
    makeNode('Surf', 10, 10, 80, 50, 0.99),
    makeNode('Excel', 100, 10, 90, 50, 0.99),
    makeNode('Surf Excel is a registered trademark', 10, 100, 200, 20, 0.99)
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.ok(brandName.value.includes('Surf Excel') || brandName.value.includes('Excel Surf'));
  assert.strictEqual(brandName.status, 'PASS');
});

test('Confidence Test 7: Manufacturer name -> rejected', () => {
  // Manufacturer names should not become brand candidates
  const nodes = [ makeNode('Hindustan Unilever Limited', 10, 10, 300, 50, 0.99) ];
  const { brandName } = extractProductFields(nodes);
  assert.strictEqual(brandName, null); // should be completely rejected
});

test('Confidence Test 8: Promotional word -> rejected/review', () => {
  const nodes = [ makeNode('New', 10, 10, 100, 50, 0.99) ];
  const { brandName } = extractProductFields(nodes);
  if (brandName) {
    assert.strictEqual(brandName.status, 'REVIEW');
  }
});

test('Confidence Test 9: Product name must not automatically become brand', () => {
  const nodes = [ 
    makeNode('Dishwash', 10, 10, 150, 50, 0.99)
  ];
  const { brandName, productName } = extractProductFields(nodes);
  assert.strictEqual(brandName, null);
  assert.ok(productName);
});

test('Confidence Test 10: OCR confidence must not equal extraction confidence', () => {
  const nodes = [ 
    makeNode('Lumina', 10, 10, 100, 50, 0.99), // 0.99 OCR confidence
    makeNode('Small text', 10, 100, 100, 20, 0.99) // ensure median is small
  ];
  const { brandName } = extractProductFields(nodes);
  assert.ok(brandName);
  assert.strictEqual(brandName.status, 'REVIEW');
  // Extraction confidence should be capped because there is no semantic/explicit label
  assert.ok(brandName.confidence < 0.99);
  assert.ok(brandName.confidence <= 0.6);
});
