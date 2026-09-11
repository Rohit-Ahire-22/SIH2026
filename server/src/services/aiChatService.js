/**
 * AI Chat Service — Compliance Assistant
 *
 * Gemini (unofficial) provider interface for the AI compliance assistant using
 * Google's official `@google/genai` SDK. Uses the Gemini API Free Tier.
 * The compliance system MUST continue working if this service is unavailable.
 *
 * Environment variables:
 *   AI_CHAT_PROVIDER  — 'gemini' | (leave unset for unavailable state)
 *   AI_CHAT_MODEL     — e.g. 'gemini-3.5-flash-lite' (Free Tier eligible)
 *   AI_CHAT_API_KEY   — Gemini API key (server-side only, never exposed)
 *
 * The API key is read server-side and is never sent to, or logged from,
 * the browser or any API response.
 *
 * If no provider is configured, all methods return { available: false }.
 * Errors do NOT propagate to the compliance pipeline.
 */
import { GoogleGenAI } from '@google/genai'

const SYSTEM_PROMPT = `You are the AI assistant for the Packaged Commodity Compliance System (SIH26034), a platform for Legal Metrology (Packaged Commodities) Rules, 2011 compliance inspections.
You assist inspectors across the whole platform.

STRICT RULES you must follow:
- You ONLY explain the data provided to you in the context. Do not invent evidence, values, or legal requirements not present in the context.
- Do NOT change or override a compliance status (COMPLIANT/NON_COMPLIANT/REVIEW/PENDING).
- Do NOT claim that a violation is legally confirmed. The final legal determination is made by authorized authorities. Use formulations like "Based on the available inspection data…".
- Do NOT invent legal requirements not present in the inspection context.
- If the provided data is insufficient to answer a question, say so clearly.
- Use professional, factual language. Avoid speculation.
- Do NOT reveal any user personal data not included in the inspection context.

You may explain:
- What each rule check means (Rule 6, Rule 7, Rule 8, Rule 9, Rule 11)
- What evidence was found or not found, and why a check received PASS/FAIL/REVIEW status
- What "REVIEW" means in practice and what fields were extracted and from where
- When inspection context is not provided (e.g. a general page-level question), still ground your answer in general knowledge while explicitly noting you cannot see that inspection's data.
- Non-inspection topics (nutrition scanner, complaints, violation map, dashboards) in a helpful but cautious way — never provide medical advice.`

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
 * Maps provider errors to a safe, user-facing message.
 * HTTP 429 (rate limit) gets a friendly "try again later" message instead of
 * a scary error.
 *
 * @param {Error} err
 * @returns {{ code: string, message: string }}
 */
export function describeAiError(err) {
  if (err && err.code === 'AI_RATE_LIMITED') {
    return {
      code: 'AI_RATE_LIMITED',
      message: 'The AI assistant is currently rate-limited. Please wait a moment and try again.',
    }
  }
  return {
    code: err && err.code ? err.code : 'AI_UNAVAILABLE',
    message: 'The AI assistant is temporarily unavailable. Please try again later.',
  }
}

/**
 * Calls the configured AI provider with the inspection context and user question.
 *
 * @param {object} context - Safe inspection context from buildInspectionContext()
 *   OR a minimal global context object { page, summary } when no inspection is open.
 * @param {string} question - User's question
 * @returns {Promise<string|null>} AI response text, or null when unconfigured/unavailable
 */
export async function askComplianceQuestion(context, question) {
  if (!isAiChatAvailable()) {
    return null // Caller handles unavailable state
  }

  const provider = process.env.AI_CHAT_PROVIDER
  const model = process.env.AI_CHAT_MODEL
  const apiKey = process.env.AI_CHAT_API_KEY

  const userMessage = `Context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`

  try {
    if (provider === 'gemini') {
      return await callGemini(apiKey, model, userMessage)
    }
    console.warn(`[AiChat] Unknown provider: ${provider}`)
    return null
  } catch (err) {
    console.error('[AiChat] Provider error:', err.message)
    throw err
  }
}

// ─── Provider implementation (Gemini Free Tier via @google/genai) ──────────────

/**
 * Test seam — replaces the Gemini client factory so unit tests can exercise the
 * full askComplianceQuestion → callGemini → generateContent path without any
 * real network call. Production always uses the official GoogleGenAI client.
 */
export function __setGeminiClientFactory(factory) {
  createGeminiClient = factory
}

/** Restores the real GoogleGenAI client factory. */
export function __resetGeminiClientFactory() {
  createGeminiClient = defaultGeminiClientFactory
}

const defaultGeminiClientFactory = (apiKey) =>
  new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000 } })

let createGeminiClient = defaultGeminiClientFactory

/**
 * Calls the Gemini API Free Tier through the official @google/genai SDK.
 * The SDK automatically retries transient failures (including 429); once the
 * retries are exhausted it throws an ApiError carrying the HTTP status.
 *
 * Rate limiting (429 / RESOURCE_EXHAUSTED) is surfaced as AI_RATE_LIMITED so the
 * controller can reply with a friendly "try again later" message.
 */
async function callGemini(apiKey, model, userMessage) {
  try {
    const client = createGeminiClient(apiKey)
    const response = await client.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 600,
        temperature: 0.3,
      },
    })

    return response.text || 'No response received.'
  } catch (err) {
    const status = err?.status ?? err?.statusCode ?? 0
    if (
      status === 429 ||
      /(rate limit|RESOURCE_EXHAUSTED)/i.test(String(err?.message || ''))
    ) {
      const rl = new Error('Gemini API rate limit exceeded')
      rl.code = 'AI_RATE_LIMITED'
      throw rl
    }
    throw err
  }
}