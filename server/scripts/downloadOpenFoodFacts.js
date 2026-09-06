import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Default configuration
const config = {
  maxProducts: 2000,
  maxImages: 5000,
  countryFilter: 'india',
  outputDir: path.resolve(process.cwd(), '../dataset'),
  delayMs: 500,
  apiRetries: 3
}

// Parse basic CLI arguments (e.g. --max-products 20)
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--max-products' && i + 1 < process.argv.length) config.maxProducts = parseInt(process.argv[++i], 10)
  else if (arg === '--max-images' && i + 1 < process.argv.length) config.maxImages = parseInt(process.argv[++i], 10)
  else if (arg === '--country' && i + 1 < process.argv.length) config.countryFilter = process.argv[++i]
  else if (arg === '--out-dir' && i + 1 < process.argv.length) config.outputDir = path.resolve(process.argv[++i])
}

const DIRS = {
  raw: path.join(config.outputDir, 'raw', 'open-food-facts'),
  imported: path.join(config.outputDir, 'imported'),
  processed: path.join(config.outputDir, 'processed'),
  annotations: path.join(config.outputDir, 'annotations'),
  splits: path.join(config.outputDir, 'splits'),
  metadata: path.join(config.outputDir, 'metadata'),
  manifests: path.join(config.outputDir, 'manifests'),
  reports: path.join(config.outputDir, 'reports')
}

// Helper: Ensure directories exist
export function setupDirectories() {
  for (const dir of Object.values(DIRS)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

// Helper: Delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper: SHA-256
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// Helper: Validate image magic bytes
export function getExtensionFromMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null
  const hex = buffer.toString('hex', 0, 4).toUpperCase()
  if (hex.startsWith('FFD8FF')) return 'jpg'
  if (hex === '89504E47') return 'png'
  if (hex.startsWith('52494646') && buffer.toString('hex', 8, 12).toUpperCase() === '57454250') return 'webp'
  return null
}

export function extractAvailableProductImages(product) {
  const images = []
  const seenUrls = new Set()
  
  const addImage = (type, url, sourceField) => {
    if (url && !seenUrls.has(url)) {
      images.push({ type, url, sourceField })
      seenUrls.add(url)
    }
  }

  if (product.selected_images) {
    for (const [imgType, imgData] of Object.entries(product.selected_images)) {
      if (imgData.display && imgData.display.en) {
        addImage(imgType, imgData.display.en, `selected_images.${imgType}.display.en`)
      } else if (imgData.display) {
        const firstLang = Object.keys(imgData.display)[0]
        if (firstLang) {
          addImage(imgType, imgData.display[firstLang], `selected_images.${imgType}.display.${firstLang}`)
        }
      }
    }
  }

  const knownFields = ['front', 'back', 'ingredients', 'nutrition', 'packaging']
  for (const field of knownFields) {
    const urlField = `image_${field}_url`
    if (product[urlField]) {
      addImage(field, product[urlField], urlField)
    }
  }

  if (product.image_url) {
     addImage('unknown', product.image_url, 'image_url')
  }
  
  return images
}

export async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'SIH26034-Research-Downloader/1.0' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(1000 * attempt)
    }
  }
}

