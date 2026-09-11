import { config } from '../config/env.js'

/**
 * Nutrition Extraction Service
 *
 * IMPORTANT: This is a SEPARATE module from the compliance OCR pipeline.
 * It does NOT call hybridOcrService, ocrFieldExtractionService, or any
 * compliance-analysis service.
 *
 * It calls the PaddleOCR AI service directly via its raw OCR endpoint,
 * then applies nutrition-specific regex extraction.
 *
 * Unknown values remain null — no values are invented.
 */

// ─── Nutrient field definitions ────────────────────────────────────────────────
// Each entry: { name, aliases[], unit (default) }
const NUTRIENT_DEFINITIONS = [
  { name: 'Energy', aliases: ['energy', 'calories', 'calorie', 'kcal', 'kj', 'cal'], unit: 'kcal' },
  { name: 'Protein', aliases: ['protein', 'proteins'], unit: 'g' },
  { name: 'Total Fat', aliases: ['total fat', 'fat', 'fats', 'lipid'], unit: 'g' },
  { name: 'Saturated Fat', aliases: ['saturated fat', 'saturated fatty acid', 'saturates', 'sat fat'], unit: 'g' },
  { name: 'Trans Fat', aliases: ['trans fat', 'trans fatty acid', 'trans-fat'], unit: 'g' },
  { name: 'Carbohydrates', aliases: ['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate'], unit: 'g' },
  { name: 'Total Sugars', aliases: ['sugar', 'sugars', 'total sugars', 'total sugar'], unit: 'g' },
  { name: 'Added Sugars', aliases: ['added sugar', 'added sugars'], unit: 'g' },
  { name: 'Dietary Fibre', aliases: ['dietary fibre', 'dietary fiber', 'fibre', 'fiber'], unit: 'g' },
  { name: 'Sodium', aliases: ['sodium', 'salt', 'na'], unit: 'mg' },
  { name: 'Serving Size', aliases: ['serving size', 'serve size', 'portion size', 'per serve'], unit: 'g' },
  { name: 'Servings Per Pack', aliases: ['servings per pack', 'servings per container', 'number of servings'], unit: '' },
]

// ─── Regex helpers ─────────────────────────────────────────────────────────────

const NUMERIC_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kcal|kj|g|mg|ml|%|mcg|μg|kg)?/i

/**
 * Attempts to extract a numeric value + unit for a nutrient from raw OCR text.
 * Searches for each alias in the text and extracts the number that follows.
 *
 * @param {string} text - Full raw OCR text
 * @param {object} definition - Nutrient definition
 * @returns {{ value: number|null, unit: string|null, confidence: number }}
 */
function extractNutrient(text, definition) {
  const lines = text.split(/[\n\r]+/)

  for (const alias of definition.aliases) {
    const aliasRegex = new RegExp(
      `(?:^|\\s|,)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]+`,
      'i',
    )

    for (const line of lines) {
      if (aliasRegex.test(line)) {
        const numMatch = line.match(NUMERIC_PATTERN)
        if (numMatch) {
          const value = parseFloat(numMatch[1].replace(',', '.'))
          const unit = numMatch[2] || definition.unit || null
          const confidence = 0.7 // Regex-based extraction confidence

          return { value: Number.isFinite(value) ? value : null, unit, confidence }
        }
      }
    }
  }

  return { value: null, unit: null, confidence: 0 }
}

/**
 * Calls the PaddleOCR AI service to extract raw text from an image URL.
 * Uses a direct call to the OCR service — NOT the compliance pipeline.
 *
 * @param {string} imageUrl - Public image URL to OCR
 * @returns {Promise<string>} Extracted raw text
 */
async function callOcrForNutrition(imageUrl) {
  const aiServiceUrl = config.aiServiceUrl
  const timeoutMs = 60000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${aiServiceUrl}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`OCR service returned ${response.status}`)
    }

    const data = await response.json()

    // Extract raw text from OCR results (array of {text, confidence, bbox})
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((r) => r.text || '').join('\n')
    }
    if (data.text) return data.text
    if (typeof data === 'string') return data

    return ''
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Nutrition OCR timed out')
    }
    throw err
  }
}

/**
 * Extracts nutrition information from raw text using regex patterns.
 * Returns structured nutrient data — unknown values remain null.
 *
 * @param {string} rawText
 * @returns {{ nutrients: Array, extractionStatus: string }}
 */
function parseNutritionText(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    return { nutrients: [], extractionStatus: 'FAILED' }
  }

  const nutrients = []
  let extractedCount = 0

  for (const definition of NUTRIENT_DEFINITIONS) {
    const result = extractNutrient(rawText, definition)
    nutrients.push({
      name: definition.name,
      value: result.value,
      unit: result.value !== null ? result.unit : null,
      confidence: result.confidence,
    })
    if (result.value !== null) extractedCount++
  }

  const extractionStatus =
    extractedCount === 0
      ? 'FAILED'
      : extractedCount < NUTRIENT_DEFINITIONS.length / 2
      ? 'PARTIAL'
      : 'EXTRACTED'

  return { nutrients, extractionStatus }
}

/**
 * Main extraction entry point.
 * Calls OCR on the image, then parses nutrition data.
 * Does NOT modify or call the compliance pipeline.
 *
 * @param {string} imageUrl - Cloudinary URL of the uploaded nutrition label image
 * @returns {Promise<{ rawText: string, nutrients: Array, extractionStatus: string }>}
 */
export async function extractNutritionFromImage(imageUrl) {
  let rawText = ''
  try {
    rawText = await callOcrForNutrition(imageUrl)
  } catch (err) {
    console.warn('[NutritionExtraction] OCR unavailable:', err.message)
    // If OCR is unavailable, return empty result — do not fail hard
    return {
      rawText: '',
      nutrients: NUTRIENT_DEFINITIONS.map((d) => ({
        name: d.name,
        value: null,
        unit: null,
        confidence: 0,
      })),
      extractionStatus: 'FAILED',
    }
  }

  const parsed = parseNutritionText(rawText)

  return {
    rawText,
    ...parsed,
  }
}

/**
 * Compare two sets of nutrients side by side.
 * Returns neutral comparison — no medical/health claims.
 *
 * @param {Array} nutrientsA
 * @param {Array} nutrientsB
 * @returns {Array} Comparison rows
 */
export function compareNutrients(nutrientsA, nutrientsB) {
  const mapA = new Map(nutrientsA.map((n) => [n.name, n]))
  const mapB = new Map(nutrientsB.map((n) => [n.name, n]))

  const allNames = new Set([...mapA.keys(), ...mapB.keys()])

  const rows = []
  for (const name of allNames) {
    const a = mapA.get(name)
    const b = mapB.get(name)

    rows.push({
      nutrient: name,
      productA: {
        value: a?.value ?? null,
        unit: a?.unit ?? null,
        confidence: a?.confidence ?? 0,
      },
      productB: {
        value: b?.value ?? null,
        unit: b?.unit ?? null,
        confidence: b?.confidence ?? 0,
      },
      // Neutral note — no medical/health claim
      note:
        a?.value != null && b?.value != null
          ? a.value < b.value
            ? 'Lower in Product A'
            : a.value > b.value
            ? 'Lower in Product B'
            : 'Equal'
          : 'Insufficient data for comparison',
    })
  }

  return rows
}
