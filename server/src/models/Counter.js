import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "complaint"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
)

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema)

/**
 * Atomically increments the named counter and returns the next value.
 * Safe against concurrent requests.
 *
 * @param {string} name - Counter name (e.g. "complaint")
 * @returns {Promise<number>} Next sequence number
 */
export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return doc.seq
}

export default Counter
