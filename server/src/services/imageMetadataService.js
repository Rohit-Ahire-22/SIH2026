// Conservative, deterministic metadata inference helpers.
// These are INFERENCE, not ground truth: every result carries a provenance field.

export const CATEGORIES = [
  'food',
  'beverage',
  'snack',
  'staples',
  'spice',
  'dairy',
  'personal_care',
  'oral_care',
  'household',
  'cleaning',
  'cosmetic',
  'pharmaceutical',
  'electronics',
  'agricultural',
  'other',
  'unknown'
];

const VIEW_PATTERNS = {
  front: [/(^|_)front($|_)/],
  back: [/(^|_)back($|_)/],
  declaration: [
    /(^|_)declaration($|_)/,
    /(^|_)legal($|_)/,
    /(^|_)label($|_)/
  ]
};

/**
 * Infers the panel view from a filename/path.
 *
 * Recognizes, after normalization: front(_view|_panel),
 * back(_view|_panel), declaration(_panel), legal(_panel), label(_panel).
 *
 * Ambiguous filenames resolve to 'unknown'; nothing is guessed aggressively.
 *
 * @param {string} filename
 * @returns {{view: 'front'|'back'|'declaration'|'unknown', viewSource: string}}
 */
export function inferViewFromFilename(filename) {
  const base = String(filename)
    .split(/[\\/]/)
    .pop()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase();
  const normalized = base.replace(/[^a-z0-9]+/g, '_');

  const matched = new Set();
  for (const [view, patterns] of Object.entries(VIEW_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        matched.add(view);
        break;
      }
    }
  }

  if (matched.size === 1) {
    return { view: matched.values().next().value, viewSource: 'filename_inference' };
  }
  return { view: 'unknown', viewSource: 'filename_inference' };
}

// Odered keyword rules. More specific categories are checked before generic ones.
const CATEGORY_RULES = [
  ['staples', ['staple', 'staples', 'rice', 'atta', 'aata', 'flour', 'wheat', 'gram', 'dal', 'lentil', 'pulses']],
  ['spice', ['spice', 'spices', 'masala', 'turmeric', 'cumin', 'chilli', 'chili', 'curry', 'coriander']],
  ['dairy', ['dairy', 'milk', 'paneer', 'butter', 'ghee', 'curd', 'yogurt', 'yoghurt', 'cheese']],
  ['beverage', ['beverage', 'beverages', 'drink', 'juice', 'cola', 'soda', 'softdrink', 'water']],
  ['snack', ['snack', 'snacks', 'chips', 'biscuit', 'biscuits', 'cookie', 'cookies', 'namkeen', 'namkin', 'wafers']],
  ['personal_care', ['personal_care', 'personalcare', 'soap', 'shampoo', 'lotion', 'bodywash', 'body_wash', 'deodorant', 'conditioner', 'facewash']],
  ['oral_care', ['oral_care', 'oralcare', 'toothpaste', 'toothbrush', 'mouthwash', 'dental']],
  ['cosmetic', ['cosmetic', 'cosmetics', 'makeup', 'lipstick', 'foundation', 'kajal', 'cream', 'lotion_bar']],
  ['household', ['household', 'homecare', 'home_care', 'home']],
  ['cleaning', ['cleaning', 'detergent', 'dishwash', 'cleaner', 'floor_cleaner', 'wipe', 'bleach']],
  ['pharmaceutical', ['pharmaceutical', 'pharma', 'medicine', 'tablet', 'syrup', 'capsule', 'ointment', 'ayurvedic', 'ayurveda']],
  ['electronics', ['electronics', 'electronic', 'battery', 'bulb', 'charger', 'cable']],
  ['agricultural', ['agricultural', 'agriculture', 'fertilizer', 'fertiliser', 'pesticide', 'insecticide', 'seed']],
  ['food', ['food', 'edible', 'noodle', 'noodles', 'pasta', 'sauce', 'pickle', 'honey', 'jam', 'soup', 'oat']]
];

function matcher(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|_)${escaped}($|_)`);
}

/**
 * Conservative category inference from product-folder / filename tokens.
 *
 * @param {object} options
 * @param {string} [options.productFolder]  e.g. 'spice_turmeric' or 'product_001'
 * @param {string} [options.fileName]       e.g. 'front.jpg'
 * @param {string} [options.explicitMetadataCategory] trusted category value, wins if provided
 * @returns {{category: string, categorySource: string, categoryConfidence?: number}}
 */
export function inferCategory({ productFolder = '', fileName = '', explicitMetadataCategory } = {}) {
  if (explicitMetadataCategory) {
    if (!CATEGORIES.includes(explicitMetadataCategory)) {
      return { category: 'unknown', categorySource: 'unknown' };
    }
    return {
      category: explicitMetadataCategory,
      categorySource: 'explicit_metadata',
      categoryConfidence: 1.0
    };
  }

  const folderTokens = String(productFolder).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const fileTokens = String(fileName).toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const hits = [];
  for (const [category, keywords] of CATEGORY_RULES) {
    let folderHits = 0;
    let fileHits = 0;
    for (const keyword of keywords) {
      if (matcher(keyword).test(folderTokens)) folderHits++;
      if (matcher(keyword).test(fileTokens)) fileHits++;
    }
    if (folderHits > 0 || fileHits > 0) {
      hits.push({ category, folderHits, fileHits, total: folderHits + fileHits });
    }
  }

  if (hits.length === 0) {
    return { category: 'unknown', categorySource: 'unknown' };
  }

  // Ties between categories are ambiguous: stay conservative.
  const best = hits.reduce((a, b) => (b.total > a.total ? b : a));
  const ties = hits.filter((h) => h.total === best.total);
  if (ties.length > 1) {
    return { category: 'unknown', categorySource: 'unknown' };
  }

  const category = best.category;
  const categorySource = best.folderHits >= best.fileHits ? 'directory' : 'filename';

  // Confidence is only recorded when there is a genuinely clean signal, never fabricated.
  let categoryConfidence;
  if (best.folderHits > 0 && best.fileHits === 0) {
    categoryConfidence = 0.85;
  } else if (best.fileHits > 0 && best.folderHits === 0) {
    categoryConfidence = 0.6;
  }

  return {
    category,
    categorySource,
    ...(categoryConfidence !== undefined ? { categoryConfidence } : {})
  };
}