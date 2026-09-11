import { Router } from 'express'
import {
  createComplaint,
  listComplaints,
  getComplaint,
  updateComplaintStatus,
  uploadComplaintAttachment,
  getComplaintReasons,
} from '../controllers/complaintController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import multer from 'multer'

const router = Router()

// Attachment upload multer — same restrictions as product images
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // 5MB

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error(
        `Unsupported file type "${file.mimetype}". Only JPEG, PNG and WEBP images are allowed.`,
      )
      err.status = 400
      err.code = 'UNSUPPORTED_FILE_TYPE'
      cb(err)
    }
  },
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
})

function handleAttachmentUpload(req, res, next) {
  attachmentUpload.single('attachment')(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(400)
        .json({ success: false, message: 'Attachment exceeds maximum allowed size (5 MB).', code: err.code })
    }
    return res
      .status(err.status || 400)
      .json({ success: false, message: err.message || 'Upload failed', code: err.code })
  })
}

// All complaint routes require authentication
router.use(authenticate)

// Utility
router.get('/reasons', getComplaintReasons)

// CRUD
router.post('/', createComplaint)
router.get('/', listComplaints)
router.get('/:id', getComplaint)
router.patch('/:id/status', updateComplaintStatus)

// Attachments
router.post('/:id/attachments', handleAttachmentUpload, uploadComplaintAttachment)

export default router
