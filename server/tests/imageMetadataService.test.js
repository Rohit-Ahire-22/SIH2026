import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inferViewFromFilename, inferCategory } from '../src/services/imageMetadataService.js';

describe('View classification (filename inference)', () => {
  test('front variants classify as front', () => {
    for (const name of ['front', 'front.jpg', 'front.jpeg', 'front_view.JPG', 'front-panel.png', 'Front View.jpeg']) {
      const { view, viewSource } = inferViewFromFilename(name);
      assert.equal(view, 'front', `expected front for ${name}`);
      assert.equal(viewSource, 'filename_inference');
    }
  });

  test('back variants classify as back', () => {
    for (const name of ['back', 'back.jpg', 'back_view.jpeg', 'back-panel.png', 'Back View.jpg']) {
      const { view } = inferViewFromFilename(name);
      assert.equal(view, 'back', `expected back for ${name}`);
    }
  });

  test('declaration variants classify as declaration (not back)', () => {
    for (const name of ['declaration', 'declaration.jpg', 'declaration_panel.jpeg', 'declaration-panel.png', 'legal_panel.jpg', 'legal-panel.jpeg', 'label.png', 'label_panel.jpg', 'Legal Panel.jpg']) {
      const { view } = inferViewFromFilename(name);
      assert.equal(view, 'declaration', `expected declaration for ${name}`);
    }
  });

  test('ambiguous / unrecognized filenames classify as unknown', () => {
    for (const name of ['front_label.jpg', 'image_1.png', 'photo.jpeg', 'IMG_2034.jpg', 'product_001.jpg', 'side_view.png', 'front_back.jpg']) {
      const { view } = inferViewFromFilename(name);
      assert.equal(view, 'unknown', `expected unknown for ${name}`);
    }
  });

  test('paths are reduced to the basename', () => {
    assert.equal(inferViewFromFilename('raw/proprietary/product_001/back.jpeg').view, 'back');
    assert.equal(inferViewFromFilename('dataset\\raw\\proprietary\\p1\\front.png').view, 'front');
  });
});

describe('Category inference (conservative)', () => {
  test('folder keyword infers well-known category', () => {
    const r = inferCategory({ productFolder: 'spice_turmeric', fileName: 'front.jpg' });
    assert.equal(r.category, 'spice');
    assert.equal(r.categorySource, 'directory');
  });

  test('filename keyword can infer category with lower confidence', () => {
    const r = inferCategory({ productFolder: 'product_99', fileName: 'toothpaste_box.jpg' });
    assert.equal(r.category, 'oral_care');
    assert.equal(r.categorySource, 'filename');
  });

  test('ambiguous metadata resolves to unknown (no aggressive guessing)', () => {
    const r = inferCategory({ productFolder: 'product_12', fileName: 'front.jpg' });
    assert.equal(r.category, 'unknown');
    assert.equal(r.categorySource, 'unknown');
  });

  test('explicit metadata wins and is never fabricated', () => {
    const r = inferCategory({ productFolder: 'spice_turmeric', fileName: 'front.jpg', explicitMetadataCategory: 'beverage' });
    assert.equal(r.category, 'beverage');
    assert.equal(r.categorySource, 'explicit_metadata');
    assert.equal(r.categoryConfidence, 1.0);
  });

  test('invalid explicit metadata falls back to unknown', () => {
    const r = inferCategory({ productFolder: 'product_1', fileName: 'front.jpg', explicitMetadataCategory: 'not-a-real-category' });
    assert.equal(r.category, 'unknown');
  });
});