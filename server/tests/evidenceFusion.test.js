import { describe, it } from 'node:test'
import assert from 'node:assert'
import { EvidenceFusionService } from '../src/services/evidenceFusionService.js'

describe('EvidenceFusionService', () => {
  it('gracefully handles missing visual model', () => {
    const extractedFields = {
      mrp: { value: '100', bbox: [[0,0], [10,0], [10,10], [0,10]] }
    }
    const visualResult = {
      inferenceStatus: 'UNAVAILABLE_MODEL_MISSING',
      detections: []
    }
    const ocrDetections = []

    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, ocrDetections)
    
    assert.strictEqual(fused.visualInferenceStatus, 'UNAVAILABLE_MODEL_MISSING')
    assert.strictEqual(fused.fusedFields.mrp.spatialRelationToPdp, 'UNKNOWN')
  })

  it('detects OCR bounding box INSIDE PDP', () => {
    const extractedFields = {
      mrp: { value: '100', bbox: [[10, 10], [20, 10], [20, 20], [10, 20]] }
    }
    const visualResult = {
      inferenceStatus: 'SUCCESS',
      detections: [
        { label: 'pdp', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 100], [0, 100]] }
      ]
    }

    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    
    assert.strictEqual(fused.pdpDetected, true)
    assert.strictEqual(fused.fusedFields.mrp.spatialRelationToPdp, 'INSIDE')
  })

  it('detects OCR bounding box PARTIAL inside PDP', () => {
    const extractedFields = {
      mrp: { value: '100', bbox: [[90, 10], [110, 10], [110, 20], [90, 20]] }
    }
    const visualResult = {
      inferenceStatus: 'SUCCESS',
      detections: [
        { label: 'pdp', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 100], [0, 100]] }
      ]
    }

    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    
    assert.strictEqual(fused.fusedFields.mrp.spatialRelationToPdp, 'PARTIAL')
  })

  it('detects OCR bounding box OUTSIDE PDP', () => {
    const extractedFields = {
      mrp: { value: '100', bbox: [[150, 10], [200, 10], [200, 20], [150, 20]] }
    }
    const visualResult = {
      inferenceStatus: 'SUCCESS',
      detections: [
        { label: 'pdp', confidence: 0.95, bbox: [[0, 0], [100, 0], [100, 100], [0, 100]] }
      ]
    }

    const fused = EvidenceFusionService.fuseEvidence(extractedFields, visualResult, [])
    
    assert.strictEqual(fused.fusedFields.mrp.spatialRelationToPdp, 'OUTSIDE')
  })
})
