/**
 * measurementEvidenceService.js
 *
 * Deterministic service to extract physical measurement evidence from image
 * bounding boxes. Converts pixels to physical units ONLY when a legitimate,
 * validated calibration is provided.
 *
 * TRUST BOUNDARY
 * --------------
 * A calibration may be mathematically valid and still be legally UNTRUSTED.
 * This service therefore distinguishes two INDEPENDENT axes:
 *
 *   measurementStatus: 'UNCALIBRATED' | 'CALIBRATED' | 'UNCERTAIN'
 *     - whether a physical (mathematical) conversion from pixels was possible.
 *
 *   calibrationTrust: 'UNTRUSTED' | 'TRUSTED' | 'UNKNOWN'
 *     - whether the compliance architecture accepts the calibration source.
 *
 * Trust is NEVER derived from caller-supplied data. A calibration is TRUSTED
 * only when its `source` appears in the server-side allowlist
 * TRUSTED_CALIBRATION_SOURCES. That allowlist lives in server code and is
 * currently EMPTY: no calibration authority has been verified in this project,
 * so every calibration produced today is UNTRUSTED.
 *
 * Specifically, the following are NEVER automatically trusted:
 *   - user-entered pixels-per-mm
 *   - arbitrary known object dimensions
 *   - assumed DPI
 *   - phone/camera DPI
 *   - coin size / paper size / package dimensions supplied by the caller
 *   - frontend-provided confidence
 *
 * They remain useful as UPSTREAM MATHEMATICAL inputs (a physical value can be
 * calculated), but they cannot produce trustworthy physical evidence until the
 * existing trusted architecture explicitly identifies that source as trusted.
 */

const SUPPORTED_PHYSICAL_UNITS = Object.freeze(['mm', 'cm', 'm', 'inch', 'in'])

// Maximum relative calibration uncertainty (uncertainty / knownSize) that still
// allows a reliable physical claim. Beyond this the evidence is UNCERTAIN.
const MAX_RELATIVE_UNCERTAINTY = 0.5

/**
 * Server-side allowlist of calibration authorities that the trusted
 * architecture explicitly accepts.
 *
 * This set is part of SERVER code and CANNOT be modified by request/context
 * input. It is deliberately empty: no calibration authority has been verified
 * in this project. Only an explicit server-side integration may populate it.
 * A client/user cannot manufacture legal trust by choosing a source name,
 * because the name must be present in this server-side set.
 */
export const TRUSTED_CALIBRATION_SOURCES = new Set()

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function getPixelDimensions(points) {
  if (!points || !Array.isArray(points) || points.length !== 4) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])

  // A simple rotation heuristic: if the left edge x-coordinates (or right edge
  // x-coordinates) differ by more than 5px, the box is rotated.
  const isRotated =
    Math.abs(points[0][0] - points[3][0]) > 5 || Math.abs(points[1][0] - points[2][0]) > 5

  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)

  return { pixelWidth: width, pixelHeight: height, isRotated }
}

function validateCalibration(calibration) {
  if (!calibration || typeof calibration !== 'object') {
    return { ok: false, reason: 'No calibration object provided.' }
  }
  if (!(isFiniteNumber(calibration.knownSize) && calibration.knownSize > 0)) {
    return { ok: false, reason: 'Calibration knownSize must be a finite number > 0.' }
  }
  if (!(isFiniteNumber(calibration.pixelSize) && calibration.pixelSize > 0)) {
    return { ok: false, reason: 'Calibration pixelSize must be a finite number > 0.' }
  }
  const uncertainty = calibration.uncertainty === undefined ? 0 : calibration.uncertainty
  if (!(isFiniteNumber(uncertainty) && uncertainty >= 0)) {
    return { ok: false, reason: 'Calibration uncertainty must be a finite number >= 0.' }
  }
  const unit = typeof calibration.knownUnit === 'string' ? calibration.knownUnit : ''
  if (!SUPPORTED_PHYSICAL_UNITS.includes(unit)) {
    return { ok: false, reason: `Calibration knownUnit '${unit}' is not a supported physical unit.` }
  }
  const confidence = calibration.confidence === undefined ? 1 : calibration.confidence
  if (!(isFiniteNumber(confidence) && confidence >= 0 && confidence <= 1)) {
    return { ok: false, reason: 'Calibration confidence must be a finite number in [0, 1].' }
  }
  return { ok: true, uncertainty, confidence }
}

function resolveCalibrationTrust(hasCalibration, source) {
  if (!hasCalibration) return 'UNKNOWN'
  return TRUSTED_CALIBRATION_SOURCES.has(source) ? 'TRUSTED' : 'UNTRUSTED'
}

