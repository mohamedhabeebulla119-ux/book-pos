"use client"

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { OTP_LENGTH } from '@/lib/auth/otp'

/**
 * The six-digit code input.
 *
 * One box per digit, but ONE piece of state: the parent holds the code as a
 * string and this component only ever hands back the next string. That keeps
 * "what has been typed" in a single place, which is what makes paste, backspace
 * and autofill behave the same as typing.
 *
 * autoComplete="one-time-code" is what lets Android and iOS offer the code from
 * the SMS itself, so the customer usually never types anything.
 */
export function OtpInput({
  value, onChange, onComplete, disabled = false, invalid = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Fired once the last digit lands, so the form can submit without a tap. */
  onComplete?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(index: number): void {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index))
    inputs.current[clamped]?.focus()
    inputs.current[clamped]?.select()
  }

  function commit(next: string, caret: number): void {
    const cleaned = next.replace(/\D/g, '').slice(0, OTP_LENGTH)
    onChange(cleaned)
    focusBox(caret)
    if (cleaned.length === OTP_LENGTH) onComplete?.(cleaned)
  }

  function handleChange(index: number, raw: string): void {
    const digits = raw.replace(/\D/g, '')
    if (digits === '') {
      // Deleting inside a box clears that digit and everything after it, which
      // is less surprising than silently closing the gap.
      commit(value.slice(0, index), index)
      return
    }
    // Typing over a box, or a keyboard pasting several digits into one box.
    const next = (value.slice(0, index) + digits).slice(0, OTP_LENGTH)
    commit(next, index + digits.length)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && value[index] === undefined && index > 0) {
      event.preventDefault()
      commit(value.slice(0, index - 1), index - 1)
      return
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); focusBox(index - 1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); focusBox(index + 1) }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted === '') return
    event.preventDefault()
    commit(pasted.slice(0, OTP_LENGTH), pasted.length)
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => { inputs.current[index] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          maxLength={OTP_LENGTH}
          aria-label={`Digit ${index + 1}`}
          value={value[index] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={`focus-ring h-14 w-full min-w-0 rounded-2xl border bg-card text-center text-[22px] font-bold tabular-nums text-foreground transition-colors focus:outline-none disabled:opacity-60 ${
            invalid
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-mint-deep dark:border-border focus:border-primary/45'
          }`}
        />
      ))}
    </div>
  )
}
