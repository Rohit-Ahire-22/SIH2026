// Versioned rule registry for the Legal Metrology (Packaged Commodities)
// Rules, 2011 and their official amendments.
//
// The registry owns:
// 1. The full rule inventory (foundational 2011 rules + official amendments).
// 2. Deterministic date-based selection via getApplicableRules().
// 3. Deterministic supersession of overlapping versions.

import { FOUNDATIONAL_RULES } from './lmpcRules.js'
import { LMPC_AMENDMENTS } from './lmpcAmendments.js'

export const RULES = Object.freeze([...FOUNDATIONAL_RULES, ...LMPC_AMENDMENTS])

const RULE_MAP = new Map(RULES.map((rule) => [rule.ruleId, rule]))

export function getRuleById(ruleId) {
  return RULE_MAP.get(ruleId) || null
}

export function normalizeDate(asOfDate) {
  if (asOfDate instanceof Date) {
    return asOfDate.toISOString().slice(0, 10)
  }
  if (typeof asOfDate === 'number') {
    return new Date(asOfDate).toISOString().slice(0, 10)
  }
  if (typeof asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    return asOfDate
  }
  if (typeof asOfDate === 'string') {
    const date = new Date(asOfDate)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10)
    }
  }
  // Default to the current UTC calendar date when none is supplied.
  // Selection is still deterministic for a given date.
  return new Date().toISOString().slice(0, 10)
}

// Inclusive effective-period semantics:
//   effectiveFrom == null           -> no verified start (never a future rule)
//   effectiveTo   == null           -> open ended
//   active when normalizeDate(asOfDate) >= effectiveFrom
//          and   normalizeDate(asOfDate) <= effectiveTo
export function isRuleActiveOn(rule, asOfDate) {
  const day = normalizeDate(asOfDate)
  const { effectiveFrom, effectiveTo } = rule

  if (effectiveFrom !== null && effectiveFrom !== undefined) {
    if (day < effectiveFrom) return false
  }
  if (effectiveTo !== null && effectiveTo !== undefined) {
    if (day > effectiveTo) return false
  }
  return true
}

function sortRules(a, b) {
  const byNumber = String(a.ruleNumber).localeCompare(String(b.ruleNumber))
  if (byNumber !== 0) return byNumber
  const byClause = String(a.clause).localeCompare(String(b.clause))
  if (byClause !== 0) return byClause
  return String(a.effectiveFrom || '0000-00-00').localeCompare(
    String(b.effectiveFrom || '0000-00-00'),
  )
}

// Deterministic selection of the rules in force on `asOfDate`.
//
// 1. Filter to rules active on the date (future rules excluded, expired
//    rules excluded, unverified-start rules treated as in force).
// 2. If a superseding newer version of the same provision is active on the
//    date, the superseded version is excluded (even if dates would overlap).
// 3. Never silently select a future rule.
//
// `productContext` is accepted for interface stability; applicability itself
// is evaluated by the applicability service, not the registry.
export function getApplicableRules({ asOfDate, productContext }) {
  const day = normalizeDate(asOfDate)

  const active = RULES.filter((rule) => isRuleActiveOn(rule, day))

  // Supersession: exclude any active rule that a co-active rule supersedes.
  const supersededIds = new Set()
  for (const rule of active) {
    if (Array.isArray(rule.supersedes)) {
      for (const id of rule.supersedes) supersededIds.add(id)
    }
  }

  const result = active.filter((rule) => !supersededIds.has(rule.ruleId))
  result.sort(sortRules)
  return result
}

export function getActiveRuleSnapshot(asOfDate) {
  return getApplicableRules({ asOfDate }).map((rule) => ({
    ruleId: rule.ruleId,
    ruleNumber: rule.ruleNumber,
    clause: rule.clause,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  }))
}