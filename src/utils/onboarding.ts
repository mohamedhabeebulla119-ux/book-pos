const ONBOARDING_STORAGE_KEY = 'apple-expert-onboarding-completed'

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
  } catch {
    return true
  }
}

export function markOnboardingCompleted(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
  } catch {
    // localStorage unavailable (private browsing, etc.) — onboarding will simply show again
  }
}
