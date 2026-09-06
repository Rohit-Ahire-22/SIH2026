import multer from 'multer'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileFilter(_req, file, cb) {
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
}

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
})

export function uploadSingleProductImage(req, res, next) {
  productImageUpload.single('image')(req, res, (err) => {
    if (!err) {
      return next()
    }
    return handleUploadError(err, res)
  })
}

function handleUploadError(err, res) {
  if (err instanceof multer.MulterError) {
    let message
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded image exceeds the maximum allowed file size (5 MB).'
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Only one image file may be uploaded at a time.'
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field. Expected field name "image".'
    } else {
      message = err.message
    }
    return res.status(400).json({
      success: false,
      message,
      code: err.code,
    })
  }

  return res.status(err.status || 400).json({
    success: false,
    message: err.message || 'Upload failed',
    ...(err.code && { code: err.code }),
  })
}

export function toHumanSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
