import mongoose from 'mongoose'
import { config } from './env.js'

const MONGOOSE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

export async function connectDatabase() {
  if (!config.mongoUri) {
    console.warn(
      '[database] MONGODB_URI is not configured. Skipping MongoDB connection.',
    )
    return false
  }

  mongoose.connection.on('connected', () => {
    console.log('[database] MongoDB connected successfully')
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[database] MongoDB disconnected')
  })

  mongoose.connection.on('error', (err) => {
    console.error('[database] MongoDB connection error:', err.message)
  })

  try {
    await mongoose.connect(config.mongoUri)
    return true
  } catch (err) {
    console.error('[database] MongoDB connection failed:', err.message)
    throw err
  }
}

export function getDatabaseStatus() {
  if (!config.mongoUri) {
    return 'not_configured'
  }

  return (
    MONGOOSE_STATES[mongoose.connection.readyState] ?? 'unknown'
  )
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}