"use client"

import { BatteryMedium, Check, Package, Recycle, ShieldCheck, ShieldOff, Sparkles, X } from 'lucide-react'
import type { Product, ProductVariant, WarrantyOption } from '@/types'
import { InfoBox } from '@/components/ui/InfoBox'
import { formatPrice } from '@/utils/formatPrice'
import { cn } from '@/lib/utils'
import {
  durationLabel, hasWarrantyChoice, warrantyNoun, effectiveWarrantyPlan,
  itemCondition, itemConditionLabel, productConditionSummary, hasPreOwned,
} from '@/lib/catalog'

/**
 * Condition and warranty presentation shared by the product page, the parts
 * page, the cart and the product card. Every value is read from the product /
 * variant as the live catalog built it (product_conditions, condition_grades,
 * product_warranty_plans, product_warranty_options) — nothing is defaulted or
 * invented here, and nothing here computes a price the customer will be charged.
 *
 * Pass `variant` wherever one is chosen: condition and warranty belong to the
 * variant. Without one, the chip summarises the product truthfully.
 */

/**
 * With a variant (or for a product without variants): that item's condition —
 * "Brand New" / "Pre-Owned · Grade A" / "Pre-Owned".
 * Without one, on a product with variants: the card summary — the shared
 * condition, or "New & Pre-Owned" when the variants differ.
 * Renders nothing until live data says, and nothing for a condition the store
 * does not offer. Brand New is neutral; anything pre-owned is highlighted.
 */
export function ConditionChip({
  product, variant, className,
}: {
  product: Product
  variant?: ProductVariant
  className?: string
}) {
  const label = variant ? itemConditionLabel(product, variant) : productConditionSummary(product)
  if (!label) return null
  const used = variant ? variant.condition === 'pre_owned' : hasPreOwned(product)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
        used
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {used ? <Recycle size={10} strokeWidth={2.4} aria-hidden="true" /> : <Sparkles size={10} strokeWidth={2.4} aria-hidden="true" />}
      {label}
    </span>
  )
}

/** The labelled "Condition" line on the product page — of the SELECTED variant. */
export function ConditionLine({ product, variant }: { product: Product; variant?: ProductVariant }) {
  if (!itemConditionLabel(product, variant)) return null
  return (
    <p className="mb-4 flex items-center gap-2 text-sm">
      <span className="font-semibold text-muted-foreground">Condition</span>
      <ConditionChip product={product} variant={variant} className="py-1 text-[11px]" />
    </p>
  )
}

/** Grade, battery health and the rest of what the admin recorded — for the selected variant. */
export function PreOwnedDetails({ product, variant }: { product: Product; variant?: ProductVariant }) {
  const item = itemCondition(product, variant)
  const details = item?.preOwned
  if (item?.condition !== 'pre_owned' || !details) return null

  const rows: { label: string; value: string }[] = []
  if (details.grade) rows.push({ label: 'Condition grade', value: details.grade.label })
  if (details.batteryHealth !== undefined) rows.push({ label: 'Battery health', value: `${details.batteryHealth}%` })
  if (details.cycleCount !== undefined) rows.push({ label: 'Cycle count', value: details.cycleCount.toLocaleString('en-LK') })
  if (details.physicalCondition) rows.push({ label: 'Physical condition', value: details.physicalCondition })
  if (details.accessoriesIncluded) rows.push({ label: 'Accessories included', value: details.accessoriesIncluded })
  if (rows.length === 0 && !details.deviceNotes) return null

  return (
    <div className="mb-8">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
        <Recycle size={18} className="text-amber-600 dark:text-amber-400" /> Pre-Owned Device
      </h3>
      <div className="rounded-[26px] border border-mint/80 dark:border-border bg-surface px-4 shadow-card divide-y divide-mint/80 dark:divide-border">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:justify-between">
            <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
            <span className="text-[13px] text-foreground sm:w-2/3 sm:text-right">
              {label === 'Battery health' && <BatteryMedium size={14} className="mr-1 inline -mt-0.5 text-primary" />}
              {value}
            </span>
          </div>
        ))}
        {details.grade?.description && (
          <p className="py-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{details.grade.label}: </span>
            {details.grade.description}
          </p>
        )}
        {details.deviceNotes && (
          <p className="py-3.5 text-[12.5px] leading-relaxed text-foreground/85 whitespace-pre-line">{details.deviceNotes}</p>
        )}
      </div>
    </div>
  )
}

