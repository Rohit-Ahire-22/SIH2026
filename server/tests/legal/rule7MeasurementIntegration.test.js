import { describe, it, mock, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRules789 } from '../../src/legal/compliance/rule789ComplianceService.js'
import { COMPLIANCE_STATUS } from '../../src/legal/compliance/complianceTypes.js'
import { MeasurementEvidenceService, TRUSTED_CALIBRATION_SOURCES } from '../../src/services/measurementEvidenceService.js'
import * as rule7Threshold from '../../src/legal/rules/rule7ThresholdRegistry.js'

const { rule7ThresholdResolver } = rule7Threshold

const TEST_TRUSTED_SOURCE = 'TEST_TRUSTED_SERVER_AUTHORITY'
const NUMERAL_HEIGHT_RULE = 'LMPC-RULE7-numeralLetterHeight'

describe('Rule 7 Measurement Integration', () => {
  const baseContext = {
    packageType: 'PRE_PACKAGED',
    consumerType: 'RETAIL',
    importStatus: 'DOMESTIC'
  }

  before(() => {
    // Simulate an explicit, server-side calibration authority being registered.
    // In production the allowlist remains empty; the mechanism is identical.
    TRUSTED_CALIBRATION_SOURCES.add(TEST_TRUSTED_SOURCE)
  })

  after(() => {
    TRUSTED_CALIBRATION_SOURCES.delete(TEST_TRUSTED_SOURCE)
    mock.restoreAll()
  })

  function trustedMeasurementEvidence(height, uncertainty = 0.1) {
    return {
      measurementStatus: 'CALIBRATED',
      calibrationTrust: 'TRUSTED',
      calibration: { method: 'SERVER_VISUAL_CALIBRATION', source: TEST_TRUSTED_SOURCE, knownUnit: 'mm' },
      measurements: [
        { target: 'numeralLetterHeight', physicalHeight: height, physicalWidth: height * 0.5, unit: 'mm', uncertainty, status: 'CALIBRATED' }
      ]
    }
  }

  function getCheck(result, ruleId = NUMERAL_HEIGHT_RULE) {
    const check = result.checks.find((c) => c.ruleId === ruleId)
    assert.ok(check, `check ${ruleId} should be present`)
    return check
  }

  it('A. returns REVIEW when measurement is UNCALIBRATED', () => {
    const measurementEvidence = {
      measurementStatus: 'UNCALIBRATED',
      measurements: [{ target: 'numeralLetterHeight', pixelHeight: 20 }]
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('Pixels cannot safely be interpreted as millimetres'))
  })

  it('H. caller-supplied context.thresholds can never create legal PASS/FAIL (untrusted calibration)', () => {
    const measurementEvidence = {
      measurementStatus: 'CALIBRATED',
      calibrationTrust: 'UNTRUSTED',
      calibration: { method: 'EXPLICIT_USER_INPUT', source: 'user', knownUnit: 'mm' },
      measurements: [
        { target: 'numeralLetterHeight', physicalHeight: 2.5, unit: 'mm', uncertainty: 0.1, status: 'CALIBRATED' }
      ]
    }

    const context = {
      ...baseContext,
      thresholds: { numeralLetterHeight: 2.0 }
    }

    const result = evaluateRules789({
      product: {},
      context,
      measurementEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('calibration source is not trusted'))
  })

  it('H. caller-supplied context.thresholds can never create legal PASS/FAIL (trusted calibration, no verified threshold)', () => {
    // Trusted calibration + context.thresholds, but the trusted legal registry
    // encodes no verified Rule 7 threshold -> REVIEW, never PASS/FAIL.
    const context = {
      ...baseContext,
      thresholds: { numeralLetterHeight: 2.0 }
    }

    const result = evaluateRules789({
      product: {},
      context,
      measurementEvidence: trustedMeasurementEvidence(5.0), // well above 2.0 if it were used
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('no verified legal Rule 7 threshold is currently encoded'))
  })

  it('I. trusted calibration + verified legal threshold + valid measurement yields deterministic PASS', () => {
    mock.method(rule7ThresholdResolver, 'getVerifiedRule7Threshold', () => 2.0)

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence: trustedMeasurementEvidence(2.5),
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.PASS)
    assert.ok(check.reason.includes('Meets required threshold of 2 mm'))
    mock.restoreAll()
  })

  it('I. trusted calibration + verified legal threshold + valid measurement yields deterministic FAIL', () => {
    mock.method(rule7ThresholdResolver, 'getVerifiedRule7Threshold', () => 2.0)

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence: trustedMeasurementEvidence(1.5),
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.FAIL)
    assert.ok(check.reason.includes('Fails required threshold of 2 mm'))
    mock.restoreAll()
  })

  it('J. trusted calibration but no verified legal threshold -> REVIEW', () => {
    // No mock: the trusted registry currently encodes no numeric Rule 7 threshold.
    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence: trustedMeasurementEvidence(2.5),
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('no verified legal Rule 7 threshold is currently encoded'))
  })

  it('K. uncertain measurement -> REVIEW (per-measurement UNCERTAIN)', () => {
    const measurementEvidence = {
      measurementStatus: 'CALIBRATED',
      calibrationTrust: 'TRUSTED',
      calibration: { method: 'SERVER_VISUAL_CALIBRATION', source: TEST_TRUSTED_SOURCE, knownUnit: 'mm' },
      measurements: [
        { target: 'numeralLetterHeight', physicalHeight: 2.5, unit: 'mm', uncertainty: 0.1, status: 'UNCERTAIN' }
      ]
    }

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence,
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
  })

  it('K. uncertainty band straddling the verified threshold -> REVIEW, never PASS/FAIL', () => {
    mock.method(rule7ThresholdResolver, 'getVerifiedRule7Threshold', () => 2.0)

    // 2.0 mm measured with +/-0.5 mm uncertainty straddles the 2.0 mm threshold.
    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence: trustedMeasurementEvidence(2.0, 0.5),
      asOfDate: new Date('2026-01-01')
    })

    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
    assert.ok(check.reason.includes('straddles the verified threshold'))
    mock.restoreAll()
  })

  it('L. real VIM fixture (HUL Excel Easy Wash) remains REVIEW: no legitimate calibration or legal threshold', () => {
    // Realistic fields/bboxes observed from the VIM fixture output (test-after.log).
    const extractedFields = {
      manufacturerName: { value: 'HINDUSTAN UNIL LIMTEDPLOTNO.B-7MIDCO HUL2024.STORE INA COOLPLACE' },
      brandName: { value: 'excel' },
      productName: { value: 'Easy Wash' }
    }
    const ocrDetections = [
      {
        text: 'HINDUSTAN UNIL LIMTEDPLOTNO.B-7MIDCO HUL2024.STORE INA COOLPLACE.',
        bbox: [[923, 322], [1074, 322], [1074, 783], [923, 783]],
        confidence: 0.86
      },
      {
        text: 'excel',
        bbox: [[1305, 321], [1369, 321], [1369, 460], [1305, 460]],
        confidence: 0.75
      },
      {
        text: 'Easy Wash',
        bbox: [[1276, 326], [1311, 326], [1311, 471], [1276, 471]],
        confidence: 0.956
      }
    ]

    // No calibration anywhere: the fixture has no legitimate calibration input.
    const measurementEvidence = MeasurementEvidenceService.extractMeasurementEvidence(extractedFields, ocrDetections, {})

    assert.equal(measurementEvidence.measurementStatus, 'UNCALIBRATED')
    assert.equal(measurementEvidence.calibrationTrust, 'UNKNOWN')

    const result = evaluateRules789({
      product: {},
      context: baseContext,
      measurementEvidence,
      asOfDate: new Date('2026-01-01')
    })

    assert.equal(result.status, COMPLIANCE_STATUS.REVIEW)
    const check = getCheck(result)
    assert.equal(check.status, COMPLIANCE_STATUS.REVIEW)
  })
})