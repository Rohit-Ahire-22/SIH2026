/**
 * Service to evaluate production inferences and select valuable training candidates.
 */
export class TrainingCandidateService {
  /**
   * Evaluates an inference payload and determines if it should become a training candidate.
   * Calculates a `learningValueScore`.
   * @param {Object} sample - The TrainingSample document
   * @returns {Object} { shouldBeCandidate, score, reason }
   */
  evaluateInference(sample) {
    let score = 0;
    const reasons = [];

    // Privacy/Consent Gate
    if (sample.provenance.consentStatus === 'inference_only') {
      return { shouldBeCandidate: false, score: 0, reason: 'Consent limited to INFERENCE_ONLY' };
    }

    if (sample.provenance.sourceType === 'user_upload' && sample.provenance.consentStatus !== 'allowed_for_training') {
      return { shouldBeCandidate: false, score: 0, reason: 'User upload lacks explicit training consent' };
    }

    const { inference } = sample;

    // Signal: Low overall detection confidence
    if (inference.detectionConfidence !== undefined && inference.detectionConfidence < 0.6) {
      score += 30;
      reasons.push('LOW_OCR_CONFIDENCE');
    }

    // Signal: Critical fields missing
    if (inference.detectedFields) {
      const fields = inference.detectedFields instanceof Map 
        ? Object.fromEntries(inference.detectedFields) 
        : inference.detectedFields;
      if (!fields['MRP'] || fields['MRP'] === 'MISSING') {
        score += 20;
        reasons.push('MRP_NOT_FOUND');
      }
      if (!fields['Net Quantity'] || fields['Net Quantity'] === 'MISSING') {
        score += 20;
        reasons.push('QUANTITY_NOT_FOUND');
      }
    }

    // Signal: Legal Compliance Failure or Review
    if (inference.complianceStatus === 'REVIEW') {
      score += 25;
      reasons.push('COMPLIANCE_REVIEW');
    } else if (inference.complianceStatus === 'FAIL') {
      score += 10;
      reasons.push('COMPLIANCE_FAIL');
    }

    // Signal: Unknown Category
    if (inference.category === 'UNKNOWN' || inference.category === 'unknown') {
      score += 15;
      reasons.push('CATEGORY_UNKNOWN');
    }

    // Signal: User Corrected (if evaluating feedback retroactively)
    if (sample.feedback && sample.feedback.userCorrected) {
      score += 50;
      reasons.push('USER_CORRECTED');
    }

    const threshold = 30; // Configurable threshold for candidacy
    const shouldBeCandidate = score >= threshold;

    return {
      shouldBeCandidate,
      score,
      reason: reasons.join(', ') || 'No critical learning signals'
    };
  }

  processFeedback(sample, correctedFields, correctionSource, reviewerId) {
    // Preserve original prediction if not already saved
    if (!sample.feedback.originalPrediction) {
      sample.feedback.originalPrediction = sample.inference.detectedFields;
    }

    sample.feedback.correctedPrediction = correctedFields;
    sample.feedback.userCorrected = true;
    sample.feedback.correctionSource = correctionSource;
    sample.feedback.reviewedBy = reviewerId;
    sample.feedback.reviewedAt = new Date();

    // Feedback makes it a high-value candidate automatically
    sample.learning.candidateStatus = 'NEEDS_REVIEW'; // Needs admin review before dataset inclusion
    sample.learning.learningValueScore += 50;
    
    return sample;
  }

  /**
   * Evaluates a sample that has just been verified by a human.
   * Runs strict eligibility gates to determine if it can immediately enter
   * the training queue, avoiding the need to wait for dataset readiness milestones.
   * @param {Object} sample 
   * @returns {Object} sample (mutated)
   */
  markSampleVerified(sample) {
    // Basic verification state changes
    sample.learning.verificationStatus = 'VERIFIED';
    sample.learning.candidateStatus = 'VERIFIED';

    // 1. License Gate
    if (sample.provenance.licenseStatus && sample.provenance.licenseStatus !== 'APPROVED' && sample.provenance.sourceType !== 'user_upload' && sample.provenance.sourceType !== 'proprietary') {
      sample.learning.trainingEligible = false;
      sample.learning.trainingEligibilityReason = 'license_blocked';
      return sample;
    }

    // 2. Consent / Privacy Gate
    if (sample.provenance.consentStatus === 'DENIED' || sample.provenance.consentStatus === 'inference_only') {
      sample.learning.trainingEligible = false;
      sample.learning.trainingEligibilityReason = 'consent_denied';
      return sample;
    }

    // 3. Duplicate / Integrity Gate
    if (sample.quality && sample.quality.imageQualityStatus === 'FAIL') {
      sample.learning.trainingEligible = false;
      sample.learning.trainingEligibilityReason = 'image_quality_failed';
      return sample;
    }
    
    // We assume exact duplicates never even reach here (filtered at ingestion), 
    // but we check just in case it's recorded on the object
    if (sample.duplicateStatus === 'exact_duplicate') {
      sample.learning.trainingEligible = false;
      sample.learning.trainingEligibilityReason = 'exact_duplicate';
      return sample;
    }

    // If it passes all gates, it becomes immediately training eligible!
    sample.learning.trainingEligible = true;
    sample.learning.trainingEligibilityReason = 'verified_permissioned_sample';
    sample.learning.candidateStatus = 'TRAINING_ELIGIBLE';

    return sample;
  }
}
