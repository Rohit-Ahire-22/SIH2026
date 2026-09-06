const DATE_LABELS = {
  dateOfManufacture:
    /^\s*(?:date\s+of\s+manufacture|mfg(?:\.)?\s*(?:date)?|mfd(?:\.)?|manufactur(?:ed|ing)\s*(?:date|on)?)\s*[:\-.]?\s*/i,
  dateOfPacking:
    /^\s*(?:date\s+of\s+packing|packed\s+on|packing\s+date|pkd(?:\.)?)\s*[:\-.]?\s*/i,
  expiryOrUseByDate:
    /^\s*(?:expiry\s*(?:date)?|use\s+by|best\s+before|exp(?:\.)?\s*(?:date)?)\s*[:\-.]?\s*/i,
}

const MRP_LABEL = /\b(?:maximum\s+retail\s+price|m\.?\s*r\.?\s*p\.?|max\s+retail\s+price|retail\s+price)\b/i
const MONEY_PATTERN = /(?:₹|rs\.?|inr)\s*([\d][\d,]*(?:\.\d+)?)|([\d][\d,]*(?:\.\d+)?)/i

const NET_QTY_LABEL = /^\s*(?:net\s+(?:quantity|qty|weight|w(?:t)?\.?|content)|quantity|weight)\s*[:\-.]?\s*/i
const NET_QTY_VALUE = /^\s*(\d*\.?\d+)\s*(g|kg|mg|ml|millilitre|milliliter|litre|liter|l|L)\b/i

const BATCH_LABEL = /^\s*(?:batch|lot)\s*(?:no\.?|number\.?)?\s*[:.#\-]?\s*/i
const BATCH_VALUE = /^([A-Za-z0-9][A-Za-z0-9./\-]{1,30})/

const COUNTRY_PATTERNS = [
  /^\s*country\s+of\s+origin\s*[:.\-]?\s*/i,
  /^\s*made\s+in\s*[:.\-]?\s*/i,
  /^\s*origin\s*[:.\-]?\s*/i,
]

const MANUFACTURER_PATTERNS = [
  /^\s*manufactured\s+(?:(?:and|&)\s+)?(?:marketed\s+)?by\s*[:.\-]?\s*/i,
  /^\s*mfd\.?\s+by\s*[:.\-]?\s*/i,
  /^\s*marketed\s+by\s*[:.\-]?\s*/i,
  /^\s*manufacturer\s*[:.\-]?\s*/i,
]

const CONSUMER_CARE_PATTERN =
  /^\s*(?:consumer\s+care|consumer\s+complaints|customer\s+care|customer\s+service|helpline|toll[\s-]*free)\s*[:.\-]?\s*/i

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{3,5})?/

const UNIT_NORMALIZATION = {
  g: 'g',
  kg: 'kg',
  mg: 'mg',
  ml: 'ml',
  mL: 'ml',
  l: 'l',
  L: 'l',
  litre: 'l',
  liter: 'l',
}

export function extractProductFields(ocrResults) {
  const lines = reconstructLines(ocrResults)

  return {
    mrp: extractMrp(lines),
    netQuantity: extractNetQuantity(lines),
    batchLotNumber: extractBatchLotNumber(lines),
    dateOfManufacture: extractDate(lines, DATE_LABELS.dateOfManufacture),
    dateOfPacking: extractDate(lines, DATE_LABELS.dateOfPacking),
    expiryOrUseByDate: extractDate(lines, DATE_LABELS.expiryOrUseByDate),
    countryOfOrigin: extractCountry(lines),
    manufacturerName: extractManufacturer(lines),
    consumerCareDetails: extractConsumerCare(lines),
  }
}

function reconstructLines(ocrResults) {
  if (!Array.isArray(ocrResults)) return []
  const valid = ocrResults.filter((r) => r && typeof r.text === 'string' && Array.isArray(r.box))
  if (valid.length === 0) {
    return ocrResults.map((entry) => {
      if (typeof entry === 'string') return entry
      return entry && typeof entry.text === 'string' ? entry.text : ''
    })
  }

  const blocks = valid.map((r) => {
    const ys = r.box.map((p) => p[1])
    const xs = r.box.map((p) => p[0])
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const minX = Math.min(...xs)
    const yCenter = (minY + maxY) / 2
    const height = maxY - minY
    return { text: r.text, minX, yCenter, height, box: r.box }
  })

  blocks.sort((a, b) => a.yCenter - b.yCenter)

  const lines = []
  let currentLine = []

  for (const block of blocks) {
    if (currentLine.length === 0) {
      currentLine.push(block)
    } else {
      const prevBlock = currentLine[currentLine.length - 1]
      const avgHeight = (block.height + prevBlock.height) / 2
      // If centers are within 50% of avg height, consider same line
      if (Math.abs(block.yCenter - prevBlock.yCenter) < avgHeight * 0.5) {
        currentLine.push(block)
      } else {
        lines.push(currentLine)
        currentLine = [block]
      }
    }
  }
  if (currentLine.length > 0) lines.push(currentLine)

  return lines.map((line) => {
    line.sort((a, b) => a.minX - b.minX)
    return line.map((b) => b.text).join(' ')
  })
}

function isLabel(line) {
  if (MRP_LABEL.test(line)) return true;
  if (NET_QTY_LABEL.test(line)) return true;
  if (BATCH_LABEL.test(line)) return true;
  for (const p of Object.values(DATE_LABELS)) if (p.test(line)) return true;
  if (CONSUMER_CARE_PATTERN.test(line)) return true;
  for (const p of COUNTRY_PATTERNS) if (p.test(line)) return true;
  for (const p of MANUFACTURER_PATTERNS) if (p.test(line)) return true;
  return false;
}