// Main processing
export async function downloadDataset(testMode = false, overrideConfig = null) {
  const cfg = overrideConfig || config
  setupDirectories()

  const stats = {
    requestedProductLimit: cfg.maxProducts,
    downloadedProductCount: 0,
    downloadedImageCount: 0,
    failedDownloadCount: 0,
    duplicateCount: 0,
    downloadDate: new Date().toISOString()
  }

  const seenHashes = new Set()
  const metadataLines = []
  
  let page = 1
  let totalImagesDownloaded = 0
  let totalProductsProcessed = 0

  console.log(`Starting download: maxProducts=${cfg.maxProducts}, maxImages=${cfg.maxImages}, country=${cfg.countryFilter}`)

  while (totalProductsProcessed < cfg.maxProducts && totalImagesDownloaded < cfg.maxImages) {
    const apiUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=&search_simple=1&action=process&json=1&countries_tags=${cfg.countryFilter}&page_size=50&page=${page}`
    
    console.log(`Fetching page ${page}: ${apiUrl}`)
    
    let data
    try {
      const response = await fetchWithRetry(apiUrl, cfg.apiRetries)
      data = await response.json()
    } catch (err) {
      console.error(`Failed to fetch page ${page}: ${err.message}`)
      break
    }

    if (!data.products || data.products.length === 0) break

    for (const product of data.products) {
      if (totalProductsProcessed >= cfg.maxProducts || totalImagesDownloaded >= cfg.maxImages) break

      const barcode = product.code || 'unknown'
      const imagesToFetch = extractAvailableProductImages(product)

      if (imagesToFetch.length === 0) continue

      let productHasSuccessfulImage = false

      for (const img of imagesToFetch) {
        if (totalImagesDownloaded >= cfg.maxImages) break

        await sleep(cfg.delayMs)
        
        try {
          const res = await fetchWithRetry(img.url, 2)
          const contentType = res.headers.get('content-type')
          if (!contentType || !contentType.startsWith('image/')) {
             stats.failedDownloadCount++
             continue
          }

          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          
          if (buffer.length === 0) {
            stats.failedDownloadCount++
            continue
          }

          const ext = getExtensionFromMagicBytes(buffer)
          if (!ext) {
            stats.failedDownloadCount++
            continue
          }

          const hash = sha256(buffer)
          if (seenHashes.has(hash)) {
            stats.duplicateCount++
            continue
          }
          seenHashes.add(hash)

          const originalFilename = img.url.split('/').pop() || `${barcode}_${img.type}.${ext}`
          const filename = `${barcode}_${img.type}_${hash.slice(0, 8)}.${ext}`
          const filepath = path.join(DIRS.raw, filename)
          
          if (fs.existsSync(filepath)) {
            stats.duplicateCount++
            continue
          }

          // Optional: Parse exact dimensions from API if available, else null
          let width = null, height = null
          if (product.images && product.images[img.type] && product.images[img.type].sizes && product.images[img.type].sizes['400']) {
              width = product.images[img.type].sizes['400'].w
              height = product.images[img.type].sizes['400'].h
          }

          if (!testMode) fs.writeFileSync(filepath, buffer)

          const meta = {
            barcode,
            productName: product.product_name || '',
            brand: product.brands || '',
            countryTags: product.countries_tags || [],
            imageUrl: img.url,
            imageType: img.type,
            imageSourceField: img.sourceField,
            sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
            sourceDataset: 'Open Food Facts',
            imageLicense: 'CC BY-SA 4.0',
            imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            dataLicense: 'ODbL 1.0',
            dataLicenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
            downloadTimestamp: new Date().toISOString(),
            originalFilename,
            contentType,
            width,
            height,
            sha256: hash
          }
          
          metadataLines.push(JSON.stringify(meta))
          
          totalImagesDownloaded++
          stats.downloadedImageCount++
          productHasSuccessfulImage = true

        } catch (err) {
          stats.failedDownloadCount++
          console.error(`Failed to download image ${img.url}: ${err.message}`)
        }
      }

      if (productHasSuccessfulImage) {
        totalProductsProcessed++
        stats.downloadedProductCount++
      }
    }
    page++
  }

  // Write Metadata JSONL
  const metaPath = path.join(DIRS.metadata, 'open-food-facts-products.jsonl')
  if (!testMode && metadataLines.length > 0) {
    fs.appendFileSync(metaPath, metadataLines.join('\n') + '\n')
  }

  // Write Manifest
  const manifest = {
    datasetId: 'open-food-facts-india',
    datasetName: 'Open Food Facts Indian Product Packaging Subset',
    source: 'Open Food Facts',
    sourceUrl: 'https://world.openfoodfacts.org',
    imageLicense: 'CC BY-SA 4.0',
    imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    dataLicense: 'ODbL 1.0',
    dataLicenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: 'Data from Open Food Facts contributors (CC BY-SA 4.0 / ODbL).',
    countryFilter: cfg.countryFilter,
    ...stats,
    limitations: 'Images are for visual evidence only and represent CC BY-SA contributions, potentially including third-party brand graphics.'
  }

  const manifestPath = path.join(DIRS.manifests, `open-food-facts-manifest-${Date.now()}.json`)
  if (!testMode) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  }

  console.log(`Download complete! Products: ${stats.downloadedProductCount}, Images: ${stats.downloadedImageCount}, Failed: ${stats.failedDownloadCount}, Duplicates: ${stats.duplicateCount}`)
  return manifest
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('downloadOpenFoodFacts.js')) {
  downloadDataset().catch(console.error)
}
