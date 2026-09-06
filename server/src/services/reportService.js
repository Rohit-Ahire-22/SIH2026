import Product from '../models/Product.js';

export class ReportService {
  /**
   * Retrieves a Product and normalizes it into a ReportDTO.
   * Throws an error if the product does not exist or analysis is incomplete.
   */
  static async getReportDto(productId) {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error(`Product not found with id: ${productId}`);
    }
    
    if (product.analysisStatus !== 'COMPLETED') {
      throw new Error(`Analysis is not completed for product ${productId}. Current status: ${product.analysisStatus}`);
    }

    const {
      productName, brandName, manufacturerName, category,
      countryOfOrigin, mrp, netQuantity, batchLotNumber,
      dateOfManufacture, dateOfPacking, expiryOrUseByDate,
      consumerCareDetails, complianceStatus, complianceDetails,
      ocrResults, images, createdAt, updatedAt
    } = product;

    // Latest image & OCR
    const latestImage = images && images.length > 0 ? images[images.length - 1] : null;
    const latestOcr = ocrResults && ocrResults.length > 0 ? ocrResults[ocrResults.length - 1] : null;

    // Map Rule details
    const ruleEvaluations = [];
    let checksPassed = 0;
    let checksFailed = 0;
    let checksReview = 0;
    let totalChecks = 0;
    const violations = [];
    const reviews = [];

    const addRules = (ruleData, ruleName) => {
      if (!ruleData || !ruleData.checks) return;
      ruleData.checks.forEach(check => {
        if (check.status === 'NOT_APPLICABLE') return;
        
        totalChecks++;
        if (check.status === 'PASS') checksPassed++;
        else if (check.status === 'FAIL') {
          checksFailed++;
          violations.push({
            rule: `${ruleName} - Clause ${check.clause}`,
            requirement: check.requirement,
            reason: check.reason
          });
        }
        else if (check.status === 'REVIEW') {
          checksReview++;
          reviews.push({
            rule: `${ruleName} - Clause ${check.clause}`,
            requirement: check.requirement,
            reason: check.reason
          });
        }

        ruleEvaluations.push({
          ruleGroup: ruleName,
          clause: check.clause,
          requirement: check.requirement,
          status: check.status,
          reason: check.reason,
          evidence: check.evidence || []
        });
      });
    };

    if (complianceDetails) {
      addRules(complianceDetails.rule6, 'Rule 6');
      addRules(complianceDetails.rule789, 'Rules 7,8,9');
      addRules(complianceDetails.rule11, 'Rule 11');
    }

    return {
      metadata: {
        reportId: `REP-${productId.toString().substring(0, 8).toUpperCase()}`,
        productId: productId.toString(),
        generatedAt: new Date().toISOString(),
        analysisDate: complianceDetails?.evaluatedAt || updatedAt.toISOString(),
        reportVersion: '1.0'
      },
      productInfo: {
        productName: productName || 'Not detected',
        brandName: brandName || 'Not detected',
        manufacturerName: manufacturerName || 'Not detected',
        category: category || 'Unknown',
        countryOfOrigin: countryOfOrigin || 'Not detected',
        mrp: mrp ? `₹${mrp}` : 'Not detected',
        netQuantity: netQuantity && netQuantity.value ? `${netQuantity.value} ${netQuantity.unit}` : 'Not detected',
        batchLotNumber: batchLotNumber || 'Not detected',
        dateOfManufacture: dateOfManufacture ? new Date(dateOfManufacture).toLocaleDateString() : 'Not detected',
        dateOfPacking: dateOfPacking ? new Date(dateOfPacking).toLocaleDateString() : 'Not detected',
        expiryOrUseByDate: expiryOrUseByDate ? new Date(expiryOrUseByDate).toLocaleDateString() : 'Not detected',
        consumerCareDetails: consumerCareDetails ? 
          `Phone: ${consumerCareDetails.phone || 'N/A'}, Email: ${consumerCareDetails.email || 'N/A'}` : 'Not detected',
      },
      summary: {
        overallStatus: complianceStatus || 'REVIEW',
        totalChecks,
        checksPassed,
        checksFailed,
        checksReview
      },
      ruleEvaluations,
      violations,
      reviews,
      ocrEvidence: latestOcr ? latestOcr.results.map(r => ({
        text: r.text,
        confidence: r.confidence
      })) : [],
      imageUrl: latestImage ? latestImage.url : null
    };
  }
}
