import { v2 as cloudinary } from 'cloudinary'
import { config } from '../config/env.js'

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

export function isCloudinaryConfigured() {
  return Boolean(
    config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret,
  )
}

export function assertCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    const err = new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    )
    err.status = 503
    err.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw err
  }
}

export async function uploadProductImageToCloudinary(buffer, originalFilename) {
  assertCloudinaryConfigured()

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'sih26034/products',
          resource_type: 'image',
          public_id: buildPublicId(originalFilename),
          overwrite: false,
        },
        (error, resultData) => {
          if (error) {
            reject(error)
            return
          }
          resolve(resultData)
        },
      )
      stream.end(buffer)
    })

    return {
      url: result.secure_url,
      publicId: result.public_id,
    }
  } catch (err) {
    const wrapped = new Error(
      `Failed to upload image to Cloudinary: ${err.message}`,
    )
    wrapped.status = 502
    wrapped.code = 'CLOUDINARY_UPLOAD_FAILED'
    throw wrapped
  }
}

function buildPublicId(originalFilename) {
  const timestamp = Date.now()
  if (!originalFilename) return `${timestamp}`
  const stem = originalFilename.replace(/\.[^.]+$/, '')
  const safe = stem.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
  return safe ? `${safe}-${timestamp}` : `${timestamp}`
}
