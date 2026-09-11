/**
 * AI Chat Service — Compliance Assistant
 *
 * Configurable provider interface for the AI compliance assistant.
 * The compliance system MUST continue working if this service is unavailable.
 *
 * Environment variables:
 *   AI_CHAT_PROVIDER  — 'openai' | 'google' | (leave unset for unavailable state)
 *   AI_CHAT_MODEL     — e.g. 'gpt-4o-mini' or 'gemini-1.5-flash'
 *   AI_CHAT_API_KEY   — API key for the configured provider
 *
 * If no provider is configured, all methods return { available: false }.
 * Errors do NOT propagate to the compliance pipeline.
 */

const SYSTEM_PROMPT = `You are a compliance assistant for the Packaged Commodity Compliance System (SIH26034).
You help inspectors understand existing inspection results under Legal Metrology (Packaged Commodities) Rules, 2011.

STRICT RULES you must follow:
- You ONLY explain the inspection data provided to you. Do not invent evidence.
- Do NOT change or override the compliance status (COMPLIANT/NON_COMPLIANT/REVIEW/PENDING).
- Do NOT claim that a violation is legally confirmed. The final legal determination is made by authorized authorities.
- Do NOT invent legal requirements not present in the inspection context.
- If the provided data is insufficient to answer a question, say so clearly.
- Use professional, factual language. Avoid speculation.
- Do NOT reveal any user personal data not included in the inspection context.

You may explain:
- What each rule check means (Rule 6, Rule 7, Rule 8, Rule 9, Rule 11)
- What evidence was found or not found
- Why a check received PASS/FAIL/REVIEW status
- What "REVIEW" means in practice
- What fields were extracted and from where`

/**
 * Builds a safe, structured context object from a Product document.
 * Does NOT include personal user information.
 *
 * @param {object} product - Mongoose Product document (lean)
 * @returns {object} Safe context for the AI prompt
 */
export function buildInspectionContext(product) {
  const ruleResults = {}
  if (product.complianceDetails) {
    for (const [key, val] of Object.entries(product.complianceDetails)) {
      if (val && val.checks) {
        ruleResults[key] = {
          ruleNumber: val.ruleNumber,
          status: val.status,
          reason: val.reason,
          checks: (val.checks || [])
            .filter((c) => c.status !== 'NOT_APPLICABLE')
            .map((c) => ({
              requirement: c.requirement,
              status: c.status,
              reason: c.reason,
              clause: c.clause,
              // Include evidence summaries (not full bbox/buffer data)
              evidence: Array.isArray(c.evidence)
                ? c.evidence.slice(0, 3).map((e) =>
                    typeof e === 'object'
                      ? { value: e.value, sourceType: e.sourceType, confidence: e.confidence }
                      : e,
                  )
                : [],
            })),
        }
      }
    }
  }

  return {
    productName: product.productName,
    category: product.category,
    complianceStatus: product.complianceStatus,
    analysisStatus: product.analysisStatus,
    ruleResults,
    extractedFields: product.metadata?.extractedFields
      ? Object.fromEntries(
          Object.entries(product.metadata.extractedFields).map(([k, v]) => [
            k,
            typeof v === 'object' && v !== null
              ? { value: v.value, sourceType: v.sourceType, confidence: v.confidence }
              : v,
          ]),
        )
      : {},
  }
}

/**
 * Checks whether an AI provider is configured.
 * @returns {boolean}
 */
export function isAiChatAvailable() {
  return Boolean(
    process.env.AI_CHAT_PROVIDER &&
      process.env.AI_CHAT_API_KEY &&
      process.env.AI_CHAT_MODEL,
  )
}

/**
 * Calls the configured AI provider with the inspection context and user question.
 *
 * @param {object} context - Safe inspection context from buildInspectionContext()
 * @param {string} question - User's question
 * @returns {Promise<string>} AI response text
 */
export async function askComplianceQuestion(context, question) {
  if (!isAiChatAvailable()) {
    return null // Caller handles unavailable state
  }

  const provider = process.env.AI_CHAT_PROVIDER
  const model = process.env.AI_CHAT_MODEL
  const apiKey = process.env.AI_CHAT_API_KEY

  const userMessage = `Inspection context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`

  try {
    if (provider === 'openai') {
      return await callOpenAI(apiKey, model, userMessage)
    }
    if (provider === 'google') {
      return await callGemini(apiKey, model, userMessage)
    }
    console.warn(`[AiChat] Unknown provider: ${provider}`)
    return null
  } catch (err) {
    console.error('[AiChat] Provider error:', err.message)
    throw err
  }
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function callOpenAI(apiKey, model, userMessage) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 600,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response received.'
}

async function callGemini(apiKey, model, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.'
  )
}
