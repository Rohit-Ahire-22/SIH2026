import { extractAvailableProductImages, getExtensionFromMagicBytes } from '../scripts/experimentStep21.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Step 21 Dataset Experiment Logic', () => {
  it('extractAvailableProductImages correctly identifies multiple views and preserves language', () => {
    const product = {
      code: '8901234567890',
      selected_images: {
        front: { display: { en: 'http://example.com/front_en.jpg' } },
        ingredients: { display: { hi: 'http://example.com/ing_hi.jpg' } }
      },
      image_nutrition_url: 'http://example.com/nut.jpg',
      image_packaging_url: 'http://example.com/pkg.jpg',
      image_back_url: 'http://example.com/back.jpg'
    }

    const images = extractAvailableProductImages(product)
    
    assert.strictEqual(images.length, 5)
    assert.strictEqual(images.find(i => i.type === 'front').lang, 'en')
    assert.strictEqual(images.find(i => i.type === 'ingredients').lang, 'hi')
    assert.strictEqual(images.find(i => i.type === 'nutrition').lang, 'unknown')
  })

  it('extractAvailableProductImages prevents duplicate URLs', () => {
    const product = {
      selected_images: {
        front: { display: { en: 'http://example.com/same.jpg' } }
      },
      image_front_url: 'http://example.com/same.jpg' // Same URL
    }
    const images = extractAvailableProductImages(product)
    assert.strictEqual(images.length, 1)
  })

  it('getExtensionFromMagicBytes correctly identifies jpeg and png', () => {
    const jpgBytes = Buffer.from('FFD8FFE000104A46494600', 'hex')
    const pngBytes = Buffer.from('89504E470D0A1A0A000000', 'hex')
    const webpBytes = Buffer.from('524946460000000057454250', 'hex')
    
    assert.strictEqual(getExtensionFromMagicBytes(jpgBytes), 'jpg')
    assert.strictEqual(getExtensionFromMagicBytes(pngBytes), 'png')
    assert.strictEqual(getExtensionFromMagicBytes(webpBytes), 'webp')
    assert.strictEqual(getExtensionFromMagicBytes(Buffer.from('00000000', 'hex')), null)
  })
})
