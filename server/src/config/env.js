import 'dotenv/config'

const requiredInProduction = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLIENT_ORIGIN',
  'AI_SERVICE_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

if (process.env.NODE_ENV === 'production') {
  const missing = requiredInProduction.filter(key => {
    const val = process.env[key];
    return !val || val.includes('<your-') || val.includes('change-me');
  });

  if (missing.length > 0) {
    console.error(`[CRITICAL] Missing or placeholder environment variables in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001',
  aiChat: {
    provider: process.env.AI_CHAT_PROVIDER || '',
    model: process.env.AI_CHAT_MODEL || '',
    apiKey: process.env.AI_CHAT_API_KEY || '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  ocrServiceTimeoutMs: Number(process.env.OCR_SERVICE_TIMEOUT_MS) || 120000,
  imageFetchTimeoutMs: Number(process.env.OCR_IMAGE_FETCH_TIMEOUT_MS) || 20000,
}
