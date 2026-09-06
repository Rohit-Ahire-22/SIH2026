import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Jimp } from 'jimp'

const config = {
  maxProductsToInspect: 200,
  maxOFFImages: 50,
  maxGSDImages: 15,
  countryFilter: 'india',
  outputDir: path.resolve(process.cwd(), '../dataset/raw/experiment-v1'),
  delayMs: 1000,
  apiRetries: 3,
  userAgent: 'SIH26034-Step21-Experiment/1.0 (legal@openfoodfacts.org)'
}

const DIRS = {
  off: path.join(config.outputDir, 'open-food-facts'),
  gsd: path.join(config.outputDir, 'grocerystore', 'shelf'),
  meta: path.join(config.outputDir, 'metadata')
}

// Setup Dirs
for (const dir of Object.values(DIRS)) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')

export function getExtensionFromMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null
  const hex = buffer.toString('hex', 0, 4).toUpperCase()
  if (hex.startsWith('FFD8FF')) return 'jpg'
  if (hex === '89504E47') return 'png'
  if (hex.startsWith('52494646') && buffer.toString('hex', 8, 12).toUpperCase() === '57454250') return 'webp'
  return null
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(url, { headers: { 'User-Agent': config.userAgent }, signal: controller.signal })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(1000 * attempt)
    }
  }
}

export function extractAvailableProductImages(product) {
  const images = []
  const seenUrls = new Set()
  
  const addImage = (type, url, sourceField, lang) => {
    if (url && !seenUrls.has(url)) {
      images.push({ type, url, sourceField, lang })
      seenUrls.add(url)
    }
  }

  if (product.selected_images) {
    for (const [imgType, imgData] of Object.entries(product.selected_images)) {
      if (imgData.display && imgData.display.en) {
        addImage(imgType, imgData.display.en, `selected_images.${imgType}.display.en`, 'en')
      } else if (imgData.display) {
        const firstLang = Object.keys(imgData.display)[0]
        if (firstLang) {
          addImage(imgType, imgData.display[firstLang], `selected_images.${imgType}.display.${firstLang}`, firstLang)
        }
      }
    }
  }

  const knownFields = ['front', 'back', 'ingredients', 'nutrition', 'packaging']
  for (const field of knownFields) {
    const urlField = `image_${field}_url`
    if (product[urlField]) {
      addImage(field, product[urlField], urlField, 'unknown')
    }
  }
  
  return images
}

function scoreImage(img, product) {
  let score = 0
  if (img.type === 'back') score += 5
  if (img.type === 'ingredients') score += 5
  if (img.type === 'nutrition') score += 5
  if (img.type === 'packaging') score += 4
  if (img.type === 'front') score += 3
  
  if (img.lang === 'en') score += 2
  
  let w = null, h = null
  if (product.images && product.images[img.type] && product.images[img.type].sizes && product.images[img.type].sizes['400']) {
      w = product.images[img.type].sizes['400'].w
      h = product.images[img.type].sizes['400'].h
  }
  if (w && h && w * h > 300000) {
      score += 2 // High res
  }
  
  const availableTypes = new Set(extractAvailableProductImages(product).map(i => i.type))
  if (availableTypes.size > 1) {
      score += 2 // Multi-view product
  }
  
  return score
}

