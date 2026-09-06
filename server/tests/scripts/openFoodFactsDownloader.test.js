import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { downloadDataset, getExtensionFromMagicBytes, extractAvailableProductImages } from '../../scripts/downloadOpenFoodFacts.js'

describe('Open Food Facts Downloader Validation', () => {
  describe('Image Extraction Logic', () => {
    test('1. front only', () => {
      const product = { selected_images: { front: { display: { en: 'front.jpg' } } } }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 1)
      assert.equal(images[0].type, 'front')
      assert.equal(images[0].url, 'front.jpg')
    })

    test('2. front + back', () => {
      const product = { selected_images: { front: { display: { en: 'front.jpg' } }, back: { display: { en: 'back.jpg' } } } }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 2)
      assert.ok(images.find(img => img.type === 'front'))
      assert.ok(images.find(img => img.type === 'back'))
    })

    test('3. front + ingredients + nutrition', () => {
      const product = { image_front_url: 'front.jpg', image_ingredients_url: 'ing.jpg', image_nutrition_url: 'nut.jpg' }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 3)
      assert.ok(images.find(img => img.type === 'front'))
      assert.ok(images.find(img => img.type === 'ingredients'))
      assert.ok(images.find(img => img.type === 'nutrition'))
    })

    test('4. multiple URLs pointing to the same image', () => {
      const product = { 
        selected_images: { front: { display: { en: 'dup.jpg' } } },
        image_front_url: 'dup.jpg'
      }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 1, 'Should deduplicate by URL')
    })

    test('5. missing image metadata', () => {
      const images = extractAvailableProductImages({})
      assert.equal(images.length, 0)
    })

    test('6. unknown image type via fallback', () => {
      const product = { image_url: 'unknown.jpg' }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 1)
      assert.equal(images[0].type, 'unknown')
    })

    test('7. malformed image URL in selected_images', () => {
      const product = { selected_images: { front: { display: {} } } }
      const images = extractAvailableProductImages(product)
      assert.equal(images.length, 0)
    })
  })
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('1. Validates image magic bytes correctly', () => {
    const jpegBuffer = Buffer.from('FFD8FFE000104A46', 'hex')
    const pngBuffer = Buffer.from('89504E470D0A1A0A', 'hex')
    const webpBuffer = Buffer.from('524946460000000057454250', 'hex')
    const badBuffer = Buffer.from('00000000', 'hex')

    assert.equal(getExtensionFromMagicBytes(jpegBuffer), 'jpg')
    assert.equal(getExtensionFromMagicBytes(pngBuffer), 'png')
    assert.equal(getExtensionFromMagicBytes(webpBuffer), 'webp')
    assert.equal(getExtensionFromMagicBytes(badBuffer), null)
  })

  test('2. Processes JSON API and handles simulated downloads', async () => {
    const mockApiResponse = {
      products: [
        {
          code: '123456789',
          product_name: 'Test Product',
          brands: 'Test Brand',
          countries_tags: ['en:india'],
          selected_images: {
            front: { display: { en: 'https://example.com/front.jpg' } }
          }
        },
        {
           code: '987654321',
           image_url: 'https://example.com/fallback.jpg'
        }
      ]
    }

    const mockJpegBuffer = Buffer.from('FFD8FFE000104A46', 'hex')

    let fetchCalls = 0
    global.fetch = async (url) => {
      fetchCalls++
      if (url.includes('search.pl')) {
        return {
          ok: true,
          json: async () => {
             if (url.includes('page=2') || url.includes('page=3')) {
               return { products: [] }
             }
             return mockApiResponse
          }
        }
      }
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => mockJpegBuffer.buffer.slice(mockJpegBuffer.byteOffset, mockJpegBuffer.byteOffset + mockJpegBuffer.byteLength)
      }
    }

    const testConfig = {
      maxProducts: 2,
      maxImages: 10,
      countryFilter: 'india',
      outputDir: path.resolve(process.cwd(), '../dataset_test'),
      delayMs: 0,
      apiRetries: 1
    }

    // Run in testMode to avoid writing actual files to disk
    const manifest = await downloadDataset(true, testConfig)

    assert.equal(manifest.datasetId, 'open-food-facts-india')
    assert.equal(manifest.downloadedProductCount, 1, 'Should process 1 product (2nd has only a duplicate image)')
    assert.equal(manifest.downloadedImageCount, 1, 'Should download 1 unique image (2nd is duplicate hash)')
    assert.equal(manifest.duplicateCount, 1, 'Should detect duplicate image hash')
    
    // We should have 2 API calls (page 1 and page 2) and 2 Image fetch calls
    assert.equal(fetchCalls, 4)
  })
})
