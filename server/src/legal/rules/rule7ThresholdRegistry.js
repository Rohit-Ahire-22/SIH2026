// rule7ThresholdRegistry.js
//
// Single, server-side source of VERIFIED numerical Rule 7 thresholds.
//
// Rule 7 of the Legal Metrology (Packaged Commodities) Rules, 2011 prescribes
// minimum height requirements for numerals and letters. A definitive legal
// PASS/FAIL on such measurements is only possible when BOTH of these hold:
//
//   1. the physical measurement is trustworthy (the calibration source is
//      accepted by the trusted architecture), AND
//   2. a VERIFIED numerical threshold is published here by the trusted
//      legal-rule architecture.
//
// CURRENT STATE:
// The trusted clause registry (lmpcRule7Clauses.js) explicitly states that
// numerical Rule 7 thresholds are deliberately NOT encoded:
//   "Numerical thresholds are deliberately NOT encoded. Any check that
//    requires a physical millimetre measurement from an uncalibrated image
//    will return REVIEW."
// Consistent with that, this registry intentionally contains NO entries, so
// getVerifiedRule7Threshold() returns undefined and every Rule 7 size-dependent
// check correctly returns REVIEW.
//
// POLICY:
// NEVER add guessed, demo, or web-researched values here. A value may only be
// published after a verified legal source (e.g. the reconciled official
// Gazette text already documented in this project) supplies it.
// Context supplied by callers (context.thresholds) is NEVER a legal threshold
// source and must never influence the values returned here.

const VERIFIED_RULE7_THRESHOLDS = Object.freeze({})

const THRESHOLD_MAP7 = new Map(Object.entries(VERIFIED_RULE7_THRESHOLDS))

/**
 * Resolver object used by the compliance engine. Exposed as a plain object
 * (rather than only a raw namespace export) so the evaluation engine always
 * resolves thresholds through a single, explicit seam. The backing data is
 * read-only; only this server-side module may change its values.
 */
export const rule7ThresholdResolver = {
  /**
   * Returns the verified Rule 7 threshold (in millimetres) for the given
   * ruleId, or undefined when the trusted legal registry contains no verified
   * threshold.
   * @param {string} ruleId
   * @returns {number|undefined}
   */
  getVerifiedRule7Threshold(ruleId) {
    return THRESHOLD_MAP7.get(ruleId)
  },

  /**
   * True only when a finite, verified numeric threshold exists for ruleId.
   * @param {string} ruleId
   * @returns {boolean}
   */
  hasVerifiedRule7Threshold(ruleId) {
    const threshold = THRESHOLD_MAP7.get(ruleId)
    return typeof threshold === 'number' && Number.isFinite(threshold)
  },
}