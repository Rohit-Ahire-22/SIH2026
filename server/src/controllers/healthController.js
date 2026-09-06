import { getDatabaseStatus } from '../config/database.js'

export function getHealth(_req, res) {
  return res.status(200).json({
    success: true,
    message: 'SIH Compliance API is running',
    database: getDatabaseStatus(),
  })
}