function extractMrp(lines) {
  for (let i = 0; i < lines.length; i++) {
    const match = MRP_LABEL.exec(lines[i])
    if (!match) continue

    let combined = lines[i].slice(match.index + match[0].length)
    let amount = MONEY_PATTERN.exec(combined)
    if (amount) {
      const rawAmount = amount[1] || amount[2]
      const value = parseFloat(rawAmount.replace(/,/g, ''))
      if (Number.isFinite(value)) return value
    }

    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      combined += ' ' + lines[i + j]
      amount = MONEY_PATTERN.exec(combined)
      if (amount) {
        const rawAmount = amount[1] || amount[2]
        const value = parseFloat(rawAmount.replace(/,/g, ''))
        if (Number.isFinite(value)) return value
      }
    }
  }
  return null
}

function extractNetQuantity(lines) {
  for (let i = 0; i < lines.length; i++) {
    const match = NET_QTY_LABEL.exec(lines[i])
    if (!match) continue

    let combined = lines[i].slice(match[0].length)
    let valMatch = NET_QTY_VALUE.exec(combined)
    if (valMatch) {
      const value = parseFloat(valMatch[1])
      const unit = UNIT_NORMALIZATION[valMatch[2]] || valMatch[2].toLowerCase()
      if (Number.isFinite(value) && value >= 0 && unit) {
        return { value, unit }
      }
    }

    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      combined += ' ' + lines[i + j]
      valMatch = NET_QTY_VALUE.exec(combined)
      if (valMatch) {
        const value = parseFloat(valMatch[1])
        const unit = UNIT_NORMALIZATION[valMatch[2]] || valMatch[2].toLowerCase()
        if (Number.isFinite(value) && value >= 0 && unit) {
          return { value, unit }
        }
      }
    }
  }
  return null
}

function extractBatchLotNumber(lines) {
  for (let i = 0; i < lines.length; i++) {
    const match = BATCH_LABEL.exec(lines[i])
    if (!match) continue

    let combined = lines[i].slice(match[0].length).trim()
    if (!combined && i + 1 < lines.length) {
      combined = lines[i + 1].trim()
    }

    const valMatch = BATCH_VALUE.exec(combined)
    if (valMatch) {
      const value = stripTrailingPeriod(valMatch[1]).trim()
      if (/[A-Za-z0-9]/.test(value)) return value
    }
  }
  return null
}

function extractDate(lines, labelPattern) {
  for (let i = 0; i < lines.length; i++) {
    const match = labelPattern.exec(lines[i])
    if (!match) continue

    let combined = lines[i].slice(match[0].length)
    let parsed = parseDate(combined)
    if (parsed) return parsed

    for (let j = 1; j <= 2 && i + j < lines.length; j++) {
      combined += ' ' + lines[i + j]
      parsed = parseDate(combined)
      if (parsed) return parsed
    }
  }
  return null
}

function parseDate(raw) {
  const text = raw.trim()
  if (!text) return null

  // Ensure parsing allows common OCR noise like extra spaces
  const dmy = text.match(
    /(?<!\d)(0?[1-9]|[12]\d|3[01])[\s/.\-](0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/,
  )
  if (dmy) {
    let year = dmy[3]
    if (year.length === 2) year = '20' + year // Assume 20xx for two-digit years
    return buildIsoDate(year, dmy[2], dmy[1])
  }

  const my = text.match(
    /(?<!\d)(0?[1-9]|1[0-2]|[A-Za-z]{3})[\s/.\-](\d{4}|\d{2})(?!\d)/,
  )
  if (my) {
    let year = my[2]
    if (year.length === 2) year = '20' + year
    return buildIsoDate(year, my[1], '01')
  }

  return null
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

function buildIsoDate(yearStr, monthStr, dayStr) {
  const year = Number(yearStr)
  let month = Number(monthStr)
  
  if (isNaN(month) && typeof monthStr === 'string') {
    const m = monthStr.toLowerCase().slice(0, 3)
    if (MONTH_MAP[m]) month = MONTH_MAP[m]
  }

  const day = Number(dayStr)
  if (year < 1900 || year > 2100 || isNaN(month)) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

function extractCountry(lines) {
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of COUNTRY_PATTERNS) {
      const match = pattern.exec(lines[i])
      if (!match) continue

      let value = lines[i].slice(match[0].length).trim()
      if (!value && i + 1 < lines.length) {
        value = lines[i + 1].trim()
      }

      value = stripTrailingPeriod(value)
      if (/[A-Za-z]/.test(value)) return value
    }
  }
  return null
}

function extractManufacturer(lines) {
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of MANUFACTURER_PATTERNS) {
      const match = pattern.exec(lines[i])
      if (!match) continue

      let value = lines[i].slice(match[0].length).trim()

      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        if (isLabel(lines[i + j])) break
        value += ' ' + lines[i + j].trim()
      }

      value = stripTrailingPeriod(value).trim()
      if (/[A-Za-z]/.test(value)) return value
    }
  }
  return null
}

function extractConsumerCare(lines) {
  for (let i = 0; i < lines.length; i++) {
    const match = CONSUMER_CARE_PATTERN.exec(lines[i])
    if (!match) continue

    let combined = lines[i].slice(match[0].length).trim()
    for (let j = 1; j <= 3 && i + j < lines.length; j++) {
      if (isLabel(lines[i + j])) break
      combined += ' ' + lines[i + j].trim()
    }

    if (!combined) continue

    const details = {}
    const email = EMAIL_PATTERN.exec(combined)
    if (email) details.email = email[0]

    const phone = PHONE_PATTERN.exec(combined)
    if (phone) details.phone = phone[0]

    if (details.email || details.phone) return details
  }
  return null
}

function stripTrailingPeriod(value) {
  return value.replace(/\.+$/, '').trim()
}