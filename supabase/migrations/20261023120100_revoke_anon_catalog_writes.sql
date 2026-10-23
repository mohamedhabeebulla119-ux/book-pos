-- ============================================================================
-- Apple Expert · P1 · anonymous callers keep no write privileges on the catalog
-- ----------------------------------------------------------------------------
-- Defence in depth, kept separate from the inventory migration so it can be
-- applied or rolled back on its own.
--
-- Supabase's default privileges grant ALL on new public tables to anon. On the
-- tables below no policy has ever targeted anon for INSERT/UPDATE/DELETE, so RLS
-- already refuses every such write and this changes no behaviour. It removes the
-- grants a future permissive or `to public` policy would otherwise silently
-- re-open - the same pattern as 20260929120000 (L-1) used for customer tables.
-- products and product_variants were handled in 20261023120000.
--
-- Not touched:
--   * SELECT for anon - the catalog, its images and the storefront banners are
--     read publicly through the existing "public read" policies.
--   * authenticated - admin catalog editing uses these grants, and the
--     "admin all" policies decide who may write.
-- ============================================================================

revoke insert, update, delete on
  public.categories,
  public.device_models,
  public.product_images,
  public.product_specs,
  public.product_compatibility,
  public.featured_products,
  public.banners
from anon;


-- ----------------------------------------------------------------------------
-- Self-verification
-- ----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public.categories', 'public.device_models', 'public.product_images', 'public.product_specs',
    'public.product_compatibility', 'public.featured_products', 'public.banners'] loop
    if has_table_privilege('anon', v_table, 'INSERT')
       or has_table_privilege('anon', v_table, 'UPDATE')
       or has_table_privilege('anon', v_table, 'DELETE') then
      raise exception 'verify: anon can still write %', v_table;
    end if;
    if not has_table_privilege('anon', v_table, 'SELECT') then
      raise exception 'verify: anon lost SELECT on % - public catalog reads would break', v_table;
    end if;
    if not has_table_privilege('authenticated', v_table, 'INSERT')
       or not has_table_privilege('authenticated', v_table, 'UPDATE')
       or not has_table_privilege('authenticated', v_table, 'DELETE') then
      raise exception 'verify: authenticated lost write privileges on % - admin editing would break', v_table;
    end if;
  end loop;
  raise notice 'verified: anon read-only on 7 catalog tables; authenticated editing privileges unchanged';
end
$$;


-- ----------------------------------------------------------------------------
-- Rollback (manual, not recommended):
--   grant insert, update, delete on public.categories, public.device_models,
--     public.product_images, public.product_specs, public.product_compatibility,
--     public.featured_products, public.banners to anon;
-- ----------------------------------------------------------------------------
