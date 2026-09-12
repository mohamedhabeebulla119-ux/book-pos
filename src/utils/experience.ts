/**
 * Which shopping experience the customer chose on the entry screen.
 *
 * THIS IS A UI PREFERENCE AND NOTHING ELSE.
 *
 * Choosing "Wholesale" does not make anyone a wholesale customer. It decides
 * which screens they are shown; the price they are charged is decided entirely
 * by public.profiles.customer_type, which this app cannot write — the column's
 * UPDATE privilege is revoked from `authenticated`, so only the
 * admin_set_customer_type() RPC can change it.
 *
 * The value lives in localStorage precisely because it deserves no more trust
 * than that: it is readable and writable by anyone holding the device, exactly
 * like the onboarding flag it sits beside, and nothing of consequence depends
 * on it. Deliberately NOT stored on the profile, where it would look like a
 * second, competing source of truth about a customer's tier.
 */

const EXPERIENCE_STORAGE_KEY = 'apple-expert-experience'

export const SHOPPING_EXPERIENCES = ['retail', 'wholesale'] as const
export type ShoppingExperience = (typeof SHOPPING_EXPERIENCES)[number]

function isExperience(value: string | null): value is ShoppingExperience {
  return value !== null && (SHOPPING_EXPERIENCES as readonly string[]).includes(value)
}

/**
 * The stored choice, or null when the customer has not chosen yet.
 *
 * Returns null during prerender so the entry screen is never baked into the
 * exported HTML as "already chosen".
 */
export function getExperience(): ShoppingExperience | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)
    return isExperience(stored) ? stored : null
  } catch {
    // Private browsing or blocked storage: the entry screen simply shows again.
    return null
  }
}

export function setExperience(experience: ShoppingExperience): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, experience)
  } catch {
    // Non-fatal: the choice still routes this session, it just is not remembered.
  }
}

/** Lets the customer return to the entry screen from their profile. */
export function clearExperience(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(EXPERIENCE_STORAGE_KEY)
  } catch {
    // Nothing to do — there was nothing stored to clear.
  }
}
