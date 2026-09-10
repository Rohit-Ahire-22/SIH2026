import fetch from 'node-fetch'
import FormData from 'form-data'
export class VisualDetectionClient {
  /**
   * Calls the AI service visual detection endpoint using a pre-downloaded image
   * buffer.  This is the preferred code path when the orchestrator already holds
   * the image bytes (e.g. after the OCR download) — it avoids a second Cloudinary
   * round-trip for the same URL.
   *
   * @param {Buffer} imageBuffer  Already-downloaded image bytes
   * @param {string} mimeType     MIME type (e.g. 'image/jpeg')
   * @returns {Promise<Object>}   The visual evidence contract
   */
  static async detectVisualElementsFromBuffer(imageBuffer, mimeType) {
    if (!process.env.AI_SERVICE_URL) {
      console.warn("Visual detection bypassed: AI_SERVICE_URL not configured")
      return {
        inferenceStatus: "UNAVAILABLE_URL_NOT_CONFIGURED",
        detector: "none",
        detections: []
      }
    }
    try {
      const form = new FormData()
      form.append('image', imageBuffer, {
        filename: 'inspection_image.' + (mimeType === 'image/jpeg' ? 'jpg' : (mimeType === 'image/png' ? 'png' : 'jpg')),
        contentType: mimeType || 'image/jpeg',
      })
      const aiRes = await fetch(`${process.env.AI_SERVICE_URL}/visual/detect`, {
        method: 'POST',
        headers: {
          'x-ai-service-key': process.env.AI_SERVICE_API_KEY || '',
          ...form.getHeaders()
        },
        body: form,
      })
      if (!aiRes.ok) {
        const errText = await aiRes.text()
        throw new Error(`AI Service visual detection failed: ${aiRes.status} ${errText}`)
      }
      const data = await aiRes.json()
      return data
    } catch (err) {
      console.error("VisualDetectionClient error:", err)
      return {
        inferenceStatus: "UNAVAILABLE_NETWORK_ERROR",
        error: err.message,
        detector: "none",
        detections: []
      }
    }
  }
  /**
   * Calls the AI service visual detection endpoint.
   * If the service fails or is unavailable, this throws an error.
   * It is the orchestrator's responsibility to catch it and degrade gracefully.
   *
   * Prefer `detectVisualElementsFromBuffer` when the image bytes are already
   * available — this method re-downloads the image from the URL.
   *
   * @param {string} imageUrl
   * @returns {Promise<Object>} The visual evidence contract
   */
  static async detectVisualElements(imageUrl) {
    if (!process.env.AI_SERVICE_URL) {
      console.warn("Visual detection bypassed: AI_SERVICE_URL not configured")
      return {
        inferenceStatus: "UNAVAILABLE_URL_NOT_CONFIGURED",
        detector: "none",
        detections: []
      }
    }
    try {
      // 1. Fetch image bytes from Cloudinary/URL
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.statusText}`)
      const buffer = await imgRes.buffer()
      // 2. Delegate to the buffer-based method
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      return this.detectVisualElementsFromBuffer(buffer, contentType)
    } catch (err) {
      console.error("VisualDetectionClient error:", err)
      // Return a safe failing state instead of crashing
      return {
        inferenceStatus: "UNAVAILABLE_NETWORK_ERROR",
        error: err.message,
        detector: "none",
        detections: []
      }
    }
  }
}
