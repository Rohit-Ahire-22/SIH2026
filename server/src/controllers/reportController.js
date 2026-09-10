import mongoose from 'mongoose';
import { ReportService } from '../services/reportService.js';
import { ReportPdfGenerator } from '../services/reportPdfGenerator.js';
import { ReportDocxGenerator } from '../services/reportDocxGenerator.js';

export async function generatePdfReport(req, res, next) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: `Invalid product id: ${id}` });
  }

  try {
    const reportDto = await ReportService.getReportDto(id, req.user.userId);
    const pdfBuffer = await ReportPdfGenerator.generate(reportDto);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compliance_report_${reportDto.metadata.reportId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.end(pdfBuffer);
  } catch (err) {
    if (err.message.includes('Product not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.includes('Analysis is not completed')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

export async function generateDocxReport(req, res, next) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: `Invalid product id: ${id}` });
  }

  try {
    const reportDto = await ReportService.getReportDto(id, req.user.userId);
    const docxBuffer = await ReportDocxGenerator.generate(reportDto);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="compliance_report_${reportDto.metadata.reportId}.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);
    
    return res.end(docxBuffer);
  } catch (err) {
    if (err.message.includes('Product not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.includes('Analysis is not completed')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    return next(err);
  }
}