export async function runExperiment() {
  const metadataLines = []
  const report = {
    productsInspected: 0,
    offImagesDownloaded: 0,
    gsdImagesDownloaded: 0,
    imageTypes: { front: 0, back: 0, ingredients: 0, nutrition: 0, packaging: 0, other: 0, shelf: 0 },
    duplicates: 0,
    highRes: 0,
    resolutions: { '<0.3 MP': 0, '0.3-1 MP': 0, '1-2 MP': 0, '2-5 MP': 0, '>5 MP': 0 },
    multiView: { '1': 0, '2': 0, '3': 0, '4+': 0 }
  }

  const seenHashes = new Set()
  let page = 1
  let allCandidateImages = []

  console.log('--- Phase 1: Inspect OFF Products ---')
  while (report.productsInspected < config.maxProductsToInspect) {
    const apiUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=&search_simple=1&action=process&json=1&countries_tags=${config.countryFilter}&page_size=50&page=${page}`
    console.log(`Fetching OFF page ${page}...`)
    
    let data
    try {
      const response = await fetchWithRetry(apiUrl)
      data = await response.json()
    } catch (err) {
      console.error(`Failed to fetch page ${page}:`, err)
      break
    }

    if (!data.products || data.products.length === 0) break

    for (const product of data.products) {
      if (report.productsInspected >= config.maxProductsToInspect) break
      report.productsInspected++

      const images = extractAvailableProductImages(product)
      const typesCount = new Set(images.map(i => i.type)).size
      if (typesCount === 1) report.multiView['1']++
      else if (typesCount === 2) report.multiView['2']++
      else if (typesCount === 3) report.multiView['3']++
      else if (typesCount >= 4) report.multiView['4+']++

      for (const img of images) {
        img.score = scoreImage(img, product)
        img.product = {
          barcode: product.code || 'unknown',
          productName: product.product_name || '',
          brand: product.brands || '',
        }
        allCandidateImages.push(img)
      }
    }
    page++
    await sleep(config.delayMs)
  }

  // Sort candidates by score descending
  allCandidateImages.sort((a, b) => b.score - a.score)
  
  console.log(`--- Phase 2: Download OFF Images (Max ${config.maxOFFImages}) ---`)
  for (const img of allCandidateImages) {
    if (report.offImagesDownloaded >= config.maxOFFImages) break

    await sleep(config.delayMs)
    let buffer, ext, hash
    try {
      const res = await fetchWithRetry(img.url, 2)
      const arrayBuffer = await res.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      ext = getExtensionFromMagicBytes(buffer)
      if (!ext) continue
      
      hash = sha256(buffer)
      if (seenHashes.has(hash)) {
        report.duplicates++
        continue
      }
      seenHashes.add(hash)
    } catch(e) {
      continue
    }

    // Determine dimensions via Jimp
    let width = 0, height = 0
    try {
      const image = await Jimp.read(buffer)
      width = image.bitmap.width
      height = image.bitmap.height
    } catch(e) {}
    
    const mp = (width * height) / 1000000
    if (mp < 0.3) report.resolutions['<0.3 MP']++
    else if (mp <= 1) report.resolutions['0.3-1 MP']++
    else if (mp <= 2) report.resolutions['1-2 MP']++
    else if (mp <= 5) report.resolutions['2-5 MP']++
    else report.resolutions['>5 MP']++
    
    if (mp >= 1.0) report.highRes++

    const filename = `${img.product.barcode}_${img.type}_${hash.slice(0,8)}.${ext}`
    const filepath = path.join(DIRS.off, filename)
    fs.writeFileSync(filepath, buffer)

    const meta = {
      datasetSource: 'Open Food Facts',
      sourceDataset: 'world',
      sourceRecordId: img.product.barcode,
      sourceImageId: hash.slice(0, 16),
      productGroupId: `OFF_${img.product.barcode}`,
      barcode: img.product.barcode,
      productName: img.product.productName,
      brand: img.product.brand,
      imageType: img.type,
      imageSourceField: img.sourceField,
      language: img.lang,
      sourceUrl: img.url,
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      downloadTimestamp: new Date().toISOString(),
      originalFilename: img.url.split('/').pop(),
      contentType: `image/${ext}`,
      width,
      height,
      sha256: hash
    }
    metadataLines.push(JSON.stringify(meta))
    
    report.offImagesDownloaded++
    if (report.imageTypes[img.type] !== undefined) {
       report.imageTypes[img.type]++
    } else {
       report.imageTypes['other']++
    }
    console.log(`[OFF] Downloaded ${report.offImagesDownloaded}/${config.maxOFFImages} (${img.type})`)
  }

  console.log(`--- Phase 3: Download GroceryStoreDataset (Max ${config.maxGSDImages}) ---`)
  // Hardcoding a diverse sampling from marcusklasson/GroceryStoreDataset (train set)
  const gsdSamples = [
    'Fruit/Apple/Golden-Delicious/Golden-Delicious_001.jpg',
    'Fruit/Apple/Granny-Smith/Granny-Smith_001.jpg',
    'Fruit/Banana/Banana_001.jpg',
    'Fruit/Lemon/Lemon_001.jpg',
    'Packages/Juice/Godmorgon-Orange-Juice/Godmorgon-Orange-Juice_001.jpg',
    'Packages/Milk/Arla-Standard-Milk/Arla-Standard-Milk_001.jpg',
    'Packages/Milk/Arla-Standard-Milk/Arla-Standard-Milk_010.jpg',
    'Packages/Oat-Milk/Oatly-Oat-Milk/Oatly-Oat-Milk_001.jpg',
    'Packages/Yoghurt/Arla-Ecological-Mild-Plain-Yoghurt/Arla-Ecological-Mild-Plain-Yoghurt_001.jpg',
    'Packages/Sour-Cream/Arla-Sour-Cream/Arla-Sour-Cream_001.jpg',
    'Vegetables/Cucumber/Cucumber_001.jpg',
    'Vegetables/Pepper/Green-Pepper/Green-Pepper_001.jpg',
    'Vegetables/Tomato/Tomato_001.jpg',
    'Packages/Juice/Brav-Orange-Juice/Brav-Orange-Juice_001.jpg',
    'Packages/Milk/Garant-Standard-Milk/Garant-Standard-Milk_001.jpg',
    'Packages/Yoghurt/Yoggi-Vanilla-Yoghurt/Yoggi-Vanilla-Yoghurt_001.jpg',
    'Packages/Sour-Cream/Garant-Sour-Cream/Garant-Sour-Cream_001.jpg',
    'Fruit/Apple/Royal-Gala/Royal-Gala_001.jpg',
    'Fruit/Apple/Pink-Lady/Pink-Lady_001.jpg',
    'Fruit/Avocado/Avocado_001.jpg',
    'Fruit/Kiwi/Kiwi_001.jpg',
    'Fruit/Mango/Mango_001.jpg',
    'Fruit/Melon/Cantaloupe/Cantaloupe_001.jpg',
    'Fruit/Melon/Watermelon/Watermelon_001.jpg',
    'Fruit/Nectarine/Nectarine_001.jpg',
    'Fruit/Orange/Orange_001.jpg',
    'Fruit/Papaya/Papaya_001.jpg',
    'Fruit/Passion-Fruit/Passion-Fruit_001.jpg',
    'Fruit/Peach/Peach_001.jpg',
    'Fruit/Pear/Anjou/Anjou_001.jpg'
  ]

  const gsdBase = 'https://raw.githubusercontent.com/marcusklasson/GroceryStoreDataset/master/dataset/train/'

  for (let i = 0; i < Math.min(config.maxGSDImages, gsdSamples.length); i++) {
    const relPath = gsdSamples[i]
    const url = gsdBase + relPath
    await sleep(200)
    try {
      const res = await fetchWithRetry(url, 1)
      if (!res) continue
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const hash = sha256(buffer)
      
      if (seenHashes.has(hash)) {
        report.duplicates++
        continue
      }
      seenHashes.add(hash)

      let width = 0, height = 0
      try {
        const image = await Jimp.read(buffer)
        width = image.bitmap.width
        height = image.bitmap.height
      } catch(e) {}
      
      const mp = (width * height) / 1000000
      if (mp < 0.3) report.resolutions['<0.3 MP']++
      else if (mp <= 1) report.resolutions['0.3-1 MP']++
      else if (mp <= 2) report.resolutions['1-2 MP']++
      else if (mp <= 5) report.resolutions['2-5 MP']++
      else report.resolutions['>5 MP']++
      if (mp >= 1.0) report.highRes++

      const filename = `gsd_${hash.slice(0,8)}.jpg`
      const filepath = path.join(DIRS.gsd, filename)
      fs.writeFileSync(filepath, buffer)

      const meta = {
        datasetSource: 'GroceryStoreDataset',
        sourceDataset: 'train',
        sourceRecordId: relPath,
        sourceImageId: hash.slice(0, 16),
        productGroupId: `GSD_${hash.slice(0, 8)}`,
        barcode: null,
        productName: relPath,
        brand: null,
        imageType: 'shelf',
        imageSourceField: null,
        language: null,
        sourceUrl: url,
        license: 'MIT License',
        licenseUrl: 'https://github.com/marcusklasson/GroceryStoreDataset/blob/master/LICENSE',
        downloadTimestamp: new Date().toISOString(),
        originalFilename: relPath.split('/').pop(),
        contentType: `image/jpg`,
        width,
        height,
        sha256: hash
      }
      metadataLines.push(JSON.stringify(meta))
      report.gsdImagesDownloaded++
      report.imageTypes['shelf']++
      console.log(`[GSD] Downloaded ${report.gsdImagesDownloaded}/${config.maxGSDImages} (shelf)`)
    } catch(e) {
       console.error("GSD Fetch Error:", e.message)
    }
  }

  fs.writeFileSync(path.join(DIRS.meta, 'experiment-v1.jsonl'), metadataLines.join('\n') + '\n')
  fs.writeFileSync(path.join(DIRS.meta, 'experiment-v1-report.json'), JSON.stringify(report, null, 2))
  
  console.log('Experiment Complete!')
  console.log(report)
  return report
}

if (process.argv[1] && process.argv[1].endsWith('experimentStep21.js')) {
    runExperiment()
}
