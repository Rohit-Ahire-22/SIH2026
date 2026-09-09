import { describe, it, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { MeasurementEvidenceService, TRUSTED_CALIBRATION_SOURCES } from '../src/services/measurementEvidenceService.js'

const TEST_TRUSTED_SOURCE = 'TEST_TRUSTED_SERVER_AUTHORITY'

describe('MeasurementEvidenceService', () => {
  after(() => {
    TRUSTED_CALIBRATION_SOURCES.delete(TEST_TRUSTED_SOURCE)
  })

  it('A. returns UNCALIBRATED + UNKNOWN trust when context has no calibration', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {})

    assert.equal(evidence.measurementStatus, 'UNCALIBRATED')
    assert.equal(evidence.calibrationTrust, 'UNKNOWN')
    assert.equal(evidence.measurements[0].target, 'mrp')
    assert.equal(evidence.measurements[0].pixelHeight, 10)
    assert.equal(evidence.measurements[0].physicalHeight, null)
    assert.equal(evidence.measurements[0].status, 'UNCALIBRATED')
  })

  it('B. computes physical measurements when calibration is mathematically valid', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 20], [0, 20]] }]

    // Scale: 100px = 50mm -> 1px = 0.5mm
    const context = {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        referenceType: 'user_provided_scale',
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 5
      }
    }

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, context)

    assert.equal(evidence.measurementStatus, 'CALIBRATED')
    assert.equal(evidence.measurements[0].pixelHeight, 20)
    assert.equal(evidence.measurements[0].physicalHeight, 10) // 20 * 0.5
    assert.equal(evidence.measurements[0].physicalWidth, 5) // 10 * 0.5
    assert.equal(evidence.measurements[0].unit, 'mm')
    // Uncertainty: 5/50 = 10% relative error. physicalHeight=10 * 10% = 1.
    assert.equal(evidence.measurements[0].uncertainty, 1)
  })

  it('C. degrades safely to UNCERTAIN on malformed calibration (unsupported unit)', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    const context = {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        knownSize: 50,
        knownUnit: 'furlongs', // arbitrary string, not a supported unit
        pixelSize: 100,
        uncertainty: 0,
        confidence: 0.9
      }
    }

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, context)

    assert.notEqual(evidence.measurementStatus, 'CALIBRATED')
    assert.equal(evidence.measurementStatus, 'UNCERTAIN')
    assert.equal(evidence.calibration.method, 'INVALID')
    assert.ok(evidence.calibration.validationError.includes('knownUnit'))
    assert.equal(evidence.measurements[0].physicalHeight, null)
  })

  it('D. zero pixelSize is never CALIBRATED', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    const context = {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 0,
        uncertainty: 0
      }
    }

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, context)

    assert.equal(evidence.measurementStatus, 'UNCERTAIN')
    assert.ok(evidence.calibration.validationError.includes('pixelSize'))
  })

  it('E. negative knownSize is never CALIBRATED', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    const context = {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        knownSize: -50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 0
      }
    }

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, context)

    assert.equal(evidence.measurementStatus, 'UNCERTAIN')
    assert.ok(evidence.calibration.validationError.includes('knownSize'))
  })

  it('F. NaN and Infinity calibration values are never CALIBRATED', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    const nanContext = {
      calibration: { method: 'TEST', knownSize: NaN, knownUnit: 'mm', pixelSize: 100, uncertainty: 0 }
    }
    const infContext = {
      calibration: { method: 'TEST', knownSize: 50, knownUnit: 'mm', pixelSize: Infinity, uncertainty: 0 }
    }
    const negUncert = {
      calibration: { method: 'TEST', knownSize: 50, knownUnit: 'mm', pixelSize: 100, uncertainty: -1 }
    }
    const badConfidence = {
      calibration: { method: 'TEST', knownSize: 50, knownUnit: 'mm', pixelSize: 100, uncertainty: 0, confidence: 3 }
    }

    for (const ctx of [nanContext, infContext, negUncert, badConfidence]) {
      const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, ctx)
      assert.notEqual(evidence.measurementStatus, 'CALIBRATED', JSON.stringify(ctx))
      assert.equal(evidence.measurementStatus, 'UNCERTAIN')
    }
  })

  it('G. arbitrary caller calibration never becomes automatically legally trusted', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 10], [0, 10]] }]

    // User-entered pixels-per-mm calibration: mathematically CALIBRATED, but UNTRUSTED.
    const ev1 = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        referenceType: 'user_provided_pixels_per_mm',
        source: 'user',
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 0,
        confidence: 0.99 // frontend-provided confidence
      }
    })
    assert.equal(ev1.measurementStatus, 'CALIBRATED')
    assert.equal(ev1.calibrationTrust, 'UNTRUSTED')

    // A caller cannot manufacture trust by choosing a convincing source name.
    const ev2 = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        source: 'server-trusted-measurement-authority', // not in server allowlist
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 0
      }
    })
    assert.equal(ev2.calibrationTrust, 'UNTRUSTED')

    // Only an explicit server-side allowlist entry grants TRUSTED.
    TRUSTED_CALIBRATION_SOURCES.add(TEST_TRUSTED_SOURCE)
    const ev3 = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {
      calibration: {
        method: 'SERVER_INSPECTION_SETUP',
        source: TEST_TRUSTED_SOURCE,
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 0
      }
    })
    assert.equal(ev3.calibrationTrust, 'TRUSTED')
    assert.equal(ev3.measurementStatus, 'CALIBRATED')
  })

  it('K. excessive calibration uncertainty produces UNCERTAIN, never a confident measurement', () => {
    const extractedFields = { mrp: { value: '100' } }
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, 0], [10, 20], [0, 20]] }]

    // relative uncertainty = 30/50 = 0.6 >= 0.5 -> UNCERTAIN
    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {
      calibration: {
        method: 'EXPLICIT_USER_INPUT',
        knownSize: 50,
        knownUnit: 'mm',
        pixelSize: 100,
        uncertainty: 30
      }
    })

    assert.equal(evidence.measurementStatus, 'UNCERTAIN')
    assert.equal(evidence.calibration.method, 'HIGHLY_UNCERTAIN')
    assert.equal(evidence.measurements[0].physicalHeight, null)
  })

  it('marks measurement as UNCERTAIN if the bbox points indicate heavy rotation', () => {
    const extractedFields = { mrp: { value: '100' } }
    // A rotated box where x-coords differ wildly on the same side
    const ocrDetections = [{ text: '100', bbox: [[0, 0], [10, -10], [20, 0], [10, 10]] }]

    const evidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {})
    assert.equal(evidence.measurements[0].status, 'UNCERTAIN')
  })
})