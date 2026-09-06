import PDFDocument from 'pdfkit';
import fetch from 'node-fetch';

export class ReportPdfGenerator {
  static async generate(reportDto) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Automated Compliance Assessment Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('gray')
           .text(`Report ID: ${reportDto.metadata.reportId} | Generated: ${new Date(reportDto.metadata.generatedAt).toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Banner
        doc.fontSize(14).font('Helvetica-Bold').fillColor('black').text('1. Overall Compliance Summary');
        doc.moveDown(0.5);
        
        let statusColor = 'black';
        let statusLabel = 'REVIEW REQUIRED';
        if (reportDto.summary.overallStatus === 'PASS') { statusColor = 'green'; statusLabel = 'COMPLIANT (PASS)'; }
        if (reportDto.summary.overallStatus === 'FAIL') { statusColor = 'red'; statusLabel = 'NON-COMPLIANT (FAIL)'; }
        if (reportDto.summary.overallStatus === 'REVIEW') { statusColor = 'orange'; }

        doc.fontSize(12).font('Helvetica-Bold').fillColor(statusColor).text(`Status: ${statusLabel}`);
        doc.fillColor('black').font('Helvetica');
        doc.text(`Total Checks: ${reportDto.summary.totalChecks} | Passed: ${reportDto.summary.checksPassed} | Failed: ${reportDto.summary.checksFailed} | Review: ${reportDto.summary.checksReview}`);
        doc.moveDown(1.5);

        // Product Information
        doc.fontSize(14).font('Helvetica-Bold').text('2. Product Information');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        const pi = reportDto.productInfo;
        doc.text(`Product Name: ${pi.productName}`);
        doc.text(`Brand Name: ${pi.brandName}`);
        doc.text(`Category: ${pi.category}`);
        doc.text(`Net Quantity: ${pi.netQuantity}`);
        doc.text(`MRP: ${pi.mrp}`);
        doc.text(`Date of Manufacture: ${pi.dateOfManufacture}`);
        doc.text(`Expiry/Use By: ${pi.expiryOrUseByDate}`);
        doc.text(`Consumer Care: ${pi.consumerCareDetails}`);
        doc.moveDown(1.5);

        // Violations
        if (reportDto.violations.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('red').text('3. Detected Non-Compliances');
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').fillColor('black');
          reportDto.violations.forEach((v, i) => {
            doc.font('Helvetica-Bold').text(`${i + 1}. ${v.rule}`);
            doc.font('Helvetica').text(`Requirement: ${v.requirement}`);
            doc.text(`Finding: ${v.reason}`);
            doc.moveDown(0.5);
          });
          doc.moveDown(1);
        }

        // Review Items
        if (reportDto.reviews.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('orange').text(`${reportDto.violations.length > 0 ? '4' : '3'}. Manual Review Required`);
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica').fillColor('black');
          reportDto.reviews.forEach((r, i) => {
            doc.font('Helvetica-Bold').text(`${i + 1}. ${r.rule}`);
            doc.font('Helvetica').text(`Requirement: ${r.requirement}`);
            doc.text(`Reason: ${r.reason}`);
            doc.moveDown(0.5);
          });
          doc.moveDown(1);
        }

        doc.addPage();
        
        // Detailed Rules
        doc.fontSize(14).font('Helvetica-Bold').fillColor('black').text('Rule-by-Rule Results');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica');
        
        reportDto.ruleEvaluations.forEach(r => {
          doc.font('Helvetica-Bold').text(`${r.ruleGroup} (Clause ${r.clause}) - ${r.status}`);
          doc.font('Helvetica').text(`Req: ${r.requirement}`);
          doc.text(`Reason: ${r.reason}`);
          doc.moveDown(0.5);
        });

        // OCR Evidence Table
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Extracted OCR Evidence (Raw)');
        doc.moveDown(0.5);
        doc.fontSize(8).font('Helvetica');
        if (reportDto.ocrEvidence.length === 0) {
          doc.text('No text extracted.');
        } else {
          reportDto.ocrEvidence.forEach(e => {
            doc.text(`[Conf: ${(e.confidence*100).toFixed(1)}%] ${e.text.substring(0, 80)}`);
          });
        }
        doc.moveDown(2);

        // Product Image
        if (reportDto.imageUrl) {
          try {
            const response = await fetch(reportDto.imageUrl);
            if (response.ok) {
              const imageBuffer = await response.buffer();
              doc.fontSize(14).font('Helvetica-Bold').text('Submitted Product Image');
              doc.moveDown(1);
              doc.image(imageBuffer, { fit: [400, 400], align: 'center' });
            } else {
              doc.text('Evidence image unavailable (Failed to fetch).');
            }
          } catch (err) {
            doc.text('Evidence image unavailable (Network error).');
          }
        }

        doc.addPage();

        // Disclaimer
        doc.fontSize(12).font('Helvetica-Bold').text('Legal Disclaimer');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        const disclaimer = "This report is an automated compliance-assessment aid generated from the submitted product images and extracted information. It is not a statutory inspection notice, legal certification, or final enforcement determination. Findings requiring physical or manual verification should be reviewed by an authorized Legal Metrology official.";
        doc.text(disclaimer, { align: 'justify' });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
