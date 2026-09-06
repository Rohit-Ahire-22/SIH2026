import { test, describe } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

describe('Dataset Specification Validation', () => {
  const schemaPath = path.resolve(process.cwd(), '../docs/dataset/schema.json')
  let schema = null

  test('1. JSON schema file exists and is valid JSON', () => {
    assert.ok(fs.existsSync(schemaPath), 'Schema file should exist')
    const fileContent = fs.readFileSync(schemaPath, 'utf8')
    schema = JSON.parse(fileContent)
    assert.ok(schema, 'Schema should be parsed successfully')
  })

  test('2. Every class has a unique ID and is restricted to the minimal set', () => {
    const allowedClasses = schema.properties.relevantClasses.items.enum
    
    // Ensure no redundant classes are present
    assert.ok(!allowedClasses.includes('mrp_region'), 'YOLO should not detect MRP; OCR handles it')
    assert.ok(!allowedClasses.includes('date_region'), 'YOLO should not detect dates; OCR handles it')
    assert.ok(!allowedClasses.includes('net_quantity_region'), 'YOLO should not detect quantity; OCR handles it')
    
    // Ensure structural classes are present
    assert.ok(allowedClasses.includes('product_package'), 'product_package class is required')
    assert.ok(allowedClasses.includes('principal_display_panel'), 'principal_display_panel class is required')
    
    // Ensure uniqueness
    const uniqueClasses = new Set(allowedClasses)
    assert.equal(allowedClasses.length, uniqueClasses.size, 'No duplicate class names allowed')
  })

  test('3. Source metadata has required license fields', () => {
    const requiredFields = schema.required
    assert.ok(requiredFields.includes('datasetName'), 'datasetName must be required')
    assert.ok(requiredFields.includes('license'), 'license must be required')
    assert.ok(requiredFields.includes('commercialUseAllowed'), 'commercialUseAllowed must be required')
  })

  test('4. Legal compliance is not encoded as a YOLO class', () => {
    const allowedClasses = schema.properties.relevantClasses.items.enum
    
    // We should never have classes like 'compliant_label' or 'non_compliant_mrp'
    const complianceKeywords = ['compliant', 'pass', 'fail', 'legal', 'illegal']
    
    for (const className of allowedClasses) {
      for (const keyword of complianceKeywords) {
        assert.ok(!className.toLowerCase().includes(keyword), `Class '${className}' must not encode legal compliance`)
      }
    }
  })
})