/** The warranty choice for the plan in force (variant override, else product default). */
export function WarrantyPicker({
  product, variant, selected, onSelect,
}: {
  product: Product
  variant?: ProductVariant
  selected: WarrantyOption | undefined
  onSelect: (option: WarrantyOption) => void
}) {
  if (!hasWarrantyChoice(product, variant)) return null
  const options = effectiveWarrantyPlan(product, variant)!.options

  return (
    <fieldset className="mb-8">
      <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Choose {warrantyNoun(product)}
      </legend>
      <div className="space-y-2.5" role="radiogroup">
        {options.map((option) => {
          const isSelected = selected?.id === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(option)}
              className={cn(
                'flex w-full items-center justify-between rounded-[20px] border p-4 transition-all duration-300 active:scale-[0.99]',
                isSelected
                  ? 'border-primary/45 bg-well-strong shadow-card'
                  : 'border-mint/80 dark:border-border bg-surface hover:border-primary/30',
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    isSelected ? 'border-primary' : 'border-mint-deep',
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <span className={cn('truncate text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                  {durationLabel(option.months)}
                </span>
              </span>
              <span className="ml-3 shrink-0 text-sm font-bold">
                {option.addOn === 0 ? 'Included' : `+${formatPrice(option.addOn)}`}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Base + warranty = total, for one unit. Only shown when a warranty is chosen. */
export function PriceBreakdown({
  product, base, option,
}: {
  product: Product
  base: number
  option: WarrantyOption | undefined
}) {
  if (!option) return null
  return (
    <dl className="mb-6 space-y-1.5 rounded-[20px] border border-mint/80 dark:border-border bg-surface px-4 py-3 text-[13px] shadow-card">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Base price</dt>
        <dd className="font-semibold text-foreground">{formatPrice(base)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{durationLabel(option.months)} {warrantyNoun(product)}</dt>
        <dd className="font-semibold text-foreground">{option.addOn === 0 ? 'Included' : `+${formatPrice(option.addOn)}`}</dd>
      </div>
      <div className="flex justify-between border-t border-mint-deep pt-1.5 text-[14px]">
        <dt className="font-bold text-foreground">Total</dt>
        <dd className="font-bold text-foreground">{formatPrice(base + option.addOn)}</dd>
      </div>
    </dl>
  )
}

/**
 * The warranty section of the product page.
 *
 * With live warranty data: the type, the admin's title/description and the
 * covered / not-covered lists. Without it (bundled catalog, or before the
 * migration): the older WarrantyInfo block exactly as before.
 */
export function WarrantyTerms({ product, variant }: { product: Product; variant?: ProductVariant }) {
  // The plan in force for the selected variant: its override, else the product's.
  const plan = effectiveWarrantyPlan(product, variant)
  // The older free-text WarrantyInfo describes the PRODUCT plan only; it must
  // never be shown under a variant's own override.
  const legacy = plan === product.warrantyPlan ? product.warrantyInfo : undefined
  const noun = warrantyNoun(product)

  if (!plan) {
    if (!product.warrantyInfo) return null
    return (
      <div className="mb-8">
        <h3 className="mb-3 text-lg font-bold tracking-tight">Warranty</h3>
        {product.warrantyInfo.status === 'active' ? (
          <InfoBox icon={ShieldCheck} title={`${product.warrantyInfo.duration} Warranty`} tone="success">
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-primary-strong">Coverage: </span>
                <span className="text-foreground/80">{product.warrantyInfo.coverage}</span>
              </div>
              <div>
                <span className="font-semibold text-primary-strong">Duration: </span>
                <span className="text-foreground/80">{product.warrantyInfo.months} months from the purchase date.</span>
              </div>
            </div>
          </InfoBox>
        ) : (
          <p className="text-sm text-muted-foreground">No warranty coverage for this product.</p>
        )}
      </div>
    )
  }

  if (plan.type === 'none') {
    return (
      <div className="mb-8">
        <h3 className="mb-3 text-lg font-bold tracking-tight">{noun}</h3>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldOff size={15} className="shrink-0" /> No warranty is offered with this product.
        </p>
      </div>
    )
  }

  const included = plan.type === 'included'
    ? { duration: plan.duration ?? legacy?.duration, coverage: legacy?.coverage }
    : undefined
  const title = plan.title
    || (included?.duration ? `${included.duration} ${noun}` : noun)
  const hasTerms = plan.description || plan.covered.length > 0 || plan.excluded.length > 0 || included?.coverage

  return (
    <div className="mb-8">
      <h3 className="mb-3 text-lg font-bold tracking-tight">{noun}</h3>
      <InfoBox icon={ShieldCheck} title={title} tone="success">
        <div className="space-y-3 text-sm">
          {plan.type === 'optional_paid' && (
            <p className="text-foreground/80">Choose your cover above — the price updates with your choice.</p>
          )}
          {plan.description && <p className="text-foreground/80 whitespace-pre-line">{plan.description}</p>}
          {!plan.description && included?.coverage && <p className="text-foreground/80">{included.coverage}</p>}
          {plan.covered.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-primary-strong">Covered</p>
              <ul className="space-y-1.5">
                {plan.covered.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-foreground/85">
                    <Check size={15} className="mt-0.5 shrink-0 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.excluded.length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-foreground">Not covered</p>
              <ul className="space-y-1.5">
                {plan.excluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-foreground/75">
                    <X size={15} className="mt-0.5 shrink-0 text-muted-foreground" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasTerms && plan.type === 'included' && (
            <p className="flex items-center gap-2 text-foreground/80"><Package size={14} /> Included with this product.</p>
          )}
        </div>
      </InfoBox>
    </div>
  )
}
