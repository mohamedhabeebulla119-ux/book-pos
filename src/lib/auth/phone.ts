/**
 * Phone number entry for SMS OTP authentication.
 *
 * Pure input handling: a country dialling code plus a national number, turned
 * into the E.164 string (`+94771234567`) that Supabase Auth — and every SMS
 * provider behind it — expects. Nothing here talks to a network, so the rules
 * below can be reasoned about and changed without touching authentication.
 *
 * Apple Expert is a Sri Lankan business, so Sri Lanka is the DEFAULT selection.
 * It is only a default: the country is a normal field the customer can change,
 * and no part of the app assumes a Sri Lankan number.
 */

export interface CountryOption {
  /** ISO 3166-1 alpha-2. The select key, because +1 covers several countries. */
  iso: string
  name: string
  /** Dialling code without the leading '+'. */
  dial: string
  /** How a local number is usually written, shown as the input placeholder. */
  example: string
}

/**
 * Countries Apple Expert customers actually order from, Sri Lanka first.
 * Extend the list rather than special-casing a number anywhere else.
 */
export const COUNTRIES: readonly CountryOption[] = [
  { iso: 'LK', name: 'Sri Lanka', dial: '94', example: '071 234 5678' },
  { iso: 'IN', name: 'India', dial: '91', example: '98765 43210' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', example: '50 123 4567' },
  { iso: 'QA', name: 'Qatar', dial: '974', example: '3312 3456' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', example: '51 234 5678' },
  { iso: 'KW', name: 'Kuwait', dial: '965', example: '500 12345' },
  { iso: 'SG', name: 'Singapore', dial: '65', example: '8123 4567' },
  { iso: 'MY', name: 'Malaysia', dial: '60', example: '12 345 6789' },
  { iso: 'GB', name: 'United Kingdom', dial: '44', example: '7400 123456' },
  { iso: 'AU', name: 'Australia', dial: '61', example: '412 345 678' },
  { iso: 'CA', name: 'Canada', dial: '1', example: '506 234 5678' },
  { iso: 'US', name: 'United States', dial: '1', example: '201 555 0123' },
]

export const DEFAULT_COUNTRY_ISO = 'LK'

export function findCountry(iso: string): CountryOption {
  return COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0]
}

/** E.164 allows at most 15 digits in total, dialling code included. */
const MAX_E164_DIGITS = 15
const MIN_NATIONAL_DIGITS = 6

export type PhoneParse =
  | { ok: true; e164: string }
  | { ok: false; reason: string }

/**
 * Builds the E.164 number from a country and whatever the customer typed.
 *
 * Separators are ignored — people write 077 123 4567, 077-1234567 and
 * (077) 1234567 for the same number. A leading trunk zero is dropped, which is
 * how the same number is written locally in Sri Lanka (0771234567) and
 * internationally (+94771234567).
 *
 * Everything else is REJECTED rather than coerced: a number that reaches the
 * provider malformed costs a real SMS and tells the customer nothing.
 */
export function parsePhone(iso: string, national: string): PhoneParse {
  const country = findCountry(iso)
  const typed = national.trim()

  if (typed === '') return { ok: false, reason: 'Enter your phone number.' }
  if (/[^\d\s\-().+]/.test(typed)) {
    return { ok: false, reason: 'Use digits only, for example 071 234 5678.' }
  }

  // A customer who pasted a full international number has already supplied the
  // dialling code; taking it twice would produce +9494…
  const digits = typed.replace(/\D/g, '')
  const withoutDial =
    typed.startsWith('+') && digits.startsWith(country.dial)
      ? digits.slice(country.dial.length)
      : digits

  const nsn = withoutDial.replace(/^0+/, '')

  if (nsn === '') return { ok: false, reason: 'Enter your phone number.' }
  if (nsn.length < MIN_NATIONAL_DIGITS) {
    return { ok: false, reason: 'That number looks too short — check it and try again.' }
  }
  if (country.dial.length + nsn.length > MAX_E164_DIGITS) {
    return { ok: false, reason: 'That number looks too long — check it and try again.' }
  }

  return { ok: true, e164: `+${country.dial}${nsn}` }
}

/**
 * Groups an E.164 number for display: +94771234567 -> "+94 77 123 4567".
 *
 * Only ever shown to the customer so they can check the number a code went to —
 * `sendOtp` and `verifyOtp` always receive the unformatted E.164 string.
 *
 * The dialling code is taken from the LONGEST match in COUNTRIES rather than
 * guessed from the first few digits, which would read +94 as +9 or +947.
 * National digits are then grouped from the right (4, then 3s), which is how
 * these numbers are written in every country in the list above.
 */
export function formatE164(e164: string): string {
  if (!e164.startsWith('+')) return e164
  const digits = e164.slice(1)

  const dial = COUNTRIES
    .map((c) => c.dial)
    .filter((code) => digits.startsWith(code))
    .sort((a, b) => b.length - a.length)[0]

  if (dial === undefined) return e164

  const nsn = digits.slice(dial.length)
  if (nsn === '') return `+${dial}`

  const groups: string[] = []
  let rest = nsn
  if (rest.length > 4) {
    groups.unshift(rest.slice(-4))
    rest = rest.slice(0, -4)
    while (rest.length > 3) {
      groups.unshift(rest.slice(-3))
      rest = rest.slice(0, -3)
    }
  }
  if (rest !== '') groups.unshift(rest)

  return `+${dial} ${groups.join(' ')}`
}
