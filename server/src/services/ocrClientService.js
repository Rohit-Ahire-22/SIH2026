import { config } from '../config/env.js'

const MIME_TO_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

const EXTENSION_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
}

export function isOcrServiceConfigured() {
  return Boolean(config.aiServiceUrl)
}

export function assertOcrServiceConfigured() {
  if (!isOcrServiceConfigured()) {
    const err = new Error(
      'OCR service is not configured. Set AI_SERVICE_URL to the OCR service base URL.',
    )
    err.status = 503
    err.code = 'OCR_NOT_CONFIGURED'
    throw err
  }
}

export async function runOcrOnImageUrl(imageUrl, mimeType) {
  assertOcrServiceConfigured()

  const resolvedMimeType = resolveMimeType(mimeType, imageUrl)
  const imageBuffer = await fetchRemoteImage(imageUrl)
  return runOcrOnImageBuffer(imageBuffer, resolvedMimeType)
}

export async function fetchRemoteImage(imageUrl) {
  let response
  try {
    response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(config.imageFetchTimeoutMs),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw buildOcrError(
        `Timed out fetching product image for OCR after ${config.imageFetchTimeoutMs} ms`,
        504,
        'OCR_IMAGE_FETCH_TIMEOUT',
      )
    }
    throw buildOcrError(
      `Failed to fetch product image for OCR: ${err.message}`,
      502,
      'OCR_IMAGE_FETCH_FAILED',
    )
  }

  if (!response.ok) {
    throw buildOcrError(
      `Failed to fetch product image for OCR (status ${response.status})`,
      502,
      'OCR_IMAGE_FETCH_FAILED',
    )
  }

  return Buffer.from(await response.arrayBuffer())
}

export async function runOcrOnImageBuffer(imageBuffer, mimeType, variant = 'original') {
  assertOcrServiceConfigured()

  const filename = buildFilename(mimeType)
  const form = new FormData()
  form.append('image', new Blob([imageBuffer], { type: mimeType }), filename)
  form.append('variant', variant)

  const endpoint = `${config.aiServiceUrl.replace(/\/+$/, '')}/ocr`

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      headers: {
        'X-AI-Service-Key': process.env.AI_SERVICE_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'SIH-Backend-Client/1.0'
      },
      signal: AbortSignal.timeout(config.ocrServiceTimeoutMs),
    })
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw buildOcrError(
        `OCR service timed out after ${config.ocrServiceTimeoutMs} ms`,
        504,
        'OCR_SERVICE_TIMEOUT',
      )
    }
    throw buildOcrError(
      `OCR service is unavailable: ${err.message}`,
      502,
      'OCR_SERVICE_UNAVAILABLE',
    )
  }

  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  
  // SAFE DIAGNOSTIC LOGGING (NO CREDENTIALS)
  console.log('[DEBUG OCR] POST', endpoint)
  console.log('[DEBUG OCR] Status:', response.status)
  console.log('[DEBUG OCR] Content-Type:', contentType)
  console.log('[DEBUG OCR] Body preview:', text.substring(0, 200).replace(/\n/g, ' '))

  let payload
  try {
    if (!contentType.includes('application/json')) {
      throw new Error(`Invalid Content-Type: ${contentType}`)
    }
    payload = JSON.parse(text)
  } catch (err) {
    console.error('[DEBUG OCR] JSON parse failed:', err.message)
    const preview = text ? text.substring(0, 100).replace(/\n/g, ' ') : 'empty response'
    throw buildOcrError(
      `OCR service returned a non-JSON response (Status ${response.status}): ${preview}`,
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && typeof payload.detail === 'string'
        ? payload.detail
        : `status ${response.status}`
    throw buildOcrError(
      `OCR service returned an error (${detail})`,
      502,
      'OCR_SERVICE_ERROR',
    )
  }

  return normalizeOcrPayload(payload)
}

function normalizeOcrPayload(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.success !== true ||
    !Array.isArray(payload.results)
  ) {
    throw buildOcrError(
      'OCR service returned an unexpected response shape',
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }

  return payload.results.map(normalizeOcrResult)
}

function normalizeOcrResult(result, index) {
  if (!result || typeof result !== 'object') {
    throw buildOcrError(
      `OCR service returned an invalid result (index ${index})`,
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }

  const text = result.text
  const confidence = result.confidence
  const bbox = result.bbox

  if (typeof text !== 'string' || text.length === 0) {
    throw buildOcrError(
      `OCR result (index ${index}) is missing field "text"`,
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
    throw buildOcrError(
      `OCR result (index ${index}) is missing field "confidence"`,
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }
  if (!isValidBbox(bbox)) {
    throw buildOcrError(
      `OCR result (index ${index}) has an invalid "bbox"`,
      502,
      'OCR_MALFORMED_RESPONSE',
    )
  }

  return {
    text,
    confidence,
    bbox: bbox.map(([x, y]) => [Number(x), Number(y)]),
  }
}

function isValidBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false
  return bbox.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every((coord) => typeof coord === 'number' && Number.isFinite(coord)),
  )
}

function buildFilename(mimeType) {
  const ext = MIME_TO_EXTENSIONS[mimeType] || 'png'
  return `image.${ext}`
}

function resolveMimeType(mimeType, imageUrl) {
  if (mimeType) {
    return mimeType
  }

  const match = /\.([a-zA-Z0-9]+)(?:[?#].*)?$/.exec(imageUrl || '')
  const ext = match ? match[1].toLowerCase() : null
  return (ext && EXTENSION_TO_MIME[ext]) || 'image/png'
}

function buildOcrError(message, status, code) {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}