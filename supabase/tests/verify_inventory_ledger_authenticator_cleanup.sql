-- ============================================================================
-- Removes the committed fixtures of verify_inventory_ledger_authenticator.sql
-- and verify_inventory_concurrency.sh. LOCAL ONLY. Run as postgres; safe to
-- run repeatedly.
--
-- Ledger rows are append-only for clients, not for the table owner: fixture
-- rows are removed here, as the operator, before their product. Stock is
-- zeroed first because the guard refuses to delete stock on hand.
-- ============================================================================
begin;
delete from public.inventory_movements where product_id in ('p1-api', 'p1-conc', 'p1-conc-b');
update public.product_variants set stock = 0 where product_id in ('p1-api', 'p1-conc', 'p1-conc-b') and stock is not null;
update public.products set stock = 0 where id in ('p1-api', 'p1-conc', 'p1-conc-b');
delete from public.products where id in ('p1-api', 'p1-conc', 'p1-conc-b');
drop function if exists public.p1_test_unrecorded_write(integer);
drop function if exists public.p1_test_mismatched_write();
delete from auth.users where id in ('f5555555-5555-5555-5555-555555555555', 'f6666666-6666-6666-6666-666666666666');
commit;
