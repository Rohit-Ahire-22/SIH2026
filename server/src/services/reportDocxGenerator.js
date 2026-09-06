import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import fetch from 'node-fetch';

export class ReportDocxGenerator {
  static async generate(reportDto) {
    const children = [];

    // Title
    children.push(new Paragraph({
      text: 'Automated Compliance Assessment Report',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    }));
    
    children.push(new Paragraph({
      children: [
        new TextRun(`Report ID: ${reportDto.metadata.reportId} | Generated: ${new Date(reportDto.metadata.generatedAt).toLocaleString()}`)
      ],
      spacing: { after: 400 }
    }));

    // 1. Overall Compliance Summary
    children.push(new Paragraph({ text: '1. Overall Compliance Summary', heading: HeadingLevel.HEADING_2 }));
    
    let statusLabel = 'REVIEW REQUIRED';
    if (reportDto.summary.overallStatus === 'PASS') statusLabel = 'COMPLIANT (PASS)';
    if (reportDto.summary.overallStatus === 'FAIL') statusLabel = 'NON-COMPLIANT (FAIL)';

    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Status: ${statusLabel}`, bold: true }),
      ],
      spacing: { after: 200 }
    }));
    
    children.push(new Paragraph({
      text: `Total Checks: ${reportDto.summary.totalChecks} | Passed: ${reportDto.summary.checksPassed} | Failed: ${reportDto.summary.checksFailed} | Review: ${reportDto.summary.checksReview}`,
      spacing: { after: 400 }
    }));

    // 2. Product Information
    children.push(new Paragraph({ text: '2. Product Information', heading: HeadingLevel.HEADING_2 }));
    const pi = reportDto.productInfo;
    const piLines = [
      `Product Name: ${pi.productName}`,
      `Brand Name: ${pi.brandName}`,
      `Category: ${pi.category}`,
      `Net Quantity: ${pi.netQuantity}`,
      `MRP: ${pi.mrp}`,
      `Date of Manufacture: ${pi.dateOfManufacture}`,
      `Expiry/Use By: ${pi.expiryOrUseByDate}`,
      `Consumer Care: ${pi.consumerCareDetails}`
    ];
    
    piLines.forEach(line => {
      children.push(new Paragraph({ text: line }));
    });
    children.push(new Paragraph({ text: '', spacing: { after: 400 } }));

    // 3. Violations
    if (reportDto.violations.length > 0) {
      children.push(new Paragraph({ text: '3. Detected Non-Compliances', heading: HeadingLevel.HEADING_2 }));
      reportDto.violations.forEach((v, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${v.rule}`, bold: true })] }));
        children.push(new Paragraph({ text: `Requirement: ${v.requirement}` }));
        children.push(new Paragraph({ text: `Finding: ${v.reason}`, spacing: { after: 200 } }));
      });
    }

    // 4. Reviews
    if (reportDto.reviews.length > 0) {
      children.push(new Paragraph({ text: `${reportDto.violations.length > 0 ? '4' : '3'}. Manual Review Required`, heading: HeadingLevel.HEADING_2 }));
      reportDto.reviews.forEach((r, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${r.rule}`, bold: true })] }));
        children.push(new Paragraph({ text: `Requirement: ${r.requirement}` }));
        children.push(new Paragraph({ text: `Reason: ${r.reason}`, spacing: { after: 200 } }));
      });
    }

    // Disclaimer
    children.push(new Paragraph({ text: 'Legal Disclaimer', heading: HeadingLevel.HEADING_2, pageBreakBefore: true }));
    children.push(new Paragraph({
      text: "This report is an automated compliance-assessment aid generated from the submitted product images and extracted information. It is not a statutory inspection notice, legal certification, or final enforcement determination. Findings requiring physical or manual verification should be reviewed by an authorized Legal Metrology official."
    }));

    const doc = new Document({
      sections: [{ properties: {}, children }]
    });

    return Packer.toBuffer(doc);
  }
}
