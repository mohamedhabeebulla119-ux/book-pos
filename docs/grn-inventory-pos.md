# GRN, barcoded inventory and the shop counter

Every physical item has its own identity. Stock for a barcode-tracked product is
always the number of its units on the shelf.

```
Delivery arrives ──► GRN (Admin → GRN → New GRN)
                        │  one unit per item, barcode AE00000001, AE00000002 …
                        │  phones: one IMEI per unit (scan the box barcode)
                        ▼
                 Print labels (sticker 50×30 mm, or A4 sheet of 24)
                        │  each label: QR + Code 128 + name + IMEI
                        ▼
                    in_stock
          ┌─────────────┴──────────────┐
  online order                     shop counter (Admin → Shop counter)
  oldest unit reserved (FIFO)      scan label or IMEI → bill → sold
  shipped/delivered → sold         reprint bill any time
  cancelled/refunded → back
```

## Screens

| Screen | Who | What |
|---|---|---|
| **GRN** `/admin/grn` | owner, admin post · staff view | Record a delivery: supplier, invoice, date, and per product the variant, quantity, cost and IMEIs. Posting creates the units and raises stock. Open any GRN to print its labels. |
| **Inventory** `/admin/inventory` | staff view · owner, admin act | Stock by product (on shelf / reserved / sold / written off, oldest unit date). Units tab: find by barcode or IMEI, reprint labels, write off damaged or mistaken units, take back a counter sale. |
| **Shop counter** `/admin/pos` | owner, admin, staff | Scan with a USB/Bluetooth scanner (it types the code and Enter) or the phone camera. Price is the live retail price from the database; one bill-level discount. Completing the sale opens the 80 mm bill PDF. |
| **Orders** (existing) | — | An order now shows **Units to pack**: the exact barcodes reserved for it. |

Customers never see a barcode or IMEI; those tables are readable by staff only.

## Rules worth knowing

- A product becomes barcode-tracked at its first GRN. After that, **Adjust stock is
  refused** for it — stock comes in by GRN and goes out by sale or write-off.
- A GRN is refused while the product still has untracked stock (a number with no
  units). Set it to 0 with Adjust stock (stock count), then receive the items by GRN
  so every one gets a label.
- iPhone category has `requires_serial` on: every unit needs a unique IMEI, and a
  15-digit IMEI must pass the check digit.
- Posting a GRN, completing a sale and every other write is safe to retry: the same
  request is applied once.

## Database

Migration `supabase/migrations/20261028120000_grn_barcode_units_and_pos.sql`,
verified by `supabase/tests/verify_grn_units_pos.sql` (12 checks, ends with
`ALL GRN / UNIT / POS CHECKS PASSED`).

## Android

`CAMERA` permission added for camera scanning at the counter. Rebuild the APK
(`npm run build && npx cap sync android`) and bump the version.

# Purchase & Returns

Sidebar group **Purchase & Returns** holds five pages:

| Page | What it does |
|---|---|
| **Supplier Details** `/admin/suppliers` | Add / edit suppliers (name, contact, phone, email, address, opening balance). View one to see its GRNs, returns, payments and the amount owed. Deactivate instead of deleting. |
| **Good Receive Notice** `/admin/grn` | Receive goods from a chosen supplier, optionally against a purchase order (its open lines are filled in). Same barcodes and labels as before. |
| **Purchase Orders** `/admin/purchase-orders` | Order from a supplier; receive deliveries against it (status Open → Partly received → Received); close the rest when it will not come. |
| **Supplier Returns** `/admin/supplier-returns` | Scan shelf items to send back. Cash = supplier refunded money; Credit = deducted from what you owe. Stock falls; the units become *Returned to supplier*. |
| **Supplier Payments** `/admin/supplier-payments` | Record money paid (cash, bank transfer, cheque, card). Mistakes are voided, not deleted. Owner/admin only. |

**Amount owed to a supplier** = opening balance + GRNs received − credit returns − payments.

Database: `supabase/migrations/20261028160000_suppliers_purchase_orders_returns_payments.sql`,
verified by `supabase/tests/verify_purchase_returns.sql` (10 checks, ends with
`ALL PURCHASE & RETURNS CHECKS PASSED`).
