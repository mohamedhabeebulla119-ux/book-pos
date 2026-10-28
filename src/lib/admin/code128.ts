/**
 * Code 128 encoder — the barcode printed under every unit label.
 *
 * Kept dependency-free and vector-only: the label PDF draws each bar as a
 * rectangle, so it stays sharp on any printer and any USB scanner reads it.
 * Unit barcodes look like AE00000001: the letters go out in code set B and the
 * digits switch to code set C (two digits per symbol), which keeps the barcode
 * short enough to fit a small sticker.
 */

/** Bar/space widths (in modules) for symbol values 0-106. 106 is STOP. */
const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_B = 104
const START_C = 105
const CODE_C = 99 // switch to set C (from set B)
const CODE_B = 100 // switch to set B (from set C)
const STOP = 106

function digitRunAt(text: string, from: number): number {
  let n = 0
  while (from + n < text.length && text[from + n] >= '0' && text[from + n] <= '9') n++
  return n
}

/** Symbol values for `text` (printable ASCII 32-126), including check digit and stop. */
export function code128Values(text: string): number[] {
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if (c < 32 || c > 126) throw new Error(`Code 128: unsupported character in "${text}"`)
  }

  const values: number[] = []
  let set: 'B' | 'C'
  let i = 0

  // Start in C only when the whole thing begins with 4+ digits (an even run).
  const lead = digitRunAt(text, 0)
  if (lead >= 4 && lead % 2 === 0) {
    set = 'C'
    values.push(START_C)
  } else {
    set = 'B'
    values.push(START_B)
  }

  while (i < text.length) {
    const run = digitRunAt(text, i)
    if (set === 'B' && run >= 4) {
      // Switch to C for an even number of digits; an odd leftover digit is
      // sent in B first.
      if (run % 2 === 1) {
        values.push(text.charCodeAt(i) - 32)
        i++
      }
      values.push(CODE_C)
      set = 'C'
      continue
    }
    if (set === 'C') {
      if (run >= 2) {
        values.push(Number(text.slice(i, i + 2)))
        i += 2
        continue
      }
      values.push(CODE_B)
      set = 'B'
      continue
    }
    values.push(text.charCodeAt(i) - 32)
    i++
  }

  let sum = values[0]
  for (let k = 1; k < values.length; k++) sum += values[k] * k
  values.push(sum % 103)
  values.push(STOP)
  return values
}

/**
 * The barcode as alternating bar/space widths in modules, starting with a
 * bar. Total width = sum of the widths (excluding the quiet zones, which the
 * caller leaves blank: at least 10 modules each side).
 */
export function code128Widths(text: string): number[] {
  const widths: number[] = []
  for (const value of code128Values(text)) {
    for (const ch of PATTERNS[value]) widths.push(Number(ch))
  }
  return widths
}

/** Total width in modules (without quiet zones). */
export function code128Modules(text: string): number {
  return code128Widths(text).reduce((a, b) => a + b, 0)
}
