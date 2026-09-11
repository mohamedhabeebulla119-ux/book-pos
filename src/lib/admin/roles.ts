import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Admin roles, mirroring the CHECK constraint on public.user_roles.
 *
 * Authorization is NOT decided here. This module only asks the database what
 * the signed-in user's roles are; PostgreSQL decides what it will return via
 * the "user_roles read own" RLS policy, which restricts every caller to rows
 * where profile_id = auth.uid(). A tampered client can lie to this function's
 * caller, but it cannot make the database hand over a role the user lacks, and
 * every privileged action is separately gated by RLS and the
 * admin_set_price / admin_set_customer_type SECURITY DEFINER functions.
 */
export const ADMIN_ROLES = ["owner", "admin", "staff"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Seniority, used to pick a single effective role when a user holds several. */
const ROLE_RANK: Record<AdminRole, number> = { owner: 3, admin: 2, staff: 1 };

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

/** Human label for the role badge in the admin header. */
export const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  staff: "Staff",
};

/**
 * Reads the signed-in user's roles from the database.
 *
 * Returns the most senior admin role held, or null when the user holds none —
 * which is the "Access Denied" case. Throws only on a transport/query failure,
 * so a network error is never silently treated as "no access".
 */
export async function fetchAdminRole(userId: string): Promise<AdminRole | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", userId);

  if (error) throw error;

  const roles = (data ?? [])
    .map((row) => row.role)
    .filter((role): role is AdminRole => isAdminRole(role));

  if (roles.length === 0) return null;

  return roles.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}