export class MeasurementEvidenceService {
  /**
   * Generates the measurement evidence contract.
   * @param {Object} extractedFields  Output from ocrFieldExtractionService
   * @param {Array}  ocrDetections    Raw OCR detections containing bboxes
   * @param {Object} context          May carry context.calibration as an
   *                                  UPSTREAM MATHEMATICAL input. It is never
   *                                  trusted simply because it is supplied.
   * @returns {Object} Measurement evidence contract
   */
  static extractMeasurementEvidence(extractedFields, ocrDetections, context) {
    const evidence = {
      measurementStatus: 'UNCALIBRATED',
      coordinateSpace: 'ORIGINAL_IMAGE',
      calibration: {
        method: 'NONE',
        referenceType: 'NONE',
        source: 'NONE',
        knownSize: 0,
        knownUnit: 'NONE',
        pixelSize: 0,
        uncertainty: 0,
        confidence: 0.0,
      },
      calibrationTrust: 'UNKNOWN',
      measurements: [],
    }

    const calibration = context && context.calibration
    const method = calibration && calibration.method
    const hasCalibration = Boolean(method && method !== 'NONE')

    if (!hasCalibration) {
      // No calibration: carry observed pixel geometry, trust is UNKNOWN.
      this.attachMeasurements(evidence, extractedFields, ocrDetections, null)
      return evidence
    }

    evidence.calibration = {
      method: method,
      referenceType: calibration.referenceType || 'UNSPECIFIED',
      source: calibration.source || 'UNSPECIFIED',
      knownSize: calibration.knownSize,
      knownUnit: calibration.knownUnit,
      pixelSize: calibration.pixelSize,
      uncertainty: calibration.uncertainty === undefined ? 0 : calibration.uncertainty,
      confidence: calibration.confidence === undefined ? 1 : calibration.confidence,
    }
    evidence.calibrationTrust = resolveCalibrationTrust(true, evidence.calibration.source)

    // 1. Strict validation. Malformed calibration must never produce
    //    CALIBRATED evidence; it degrades safely to UNCERTAIN.
    const validation = validateCalibration(calibration)
    if (!validation.ok) {
      evidence.measurementStatus = 'UNCERTAIN'
      evidence.calibration.method = 'INVALID'
      evidence.calibration.validationError = validation.reason
      this.attachMeasurements(evidence, extractedFields, ocrDetections, null)
      return evidence
    }

    // 2. Uncertainty guard: reject calibrations whose relative uncertainty makes
    //    the conversion too unreliable for a physical comparison.
    const scale = calibration.knownSize / calibration.pixelSize
    const relativeUncertainty = validation.uncertainty / calibration.knownSize
    if (relativeUncertainty >= MAX_RELATIVE_UNCERTAINTY) {
      evidence.measurementStatus = 'UNCERTAIN'
      evidence.calibration.method = 'HIGHLY_UNCERTAIN'
      evidence.calibration.validationError =
        `Calibration relative uncertainty (${relativeUncertainty.toFixed(3)}) exceeds supported maximum (${MAX_RELATIVE_UNCERTAINTY}).`
      this.attachMeasurements(evidence, extractedFields, ocrDetections, null)
      return evidence
    }

    // 3. Valid calibration: mathematical conversion is possible.
    evidence.measurementStatus = 'CALIBRATED'
    evidence.calibration.uncertainty = validation.uncertainty
    evidence.calibration.confidence = validation.confidence
    this.attachMeasurements(evidence, extractedFields, ocrDetections, {
      scale,
      unit: evidence.calibration.knownUnit,
      calibrationUncertainty: validation.uncertainty,
      knownSize: calibration.knownSize,
    })
    return evidence
  }

  /**
   * Attaches per-target pixel (observed geometry) and, when a validated scale
   * is available, physical (mathematical conversion) measurements.
   */
  static attachMeasurements(evidence, extractedFields, ocrDetections, scaleInfo) {
    if (!extractedFields || typeof extractedFields !== 'object') return evidence
    if (!ocrDetections || !Array.isArray(ocrDetections)) return evidence

    for (const [key, fieldData] of Object.entries(extractedFields)) {
      if (!fieldData || fieldData.value === 'REVIEW' || !fieldData.value) continue

      const textToFind = String(fieldData.value).toLowerCase()
      const match = ocrDetections.find((d) => String(d.text).toLowerCase().includes(textToFind))
      if (!match || !match.bbox) continue

      const dims = getPixelDimensions(match.bbox)
      if (!dims) continue

      let status = evidence.measurementStatus
      if (dims.isRotated) status = 'UNCERTAIN'

      const measurement = {
        target: key,
        bbox: match.bbox,
        pixelWidth: dims.pixelWidth,
        pixelHeight: dims.pixelHeight,
        physicalWidth: null,
        physicalHeight: null,
        unit: 'NONE',
        uncertainty: 0,
        confidence: match.confidence || 0.0,
        status,
      }

      if (scaleInfo && status === 'CALIBRATED') {
        measurement.physicalWidth = dims.pixelWidth * scaleInfo.scale
        measurement.physicalHeight = dims.pixelHeight * scaleInfo.scale
        measurement.unit = scaleInfo.unit
        // Basic propagation: relative error addition.
        const relativeErrorScale = scaleInfo.calibrationUncertainty / scaleInfo.knownSize
        measurement.uncertainty = measurement.physicalHeight * relativeErrorScale
        // A single measurement whose own uncertainty is too large is UNCERTAIN.
        if (measurement.uncertainty >= measurement.physicalHeight * MAX_RELATIVE_UNCERTAINTY) {
          measurement.status = 'UNCERTAIN'
        }
      }

      evidence.measurements.push(measurement)
    }
    return evidence
  }
}