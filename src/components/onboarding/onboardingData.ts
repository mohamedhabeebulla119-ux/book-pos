import { ComponentType } from 'react'
import {
  WelcomeVisual,
  DiscoverVisual,
  PartsVisual,
  ShoppingVisual,
  ReadyVisual,
} from './visuals'

export interface OnboardingScreen {
  id: string
  eyebrow: string
  headline: string
  subtitle: string
  Visual: ComponentType
  /** Atmospheric background gradient for this screen (light + dark variants baked in) */
  bg: string
}

export const onboardingScreens: OnboardingScreen[] = [
  {
    id: 'welcome',
    eyebrow: 'Apple Expert',
    headline: 'Welcome to Apple Expert',
    subtitle: 'Your trusted destination for Apple products, genuine parts and premium accessories.',
    Visual: WelcomeVisual,
    bg: 'from-emerald-200 to-background dark:from-emerald-500/22 dark:to-background',
  },
  {
    id: 'discover',
    eyebrow: 'Discover',
    headline: 'Everything Apple. In One Place.',
    subtitle: 'Explore iPhone, iPad, Mac, Apple Watch, AirPods and more.',
    Visual: DiscoverVisual,
    bg: 'from-green-200 to-background dark:from-green-500/22 dark:to-background',
  },
  {
    id: 'parts',
    eyebrow: 'Repairs',
    headline: 'Quality Parts. Reliable Repairs.',
    subtitle: 'Find displays, batteries, replacement parts and accessories for your Apple devices.',
    Visual: PartsVisual,
    bg: 'from-teal-200 to-background dark:from-teal-500/22 dark:to-background',
  },
  {
    id: 'shopping',
    eyebrow: 'Shopping',
    headline: 'Simple. Fast. Convenient.',
    subtitle: 'Browse products, compare options, add to your cart and order with ease.',
    Visual: ShoppingVisual,
    bg: 'from-lime-200 to-background dark:from-lime-500/18 dark:to-background',
  },
  {
    id: 'ready',
    eyebrow: 'Let’s go',
    headline: 'Your Apple Journey Starts Here.',
    subtitle: 'Discover the products and parts you need with Apple Expert.',
    Visual: ReadyVisual,
    bg: 'from-emerald-300 to-background dark:from-emerald-600/25 dark:to-background',
  },
]
