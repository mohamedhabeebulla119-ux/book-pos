import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client.
 *
 * Only the public URL and the publishable (anon) key are used here. Both are
 * `NEXT_PUBLIC_` variables, which Next.js inlines into the client bundle at
 * build time, so they must be referenced statically (a dynamic
 * `process.env[name]` lookup would not be inlined).
 *
 * The secret / service-role key must never be imported into this file or any
 * other module that reaches the browser bundle.
 *
 * The app is a static export packaged with Capacitor, so there is no Node
 * server at runtime: every Supabase call happens from the device's WebView
 * through this client.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, creating it on first use.
 *
 * Creation is lazy so that nothing is instantiated while pages are being
 * prerendered during `next build`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  if (!supabaseUrl || !supabasePublishableKey) {
    // Names only — never log or interpolate the values themselves.
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local and rebuild.",
    );
  }

  client = createClient(supabaseUrl, supabasePublishableKey);
  return client;
}

/**
 * Whether the Supabase environment variables were present at build time.
 * Lets callers degrade gracefully instead of throwing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
