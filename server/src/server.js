import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config/env.js'
import { connectDatabase } from './config/database.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS Configuration
const allowedOrigins = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:5173']
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}))

app.use(cookieParser())
app.use(express.json({ limit: '5mb' }))

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

async function startServer() {
  try {
    await connectDatabase()
  } catch (err) {
    console.error(
      '[server] Database unavailable; starting API without MongoDB:',
      err.message,
    )
  }

  app.listen(config.port, () => {
    console.log(
      `SIH Compliance API listening on http://localhost:${config.port} (${config.nodeEnv})`,
    )
  })
}

startServer().catch((err) => {
  console.error('[server] Failed to start:', err.message)
  process.exit(1)
})